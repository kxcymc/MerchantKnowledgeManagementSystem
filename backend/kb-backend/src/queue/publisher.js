const amqp = require('amqplib');
const config = require('../config');
const logger = require('../../../shared/utils/logger');

const queueEnabled = Boolean(config.queue.url);
let channelPromise = null;

async function getChannel() {
  if (!queueEnabled) throw new Error('RabbitMQ 未启用');
  if (channelPromise) return channelPromise;
  channelPromise = amqp
    .connect(config.queue.url)
    .then((conn) => conn.createChannel())
    .then(async (channel) => {
      await channel.assertQueue(config.queue.name, { durable: true });
      logger.info('RabbitMQ channel ready');
      return channel;
    })
    .catch((error) => {
      logger.error('RabbitMQ 连接失败', { error: error.message });
      channelPromise = null;
      throw error;
    });
  return channelPromise;
}

async function publishJob(job) {
  if (!queueEnabled) return false;
  const channel = await getChannel();
  channel.sendToQueue(config.queue.name, Buffer.from(JSON.stringify(job)), { persistent: true });
  return true;
}

module.exports = {
  publishJob,
  queueEnabled
};

