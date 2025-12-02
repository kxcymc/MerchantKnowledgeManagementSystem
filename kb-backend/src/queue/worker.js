const amqp = require('amqplib');
const config = require('../config');
const logger = require('../utils/logger');
const { ingestFile, ingestRawText } = require('../services/ingestService');
const { deleteUpload, setUploadExpired } = require('../services/uploadService');
const knowledgeService = require('../services/knowledgeService');

if (!config.queue.url) {
  logger.error('RabbitMQ 未配置，无法启动 worker');
  process.exit(1);
}

(async () => {
  let connection;
  let channel;

  try {
    logger.info(`正在连接 RabbitMQ: ${config.queue.url}`);
    connection = await amqp.connect(config.queue.url);
    channel = await connection.createChannel();
    await channel.assertQueue(config.queue.name, { durable: true });
    
    // 设置预取数量，控制并发
    await channel.prefetch(1);
    
    logger.info(`Worker 已监听队列 ${config.queue.name}`);
    logger.info('等待任务...');

    channel.consume(
      config.queue.name,
      async (msg) => {
        if (!msg) return;
        
        try {
          const job = JSON.parse(msg.content.toString());
          logger.info('收到任务', { type: job.type });
          
          if (job.type === 'knowledge_file') {
            // 处理知识库文件（已完成MySQL记录创建，只需进行向量化）
            const { knowledgeId, filePath, originalName, mimeType, business, scene, isUpdate } = job.payload;
            const result = await knowledgeService.completeFileKnowledgeProcessing(knowledgeId, {
              filePath,
              originalName,
              mimeType,
              business,
              scene,
              isUpdate: isUpdate || false
            });
            logger.info('知识库文件处理完成', { 
              knowledge_id: knowledgeId,
              filename: originalName, 
              chunks: result.chunks 
            });
          } else if (job.type === 'file') {
            await ingestFile(job.payload);
            logger.info('文件处理完成', { filename: job.payload.originalName });
          } else if (job.type === 'file_batch') {
            const files = job.payload || [];
            logger.info('开始批量处理文件', { count: files.length });
            for (const payload of files) {
              await ingestFile(payload);
              logger.info('文件处理完成', { filename: payload.originalName });
            }
            logger.info('批量文件处理完成', { total: files.length });
          } else if (job.type === 'text') {
            await ingestRawText(job.payload);
            logger.info('文本处理完成', { title: job.payload.title });
          } else if (job.type === 'delete_files') {
            const paths = job.payload?.storagePaths || [];
            logger.info('开始批量删除文件', { count: paths.length });
            for (const storagePath of paths) {
              await deleteUpload(storagePath);
            }
            logger.info('批量删除完成', { total: paths.length });
          } else if (job.type === 'expire_files') {
            const paths = job.payload?.storagePaths || [];
            const expired = Boolean(job.payload?.expired);
            logger.info('开始批量更新过期状态', { count: paths.length, expired });
            for (const storagePath of paths) {
              await setUploadExpired(storagePath, expired);
            }
            logger.info('批量更新完成', { total: paths.length });
          } else {
            logger.warn('未知任务类型', { type: job.type });
          }
          
          channel.ack(msg);
          logger.info('任务处理成功', { type: job.type });
        } catch (error) {
          logger.error('任务执行失败', { 
            error: error.message, 
            stack: error.stack 
          });
          // 任务失败时不重新入队，避免无限循环
          channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

    // 处理连接关闭
    connection.on('close', () => {
      logger.warn('RabbitMQ 连接已关闭，尝试重连...');
    });

    connection.on('error', (error) => {
      logger.error('RabbitMQ 连接错误', { error: error.message });
    });

    // 优雅关闭
    process.on('SIGINT', async () => {
      logger.info('收到停止信号，正在关闭 Worker...');
      if (channel) {
        await channel.close();
      }
      if (connection) {
        await connection.close();
      }
      process.exit(0);
    });

  } catch (error) {
    logger.error('Worker 启动失败', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
})();

