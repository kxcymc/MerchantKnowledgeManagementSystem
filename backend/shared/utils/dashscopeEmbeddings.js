const axios = require('axios');

class DashScopeEmbeddings {
  constructor(options = {}) {
    this.apiKey = options.dashScopeApiKey || options.apiKey;
    this.model = options.model || 'text-embedding-v3';
    this.baseURL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
    if (!this.apiKey) {
      throw new Error('DashScope API key is required');
    }
  }

  async embedDocuments(texts) {
    const embeddings = [];
    const batchSize = 10; // DashScope API 官方限制单次最多 10 条
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await this.embedBatch(batch);
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }

  async embedBatch(texts) {
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          input: {
            texts: texts
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.output && response.data.output.embeddings) {
        return response.data.output.embeddings.map(item => item.embedding);
      }
      throw new Error('Invalid response from DashScope API');
    } catch (error) {
      if (error.response) {
        throw new Error(`DashScope API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`DashScope embedding failed: ${error.message}`);
    }
  }

  async embedQuery(text) {
    const results = await this.embedBatch([text]);
    return results[0];
  }
}

module.exports = DashScopeEmbeddings;

