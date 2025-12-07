const dbService = require('./dbService');
const config = require('../config');
const llmService = require('./llmService');
const logger = require('../../../shared/utils/logger');

class MemoryService {
  constructor() {
    this.memories = new Map(); // session_id -> { messages: [], summary: null, middleKeyPoints: null }
    this.llm = null;
    this.initLLM();
  }

  /**
   * 初始化 LLM（用于生成摘要和提取关键信息）
   */
  initLLM() {
    try {
      // 使用 LLM 服务获取 LLM 实例，但使用较低温度用于摘要
      const baseLLM = llmService.getLLM();
      // 创建一个新的实例，但使用较低温度
      const { ChatOpenAI } = require('@langchain/openai');
      const providerConfig = llmService.getProviderConfig(llmService.currentProvider);
      
      this.llm = new ChatOpenAI({
        modelName: llmService.currentModel,
        temperature: 0.3, // 摘要使用较低温度，更稳定
        openAIApiKey: providerConfig.apiKey,
        configuration: {
          baseURL: providerConfig.baseURL
        },
        streaming: false
      });
    } catch (error) {
      logger.warn('LLM 初始化失败，摘要功能将使用简化版本', { error: error.message });
      this.llm = null;
    }
  }

  /**
   * 切换模型
   */
  switchModel(provider, model = null) {
    llmService.switchModel(provider, model);
    this.initLLM(); // 重新初始化 LLM
  }

  /**
   * 获取会话的 Memory
   */
  getMemory(sessionId) {
    if (!this.memories.has(sessionId)) {
      this.memories.set(sessionId, {
        messages: [],
        summary: null,
        middleKeyPoints: null
      });
    }
    return this.memories.get(sessionId);
  }

  /**
   * 估算 Token 数量
   */
  estimateTokens(text) {
    // 粗略估算：1 token ≈ 4 字符
    return Math.ceil(text.length / 4);
  }

  /**
   * 使用 LLM 生成对话摘要
   */
  async generateSummaryWithLLM(messages) {
    if (!this.llm || messages.length === 0) {
      return null;
    }

    try {
      const conversationText = messages
        .map(msg => `${msg.role === 'human' ? '用户' : '助手'}: ${msg.content}`)
        .join('\n\n');

      const summaryPrompt = `请将以下对话内容压缩为简洁的摘要，保留关键信息和上下文。摘要应该简洁明了，突出用户的主要问题和助手的回答要点：

${conversationText}

请用简洁的语言总结这段对话的核心内容：`;

      const response = await this.llm.invoke(summaryPrompt);
      const summary = response.content;

      logger.info('LLM 生成摘要成功', { 
        originalMessages: messages.length,
        summaryLength: summary.length,
        summaryTokens: this.estimateTokens(summary)
      });

      return summary;
    } catch (error) {
      logger.error('LLM 生成摘要失败，使用简化版本', { error: error.message });
      // 降级处理：使用简化版本
      return messages
        .map(msg => `${msg.role === 'human' ? '用户' : '助手'}: ${msg.content.substring(0, 100)}`)
        .join(' | ');
    }
  }

  /**
   * 使用 LLM 提取关键信息（中间层）
   */
  async extractKeyPointsWithLLM(messages) {
    if (!this.llm || messages.length === 0) {
      return null;
    }

    try {
      const conversationText = messages
        .map(msg => `${msg.role === 'human' ? '用户' : '助手'}: ${msg.content}`)
        .join('\n\n');

      const keyPointsPrompt = `请从以下对话中提取关键信息点，包括：
1. 用户提出的主要问题
2. 重要的决策或结论
3. 需要记住的上下文信息

请用简洁的要点形式列出（每条不超过50字）：

${conversationText}

关键信息点：`;

      const response = await this.llm.invoke(keyPointsPrompt);
      const keyPoints = response.content;

      logger.info('LLM 提取关键信息成功', { 
        originalMessages: messages.length,
        keyPointsLength: keyPoints.length,
        keyPointsTokens: this.estimateTokens(keyPoints)
      });

      return keyPoints;
    } catch (error) {
      logger.error('LLM 提取关键信息失败，使用简化版本', { error: error.message });
      // 降级处理：提取用户问题
      return messages
        .filter(msg => msg.role === 'human')
        .map(msg => `用户问题: ${msg.content.substring(0, 80)}`)
        .join('\n');
    }
  }

