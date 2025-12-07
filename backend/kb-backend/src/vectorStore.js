const fs = require('fs-extra');
const { v4: uuid } = require('uuid');
const logger = require('../../shared/utils/logger');

class JsonVectorStore {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.records = [];
    this.loaded = false;
  }

  async init() {
    await fs.ensureFile(this.storagePath);
    const raw = await fs.readFile(this.storagePath, 'utf-8');
    if (raw) {
      try {
        this.records = JSON.parse(raw);
      } catch (error) {
        logger.warn('Vector store file was corrupted, starting fresh');
        this.records = [];
      }
    }
    this.loaded = true;
    return this;
  }

  async persist() {
    await fs.writeJson(this.storagePath, this.records, { spaces: 2 });
  }

  async addMany(chunks) {
    if (!this.loaded) await this.init();
    const payload = chunks.map((chunk) => ({
      id: chunk.id || uuid(),
      embedding: chunk.embedding,
      text: chunk.text,
      metadata: chunk.metadata,
      createdAt: new Date().toISOString()
    }));
    this.records.push(...payload);
    await this.persist();
    return payload.map((p) => p.id);
  }

  async list(limit = 50) {
    if (!this.loaded) await this.init();
    return this.records.slice(-limit).reverse();
  }

  async listAll() {
    if (!this.loaded) await this.init();
    return [...this.records];
  }

  async count() {
    if (!this.loaded) await this.init();
    return this.records.length;
  }

  async similaritySearch(queryEmbedding, topK = 5, filterFn) {
    if (!this.loaded) await this.init();
    const scored = this.records
      .filter((record) => (typeof filterFn === 'function' ? filterFn(record) : true))
      .map((record) => ({
        ...record,
        score: cosineSimilarity(queryEmbedding, record.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  }

  async removeWhere(filterFn) {
    if (!this.loaded) await this.init();
    const before = this.records.length;
    this.records = this.records.filter((record) => !filterFn(record));
    const removed = before - this.records.length;
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  async updateWhere(filterFn, updater) {
    if (!this.loaded) await this.init();
    let updated = 0;
    this.records = this.records.map((record) => {
      if (filterFn(record)) {
        updated += 1;
        const next = { ...record };
        updater(next);
        return next;
      }
      return record;
    });
    if (updated > 0) {
      await this.persist();
    }
    return updated;
  }
}

const cosineSimilarity = (a, b) => {
  const dot = a.reduce((acc, val, idx) => acc + val * b[idx], 0);
  const normA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));
  return dot / (normA * normB + 1e-10);
};

module.exports = JsonVectorStore;

