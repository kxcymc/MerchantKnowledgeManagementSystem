require('dotenv').config({ path: '.env.local' });
const db = require('../services/database');
const { scanKnowledgeBase } = require('../services/pdfScanner');

async function main() {
    console.log('🚀 开始扫描PDF知识库...\n');

    try {
        const pdfData = await scanKnowledgeBase();

        // 将扫描结果存入SQLite（仅记录，不处理）
        const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO knowledge (file_path, category, file_mtime)
      VALUES (@filePath, @category, @mtime)
    `);

        const updateStmt = db.prepare(`
      UPDATE knowledge 
      SET file_mtime = @mtime, status = 'pending' 
      WHERE file_path = @filePath AND file_mtime != @mtime
    `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insertStmt.run(item);
                updateStmt.run(item);
            }
        });

        insertMany(pdfData.map(p => ({
            filePath: p.filePath,
            category: p.category,
            mtime: p.mtime
        })));

        console.log('\n💾 扫描结果已同步到SQLite');
        console.log('📌 下一步: 执行阶段3的向量化处理');
    } catch (error) {
        console.error('❌ 扫描失败:', error.message);
        process.exit(1);
    }
}

main();