  /**
   * 分层记忆加载策略
   * - 早期层：摘要（如果token不够才生成）
   * - 中间层：关键信息提取
   * - 最近层：完整保留原问题
   */
  async loadHistoryFromDB(sessionId) {
    const memory = this.getMemory(sessionId);
    const allMessages = await dbService.getMessagesBySessionId(sessionId);
    
    if (allMessages.length === 0) {
      memory.messages = [];
      return [];
    }

    const maxTokens = config.rag.maxContextTokens * 0.8;
    const summaryTokenBudget = Math.floor(maxTokens * config.memory.summaryTokenRatio);
    const middleTokenBudget = Math.floor(maxTokens * config.memory.middleTokenRatio);
    const recentTokenBudget = Math.floor(maxTokens * config.memory.recentTokenRatio);

    // 计算各层的消息范围
    const totalMessages = allMessages.length;
    const recentCount = Math.min(config.memory.windowSize * 2, totalMessages);
    const middleCount = Math.min(config.memory.middleLayerSize * 2, Math.max(0, totalMessages - recentCount));
    const oldCount = totalMessages - recentCount - middleCount;

    const result = [];
    let totalTokenCount = 0;

    // ========== 第一层：最近层（完整保留） ==========
    const recentMessages = allMessages.slice(-recentCount);
    const recentLangchainMessages = [];
    let recentTokenCount = 0;

    for (const msg of recentMessages) {
      const msgTokens = this.estimateTokens(msg.content);
      if (recentTokenCount + msgTokens > recentTokenBudget) {
        break;
      }

      recentLangchainMessages.push({
        role: msg.role === 'user' ? 'human' : 'ai',
        content: msg.content
      });
      recentTokenCount += msgTokens;
    }

    totalTokenCount += recentTokenCount;

    // ========== 第二层：中间层（关键信息提取） ==========
    let middleKeyPoints = memory.middleKeyPoints;
    let middleTokenCount = 0;

    if (middleCount > 0) {
      const middleMessages = allMessages.slice(-recentCount - middleCount, -recentCount);
      
      // 如果中间层消息存在且没有关键信息，或者关键信息过期，则提取
      if (!middleKeyPoints || middleMessages.length > 0) {
        const middleLangchainMessages = middleMessages.map(msg => ({
          role: msg.role === 'user' ? 'human' : 'ai',
          content: msg.content
        }));

        // 提取关键信息
        middleKeyPoints = await this.extractKeyPointsWithLLM(middleLangchainMessages);
        memory.middleKeyPoints = middleKeyPoints;
      }

      if (middleKeyPoints) {
        middleTokenCount = this.estimateTokens(middleKeyPoints);
        if (middleTokenCount <= middleTokenBudget) {
          result.push({
            role: 'system',
            content: `中间对话的关键信息：\n${middleKeyPoints}`
          });
          totalTokenCount += middleTokenCount;
        }
      }
    }

    // ========== 第三层：早期层（摘要） ==========
    // 关键：只在token不够时才生成摘要
    let summary = memory.summary;
    let summaryTokenCount = 0;

    if (oldCount > 0) {
      const oldMessages = allMessages.slice(0, -recentCount - middleCount);
      
      // 检查是否需要生成摘要
      // 1. 如果token已经不够了，需要生成摘要
      // 2. 或者如果旧消息很多但没有摘要，也需要生成
      const remainingTokenBudget = maxTokens - totalTokenCount;
      const needsSummary = remainingTokenBudget < summaryTokenBudget && oldMessages.length > 0;

      if (needsSummary && !summary) {
        // 只有在token不够时才生成摘要
        logger.info('Token不足，开始生成早期对话摘要', { 
          sessionId,
          oldMessagesCount: oldMessages.length,
          currentTokenCount: totalTokenCount,
          maxTokens,
          remainingBudget: remainingTokenBudget
        });

        const oldLangchainMessages = oldMessages.map(msg => ({
          role: msg.role === 'user' ? 'human' : 'ai',
          content: msg.content
        }));

        summary = await this.generateSummaryWithLLM(oldLangchainMessages);
        memory.summary = summary;
      }

      // 如果有摘要，添加到结果中
      if (summary) {
        summaryTokenCount = this.estimateTokens(summary);
        if (summaryTokenCount <= summaryTokenBudget && totalTokenCount + summaryTokenCount <= maxTokens) {
          result.push({
            role: 'system',
            content: `早期对话摘要：\n${summary}`
          });
          totalTokenCount += summaryTokenCount;
        }
      }
    }

    // ========== 合并所有层 ==========
    // 先添加摘要（最早），再添加关键信息（中间），最后添加最近消息（最新）
    const finalMessages = [...result, ...recentLangchainMessages];

    memory.messages = finalMessages;

    logger.info('分层记忆加载完成', { 
      sessionId,
      totalMessagesInDB: totalMessages,
      oldCount,
      middleCount,
      recentCount,
      summaryTokens: summaryTokenCount,
      middleTokens: middleTokenCount,
      recentTokens: recentTokenCount,
      totalTokens: totalTokenCount,
      maxTokens,
      hasSummary: !!summary,
      hasKeyPoints: !!middleKeyPoints,
      finalMessageCount: finalMessages.length
    });

    return finalMessages;
  }

