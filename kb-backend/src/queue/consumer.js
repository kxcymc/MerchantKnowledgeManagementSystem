const amqp = require('amqplib');
const config = require('../config');
const logger = require('../utils/logger');
const { ingestFile, ingestRawText } = require('../services/ingestService');
const uploadService = require('../services/uploadService');
const knowledgeService = require('../services/knowledgeService');

let consumerConnection = null;
let consumerChannel = null;
let isConsuming = false;

/**
 * 启动队列消费者（集成到服务器内部）
 */
async function startConsumer() {
  if (!config.queue.url) {
    logger.warn('RabbitMQ 未配置，队列消费者未启动');
    return;
  }

  if (isConsuming) {
    logger.warn('队列消费者已在运行');
    return;
  }

  try {
    logger.info(`正在连接 RabbitMQ: ${config.queue.url}`);
    consumerConnection = await amqp.connect(config.queue.url);
    
    consumerConnection.on('error', (error) => {
      logger.error('RabbitMQ 连接错误', { error: error.message });
      isConsuming = false;
    });

    consumerConnection.on('close', () => {
      logger.warn('RabbitMQ 连接已关闭');
      isConsuming = false;
      // 尝试重连（延迟重连避免频繁尝试）
      setTimeout(() => {
        if (!isConsuming) {
          logger.info('尝试重新连接 RabbitMQ...');
          startConsumer().catch(err => {
            logger.error('重连失败', { error: err.message });
          });
        }
      }, 5000);
    });

    consumerChannel = await consumerConnection.createChannel();
    await consumerChannel.assertQueue(config.queue.name, { durable: true });
    
    // 设置预取数量为1，确保一次只处理一个任务
    await consumerChannel.prefetch(1);
    
    logger.info(`队列消费者已启动，监听队列 ${config.queue.name}`);
    logger.info('等待任务...');
    isConsuming = true;

    consumerChannel.consume(
      config.queue.name,
      async (msg) => {
        if (!msg) {
          logger.warn('收到空消息');
          return;
        }
        
        const startTime = Date.now();
        let job;
        
        try {
          job = JSON.parse(msg.content.toString());
          logger.info('收到队列任务', { type: job.type });
          
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
            const chunkCount = await ingestFile(job.payload);
            logger.info('文件处理完成', { 
              filename: job.payload.originalName, 
              chunks: chunkCount 
            });
          } else if (job.type === 'file_batch') {
            const files = job.payload || [];
            logger.info('开始批量处理文件', { count: files.length });
            let totalChunks = 0;
            for (const payload of files) {
              const chunkCount = await ingestFile(payload);
              totalChunks += chunkCount;
              logger.info('文件处理完成', { 
                filename: payload.originalName, 
                chunks: chunkCount 
              });
            }
            logger.info('批量文件处理完成', { 
              total: files.length, 
              totalChunks 
            });
          } else if (job.type === 'text') {
            const chunkCount = await ingestRawText(job.payload);
            logger.info('文本处理完成', { 
              title: job.payload.title, 
              chunks: chunkCount 
            });
          } else if (job.type === 'delete_files') {
            const paths = job.payload?.storagePaths || [];
            logger.info('开始批量删除文件', { count: paths.length });
            for (const storagePath of paths) {
              await uploadService.deleteUpload(storagePath);
            }
            logger.info('批量删除完成', { total: paths.length });
          } else if (job.type === 'expire_files') {
            const paths = job.payload?.storagePaths || [];
            const expired = Boolean(job.payload?.expired);
            logger.info('开始批量更新过期状态', { 
              count: paths.length, 
              expired 
            });
            for (const storagePath of paths) {
              await uploadService.setUploadExpired(storagePath, expired);
            }
            logger.info('批量更新完成', { total: paths.length });
          } else {
            logger.warn('未知任务类型', { type: job.type });
          }
          
          const duration = Date.now() - startTime;
          consumerChannel.ack(msg);
          logger.info('任务处理成功', { 
            type: job.type, 
            duration: `${duration}ms` 
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          logger.error('任务执行失败', { 
            type: job?.type || 'unknown',
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`
          });
          // 任务失败时不重新入队，避免无限循环
          consumerChannel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );

  } catch (error) {
    logger.error('队列消费者启动失败', { 
      error: error.message, 
      stack: error.stack 
    });
    isConsuming = false;
    
    if (error.message.includes('ECONNREFUSED')) {
      logger.error('无法连接到 RabbitMQ，请检查：');
      logger.error('1. RabbitMQ 服务是否已启动');
      logger.error('2. RABBIT_URL 配置是否正确');
      logger.warn('队列消费者未启动，但服务器仍可正常处理同步请求');
    }
  }
}

/**
 * 停止队列消费者
 */
async function stopConsumer() {
  if (!isConsuming) {
    return;
  }

  logger.info('正在停止队列消费者...');
  isConsuming = false;

  try {
    if (consumerChannel) {
      await consumerChannel.close();
      consumerChannel = null;
    }
    if (consumerConnection) {
      await consumerConnection.close();
      consumerConnection = null;
    }
    logger.info('队列消费者已停止');
  } catch (error) {
    logger.error('停止队列消费者时出错', { error: error.message });
  }
}

/**
 * 检查消费者是否在运行
 */
function isConsumerRunning() {
  return isConsuming;
}

module.exports = {
  startConsumer,
  stopConsumer,
  isConsumerRunning
};

