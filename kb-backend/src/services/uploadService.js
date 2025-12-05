const path = require('path');
const fs = require('fs-extra');
const config = require('../config');
const { vectorStore } = require('./ingestService');
const logger = require('../utils/logger');

const normalizePath = (p = '') => p.replace(/\\/g, '/');

const withinUploadsDir = (targetPath) => {
  const absUploads = path.resolve(config.uploadDir);
  const absTarget = path.resolve(targetPath);
  return absTarget.startsWith(absUploads);
};

const resolveStoragePath = (storagePath) => {
  if (!storagePath) throw new Error('storagePath 必填');
  const absPath = path.resolve(storagePath);
  if (!withinUploadsDir(absPath)) {
    throw new Error('无效的文件路径');
  }
  return absPath;
};

const listUploads = async () => {
  const records = await vectorStore.listAll();
  const grouped = new Map();

  records.forEach((record) => {
    const meta = record.metadata || {};
    if (meta.sourceType !== 'file' || !meta.storagePath) return;

    const normalizedPath = normalizePath(meta.storagePath);

    if (!grouped.has(normalizedPath)) {
      grouped.set(normalizedPath, {
        storagePath: normalizedPath,
        filename: meta.filename || path.basename(meta.storagePath),
        uploadedBy: meta.uploadedBy || 'unknown',
        mimeType: meta.mimeType || 'unknown',
        expired: Boolean(meta.expired),
        expiredAt: meta.expiredAt || null,
        createdAt: record.createdAt,
        chunkCount: 0,
        fileSize: null,
        exists: null
      });
    }
    const entry = grouped.get(normalizedPath);
    entry.chunkCount += 1;
    entry.expired = entry.expired || Boolean(meta.expired);
    if (!entry.createdAt || (record.createdAt && record.createdAt < entry.createdAt)) {
      entry.createdAt = record.createdAt;
    }
  });

  await Promise.all(
    Array.from(grouped.values()).map(async (entry) => {
      try {
        const absPath = path.resolve(entry.storagePath);
        const stat = await fs.stat(absPath);
        entry.exists = true;
        entry.fileSize = stat.size;
      } catch (error) {
        entry.exists = false;
        entry.fileSize = null;
      }
    })
  );

  return Array.from(grouped.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

const deleteUpload = async (storagePath) => {
  const normalized = normalizePath(storagePath);
  const absPath = resolveStoragePath(normalized);
  await fs.remove(absPath);
  const removedChunks = await vectorStore.removeWhere(
    (record) => record.metadata?.sourceType === 'file' && normalizePath(record.metadata?.storagePath) === normalized
  );
  logger.info('已删除上传文件', { storagePath: normalized, removedChunks });
  return { removedChunks };
};

const setUploadExpired = async (storagePath, expired) => {
  const normalized = normalizePath(storagePath);
  const timestamp = expired ? new Date().toISOString() : null;
  const updatedChunks = await vectorStore.updateWhere(
    (record) => record.metadata?.sourceType === 'file' && normalizePath(record.metadata?.storagePath) === normalized,
    (next) => {
      next.metadata = { ...(next.metadata || {}), expired, expiredAt: timestamp };
    }
  );
  logger.info('已更新过期状态', { storagePath: normalized, expired, updatedChunks });
  return { updatedChunks };
};

module.exports = {
  listUploads,
  deleteUpload,
  setUploadExpired
};

