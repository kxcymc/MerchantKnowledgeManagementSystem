#!/usr/bin/env node
/**
 * Chroma 数据库查看工具
 * 类似 MySQL 的查看表和记录功能
 * 
 * 用法:
 *   node scripts/view-chroma-db.js [mode] [collection] [limit] [--show-vector|--full-vector]
 * 
 * 示例:
 *   node scripts/view-chroma-db.js                    # 查看所有集合
 *   node scripts/view-chroma-db.js persistent         # 查看 persistent 模式的所有集合
 *   node scripts/view-chroma-db.js server kb_documents # 查看 server 模式的 kb_documents 集合
 *   node scripts/view-chroma-db.js server kb_documents 10 # 查看前10条记录
 *   node scripts/view-chroma-db.js server kb_documents 10 --show-vector # 显示完整向量信息
 *   node scripts/view-chroma-db.js server kb_documents 10 --full-vector # 显示完整向量（包括统计信息）
 */

const dotenv = require('dotenv');
dotenv.config();

const config = require('../src/config');
const ChromaVectorStore = require('../src/vectorStoreChroma');
const { ChromaClient } = require('chromadb');

async function listCollections(mode) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Chroma 数据库 - ${mode.toUpperCase()} 模式`);
  console.log('='.repeat(80));
  
  const clientConfig = mode === 'persistent' ? {
    host: 'localhost',
    port: 8001
  } : {
    host: config.chroma.host,
    port: config.chroma.port
  };
  
  try {
    const client = new ChromaClient(clientConfig);
    
    // 列出所有集合
    const collections = await client.listCollections();
    
    if (collections.length === 0) {
      console.log('\n⚠ 没有找到任何集合（表）');
      return [];
    }
  
    console.log(`\n📋 找到 ${collections.length} 个集合（表）:\n`);
    
    // 显示每个集合的信息
    // listCollections() 返回字符串数组或对象数组，需要兼容处理
    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      const collectionName = typeof collection === 'string' ? collection : collection.name;
      
      try {
        const coll = await client.getCollection({ name: collectionName });
        const count = await coll.count();
        
        console.log(`${i + 1}. 集合名称: ${collectionName}`);
        console.log(`   📝 记录数: ${count}`);
        
        // 尝试获取集合的元数据
        try {
          const metadata = coll.metadata || {};
          if (Object.keys(metadata).length > 0) {
            const metaStr = JSON.stringify(metadata, null, 2);
            console.log(`   📌 元数据:`);
            metaStr.split('\n').forEach(line => console.log(`      ${line}`));
          }
        } catch (metaError) {
          // 忽略元数据获取错误
        }
        
        console.log('');
      } catch (error) {
        console.log(`${i + 1}. 集合名称: ${collectionName}`);
        console.log(`   ⚠ 无法获取详细信息: ${error.message}`);
        console.log('');
      }
    }
    
    return collections;
  } catch (error) {
    console.error(`\n✗ 连接失败: ${error.message}`);
    if (error.message.includes('Failed to connect')) {
      console.error(`\n💡 提示: 请确保 Chroma 服务器正在运行`);
      console.error(`   - persistent 模式: docker-compose -f docker-compose.persistent.yml up -d`);
      console.error(`   - server 模式: docker-compose up -d`);
    }
    return [];
  }
}

async function viewCollection(mode, collectionName, limit = 50, showVector = false, fullVector = false) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📖 查看集合: ${collectionName} (${mode.toUpperCase()} 模式)`);
  console.log('='.repeat(80));
  
  const storeConfig = mode === 'persistent' ? {
    mode: 'persistent',
    host: 'localhost',
    port: 8001,
    path: config.chroma.path,
    collectionName: collectionName
  } : {
    mode: 'server',
    host: config.chroma.host,
    port: config.chroma.port,
    path: config.chroma.path,
    collectionName: collectionName
  };
  
  try {
    const store = new ChromaVectorStore(storeConfig);
    await store.init();
    
    // 获取记录数
    const totalCount = await store.count();
    console.log(`\n📊 总记录数: ${totalCount}`);
    console.log(`📄 显示前 ${Math.min(limit, totalCount)} 条记录\n`);
    
    // 如果需要显示向量，直接使用 ChromaClient 获取包含 embeddings 的数据
    let records;
    if (showVector || fullVector) {
      const clientConfig = mode === 'persistent' ? {
        host: 'localhost',
        port: 8001
      } : {
        host: config.chroma.host,
        port: config.chroma.port
      };
      
      const client = new ChromaClient(clientConfig);
      const collection = await client.getCollection({ name: collectionName });
      
      // 获取所有 ID
      const allIds = await collection.get({ limit: limit });
      const ids = allIds.ids.slice(0, limit);
      
      if (ids.length === 0) {
        console.log('⚠ 集合中没有记录');
        return;
      }
      
      // 获取包含 embeddings 的完整数据
      const result = await collection.get({ 
        ids: ids,
        include: ['embeddings', 'documents', 'metadatas']
      });
      
      // 格式化为统一格式
      records = [];
      for (let i = 0; i < result.ids.length; i++) {
        const metadata = result.metadatas ? (result.metadatas[i] || {}) : {};
        
        // 解析 JSON 字符串的元数据
        const parsedMetadata = {};
        for (const [key, value] of Object.entries(metadata)) {
          if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
            try {
              parsedMetadata[key] = JSON.parse(value);
            } catch {
              parsedMetadata[key] = value;
            }
          } else {
            parsedMetadata[key] = value;
          }
        }
        
        records.push({
          id: result.ids[i],
          text: result.documents ? (result.documents[i] || '') : '',
          metadata: parsedMetadata,
          embedding: result.embeddings ? result.embeddings[i] : null,
          createdAt: parsedMetadata.createdAt || null
        });
      }
    } else {
      // 不需要向量时，使用原有的 list 方法
      records = await store.list(limit);
    }
    
    if (records.length === 0) {
      console.log('⚠ 集合中没有记录');
      return;
    }
    
    // 显示记录
    records.forEach((record, index) => {
      console.log(`${'─'.repeat(80)}`);
      console.log(`记录 #${index + 1}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`ID: ${record.id}`);
      console.log(`\n📝 文本内容:`);
      const textPreview = record.text.length > 200 
        ? record.text.substring(0, 200) + '...' 
        : record.text;
      console.log(`   ${textPreview.split('\n').join('\n   ')}`);
      
      if (record.metadata && Object.keys(record.metadata).length > 0) {
        console.log(`\n📌 元数据:`);
        Object.entries(record.metadata).forEach(([key, value]) => {
          if (key === 'createdAt') {
            console.log(`   ${key}: ${new Date(value).toLocaleString('zh-CN')}`);
          } else {
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const valuePreview = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
            console.log(`   ${key}: ${valuePreview}`);
          }
        });
      }
      
      if (record.embedding) {
        console.log(`\n🔢 向量维度: ${record.embedding.length}`);
        
        if (showVector || fullVector) {
          // 显示完整向量
          console.log(`\n📊 完整向量:`);
          const vectorStr = JSON.stringify(record.embedding);
          if (vectorStr.length > 2000) {
            // 如果向量太长，分行显示
            const values = record.embedding.map(v => v.toFixed(6));
            const perLine = 10; // 每行显示10个值
            for (let i = 0; i < values.length; i += perLine) {
              const line = values.slice(i, i + perLine).join(', ');
              console.log(`   [${i}-${Math.min(i + perLine - 1, values.length - 1)}]: ${line}`);
            }
          } else {
            console.log(`   ${vectorStr}`);
          }
          
          if (fullVector) {
            // 显示向量统计信息
            const embedding = record.embedding;
            const min = Math.min(...embedding);
            const max = Math.max(...embedding);
            const sum = embedding.reduce((a, b) => a + b, 0);
            const mean = sum / embedding.length;
            const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
            const std = Math.sqrt(variance);
            
            console.log(`\n📈 向量统计信息:`);
            console.log(`   最小值 (min): ${min.toFixed(6)}`);
            console.log(`   最大值 (max): ${max.toFixed(6)}`);
            console.log(`   平均值 (mean): ${mean.toFixed(6)}`);
            console.log(`   标准差 (std): ${std.toFixed(6)}`);
            console.log(`   总和 (sum): ${sum.toFixed(6)}`);
            
            // 显示零值和非零值统计
            const zeros = embedding.filter(v => Math.abs(v) < 1e-10).length;
            const nonZeros = embedding.length - zeros;
            console.log(`   零值数量: ${zeros} (${(zeros / embedding.length * 100).toFixed(2)}%)`);
            console.log(`   非零值数量: ${nonZeros} (${(nonZeros / embedding.length * 100).toFixed(2)}%)`);
          }
        } else {
          // 只显示预览
          console.log(`   向量预览: [${record.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
          console.log(`   💡 提示: 使用 --show-vector 查看完整向量，--full-vector 查看完整向量和统计信息`);
        }
      }
      
      console.log('');
    });
    
    console.log(`${'─'.repeat(80)}`);
    console.log(`\n✓ 显示完成 (${records.length}/${totalCount} 条记录)`);
    
  } catch (error) {
    console.error(`\n✗ 查看失败: ${error.message}`);
    if (error.message.includes('not found') || error.message.includes('不存在')) {
      console.error(`\n💡 提示: 集合 "${collectionName}" 不存在`);
      console.error(`   使用以下命令查看所有集合:`);
      console.error(`   node scripts/view-chroma-db.js ${mode}`);
    }
  }
}

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let mode = config.vectorStore.mode || 'server';
  let collectionName = null;
  let limit = 50;
  let showVector = false;
  let fullVector = false;
  
  // 解析参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--show-vector') {
      showVector = true;
    } else if (arg === '--full-vector') {
      fullVector = true;
      showVector = true; // full-vector 包含 show-vector
    } else if (arg === '--help' || arg === '-h') {
      console.log('Chroma 数据库查看工具');
      console.log('\n用法:');
      console.log('  node scripts/view-chroma-db.js [mode] [collection] [limit] [options]');
      console.log('\n参数:');
      console.log('  mode              存储模式: persistent 或 server (默认: server)');
      console.log('  collection        集合名称 (可选，不指定则列出所有集合)');
      console.log('  limit             显示记录数限制 (默认: 50)');
      console.log('\n选项:');
      console.log('  --show-vector     显示完整向量数据');
      console.log('  --full-vector     显示完整向量数据和统计信息');
      console.log('  --help, -h        显示帮助信息');
      console.log('\n示例:');
      console.log('  node scripts/view-chroma-db.js                    # 查看所有集合');
      console.log('  node scripts/view-chroma-db.js persistent         # 查看 persistent 模式的所有集合');
      console.log('  node scripts/view-chroma-db.js server kb_documents # 查看 server 模式的 kb_documents 集合');
      console.log('  node scripts/view-chroma-db.js server kb_documents 10 # 查看前10条记录');
      console.log('  node scripts/view-chroma-db.js server kb_documents 10 --show-vector # 显示完整向量');
      console.log('  node scripts/view-chroma-db.js server kb_documents 10 --full-vector # 显示完整向量和统计信息');
      process.exit(0);
    } else if (i === 0 && (arg === 'persistent' || arg === 'server')) {
      mode = arg;
    } else if (i === 1 && !arg.startsWith('--')) {
      collectionName = arg;
    } else if (i === 2 && !arg.startsWith('--') && !isNaN(parseInt(arg))) {
      limit = parseInt(arg);
    }
  }
  
  if (mode !== 'persistent' && mode !== 'server') {
    console.error('❌ 错误: 模式必须是 "persistent" 或 "server"');
    console.error('使用 --help 查看帮助信息');
    process.exit(1);
  }
  
  if (collectionName) {
    // 查看指定集合
    await viewCollection(mode, collectionName, limit, showVector, fullVector);
  } else {
    // 列出所有集合
    const collections = await listCollections(mode);
    
    if (collections.length > 0) {
      console.log(`\n💡 提示: 使用以下命令查看集合的详细内容`);
      console.log(`   node scripts/view-chroma-db.js ${mode} <collection_name> [limit] [--show-vector|--full-vector]`);
      console.log(`\n例如:`);
      const firstCollectionName = typeof collections[0] === 'string' ? collections[0] : collections[0].name;
      console.log(`   node scripts/view-chroma-db.js ${mode} ${firstCollectionName} 10`);
      console.log(`   node scripts/view-chroma-db.js ${mode} ${firstCollectionName} 10 --full-vector`);
    }
  }
}

main().catch(error => {
  console.error('\n未处理的错误:', error);
  process.exit(1);
});