  /**
   * 添加消息到 Memory
   */
  addMessage(sessionId, role, content) {
    const memory = this.getMemory(sessionId);
    
    const langchainRole = role === 'user' ? 'human' : 'ai';
    memory.messages.push({
      role: langchainRole,
      content
    });

    // 检查是否需要清理旧消息
    this.trimMemory(sessionId);
  }

  /**
   * 清理 Memory（保持窗口大小）
   */
  trimMemory(sessionId) {
    const memory = this.getMemory(sessionId);
    const maxMessages = config.memory.windowSize * 2; // 用户和 AI 各 N 条
    
    if (memory.messages.length > maxMessages) {
      // 保留最新的消息
      memory.messages = memory.messages.slice(-maxMessages);
    }
  }

  /**
   * 获取聊天历史（用于 LangChain）
   */
  getChatHistory(sessionId) {
    const memory = this.getMemory(sessionId);
    return memory.messages || [];
  }

  /**
   * 获取摘要
   */
  getSummary(sessionId) {
    const memory = this.getMemory(sessionId);
    return memory.summary;
  }

  /**
   * 检查并生成摘要（如果消息数量超过阈值）
   * 注意：这个方法现在主要用于后处理，实际摘要生成在 loadHistoryFromDB 中按需进行
   */
  async checkAndSummarize(sessionId) {
    // 这个方法保留用于兼容性，但实际逻辑已经在 loadHistoryFromDB 中实现
    // 如果需要主动触发摘要生成，可以在这里调用
    const memory = this.getMemory(sessionId);
    const allMessages = await dbService.getMessagesBySessionId(sessionId);
    
    // 如果消息很多但没有摘要，可以考虑生成
    if (allMessages.length > config.memory.summaryThreshold * 2 && !memory.summary) {
      logger.info('消息数量超过阈值，检查是否需要生成摘要', { 
        sessionId, 
        messageCount: allMessages.length 
      });
      // 重新加载历史，会自动触发摘要生成（如果需要）
      await this.loadHistoryFromDB(sessionId);
    }
  }

  /**
   * 清除 Memory
   */
  clearMemory(sessionId) {
    this.memories.delete(sessionId);
  }
}

module.exports = new MemoryService();
