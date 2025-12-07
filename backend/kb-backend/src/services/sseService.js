const EventEmitter = require('events');
const logger = require('../../../shared/utils/logger');

/**
 * SSE (Server-Sent Events) 服务
 * 用于向前端推送实时通知
 */
class SSEService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // clientId -> response
    this.clientCounter = 0;
  }

  /**
   * 添加客户端连接
   * @param {express.Response} res - Express 响应对象
   * @returns {string} 客户端ID
   */
  addClient(res) {
    const clientId = `client_${Date.now()}_${++this.clientCounter}`;
    
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
    
    // 发送初始连接消息
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
    
    // 保存客户端连接
    this.clients.set(clientId, res);
    
    logger.info('SSE 客户端已连接', { clientId, totalClients: this.clients.size });
    
    // 监听客户端断开
    res.on('close', () => {
      this.removeClient(clientId);
    });
    
    return clientId;
  }

  /**
   * 移除客户端连接
   * @param {string} clientId - 客户端ID
   */
  removeClient(clientId) {
    const res = this.clients.get(clientId);
    if (res) {
      this.clients.delete(clientId);
      logger.info('SSE 客户端已断开', { clientId, totalClients: this.clients.size });
    }
  }

  /**
   * 向所有客户端发送消息
   * @param {object} data - 要发送的数据
   */
  broadcast(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    let sentCount = 0;
    
    for (const [clientId, res] of this.clients.entries()) {
      try {
        res.write(message);
        sentCount++;
      } catch (error) {
        logger.warn('发送 SSE 消息失败', { clientId, error: error.message });
        this.removeClient(clientId);
      }
    }
    
    if (sentCount > 0) {
      logger.debug('SSE 消息已广播', { sentCount, totalClients: this.clients.size });
    }
  }

  /**
   * 向特定客户端发送消息
   * @param {string} clientId - 客户端ID
   * @param {object} data - 要发送的数据
   */
  sendToClient(clientId, data) {
    const res = this.clients.get(clientId);
    if (res) {
      try {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        res.write(message);
        logger.debug('SSE 消息已发送', { clientId });
      } catch (error) {
        logger.warn('发送 SSE 消息失败', { clientId, error: error.message });
        this.removeClient(clientId);
      }
    }
  }

  /**
   * 发送知识处理完成通知
   * @param {object} data - 通知数据 { knowledge_id, chunks, status, message }
   */
  notifyKnowledgeProcessed(data) {
    this.broadcast({
      type: 'knowledge_processed',
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * 发送知识处理失败通知
   * @param {object} data - 错误数据 { knowledge_id, error, message }
   */
  notifyKnowledgeFailed(data) {
    this.broadcast({
      type: 'knowledge_failed',
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * 获取当前连接的客户端数量
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }
}

// 创建单例
const sseService = new SSEService();

module.exports = sseService;

