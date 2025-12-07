const DashScopeEmbeddings = require('../../../shared/utils/dashscopeEmbeddings');
const config = require('../config');

let embeddingsInstance = null;

function getEmbeddings() {
  if (!embeddingsInstance) {
    embeddingsInstance = new DashScopeEmbeddings({
      dashScopeApiKey: config.dashScopeKey,
      model: 'text-embedding-v3'
    });
  }
  return embeddingsInstance;
}

module.exports = {
  getEmbeddings
};

