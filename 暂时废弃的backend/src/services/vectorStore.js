const { ChromaClient } = require('chromadb');
const path = require('path');
const fs = require('fs');

const CHROMA_PATH = path.resolve(__dirname, '../data/chroma');

// 确保Chroma目录存在
if (!fs.existsSync(CHROMA_PATH)) {
    fs.mkdirSync(CHROMA_PATH, { recursive: true });
}

const client = new ChromaClient();

// 单独的 async 函数处理主要逻辑
async function main() {
    // switch `createCollection` to `getOrCreateCollection` to avoid creating a new collection every time
    const collection = await client.getOrCreateCollection({
        name: "my_collection",
    });

    // switch `addRecords` to `upsertRecords` to avoid adding the same documents every time
    await collection.upsert({
        documents: [
            "This is a document about pineapple",
            "This is a document about oranges",
        ],
        ids: ["id1", "id2"],
    });

    const results = await collection.query({
        queryTexts: ["This is a query document about florida"], // Chroma will embed this for you
        nResults: 2, // how many results to return
    });

    console.log(results);
}

// 调用函数并处理错误
main().catch(console.error);

/**
 * 获取或创建knowledge集合
 * @param {Object} embeddingFunction - 自定义embedding函数
 * @returns {Promise<Collection>}
 */
async function getKnowledgeCollection(embeddingFunction) {
    try {
        // const collection = await client.getOrCreateCollection({
        //     name: 'knowledge',
        //     embeddingFunction: embeddingFunction,
        //     metadata: { description: '抖音电商知识库向量存储' }
        // });
        console.log('✅ ChromaDB knowledge集合就绪');
        // return collection;
    } catch (error) {
        console.error('❌ ChromaDB初始化失败:', error.message);
        throw error;
    }
}

module.exports = { client, getKnowledgeCollection, CHROMA_PATH };