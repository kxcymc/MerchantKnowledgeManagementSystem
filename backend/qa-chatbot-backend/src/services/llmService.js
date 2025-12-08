const { ChatOpenAI } = require('@langchain/openai');
const config = require('../config');
const logger = require('../../../shared/utils/logger');

class LLMService {
  constructor() {
    this.currentProvider = config.llm.provider || 'volcano_ark';
    this.currentModel = config.llm.model || '';
    this.llm = null;
    this.initLLM();
  }

  /**
   * 获取指定 provider 的配置
   */
  getProviderConfig(provider) {
    const providerMap = {
      'volcano_ark': {
        apiKey: config.volcanoArkKey,
        baseURL: config.llm.baseURL || config.volcanoArkBaseURL,
        defaultModel: 'doubao-seed-1-6-flash-250828'
      },
      'deepseek': {
        apiKey: config.deepSeekKey,
        baseURL: config.llm.baseURL || config.deepSeekBaseURL,
        defaultModel: 'deepseek-chat'
      },
      'qwen': {
        apiKey: config.dashScopeKey,
        baseURL: config.llm.baseURL || config.dashScopeBaseURL,
        defaultModel: 'qwen-turbo',
        // 多模态模型选项：'qwen-vl-max', 'qwen3-vl-flash', 'qwen3-livetranslate-flash'
        multimodalModels: ['qwen-vl-max', 'qwen3-vl-flash', 'qwen3-livetranslate-flash']
      }
    };

    return providerMap[provider] || providerMap['volcano_ark'];
  }

  /**
   * 初始化 LLM
   */
  initLLM(provider = null, model = null) {
    const targetProvider = provider || this.currentProvider;
    const targetModel = model || this.currentModel || config.llm.model;
    
    const providerConfig = this.getProviderConfig(targetProvider);
    
    if (!providerConfig.apiKey) {
      logger.warn(`LLM Provider ${targetProvider} 的 API Key 未配置，尝试使用默认配置`);
    }

    // 如果没有指定模型，使用该 provider 的默认模型
    const actualModel = targetModel || providerConfig.defaultModel;

    try {
      this.llm = new ChatOpenAI({
        modelName: actualModel,
        temperature: config.llm.temperature,
        openAIApiKey: providerConfig.apiKey,
        configuration: {
          baseURL: providerConfig.baseURL
        },
        // 注意：虽然这里设置为 false，但当使用 chain.stream() 调用时，
        // LangChain 会自动启用流式处理，所有模型（volcano_ark、deepseek、qwen）都支持流式处理
        streaming: false
      });

      this.currentProvider = targetProvider;
      this.currentModel = actualModel;

      logger.info('LLM 初始化成功', {
        provider: targetProvider,
        model: actualModel,
        baseURL: providerConfig.baseURL
      });
    } catch (error) {
      logger.error('LLM 初始化失败', {
        provider: targetProvider,
        model: actualModel,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 切换模型
   */
  switchModel(provider, model = null) {
    if (!provider) {
      throw new Error('Provider 不能为空');
    }

    const validProviders = ['volcano_ark', 'deepseek', 'qwen'];
    if (!validProviders.includes(provider)) {
      throw new Error(`不支持的 Provider: ${provider}，支持的 Provider: ${validProviders.join(', ')}`);
    }

    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig.apiKey) {
      throw new Error(`Provider ${provider} 的 API Key 未配置，请在环境变量中设置`);
    }

    // 如果没有指定模型，使用该 provider 的默认模型
    const actualModel = model || providerConfig.defaultModel;

    this.initLLM(provider, actualModel);
    
    logger.info('模型切换成功', {
      provider: provider,
      model: actualModel
    });

    return {
      provider: this.currentProvider,
      model: this.currentModel
    };
  }

  /**
   * 获取当前模型信息
   */
  getCurrentModel() {
    return {
      provider: this.currentProvider,
      model: this.currentModel
    };
  }

  /**
   * 获取可用的模型列表
   */
  getAvailableModels() {
    const models = [
      {
        provider: 'volcano_ark',
        name: '豆包seed',
        model: config.llm.model || 'doubao-seed-1-6-flash-250828',
        available: !!config.volcanoArkKey
      },
      {
        provider: 'deepseek',
        name: 'DeepSeek',
        model: 'deepseek-chat',
        available: !!config.deepSeekKey
      },
      {
        provider: 'qwen',
        name: '千问',
        model: 'qwen-turbo',
        available: !!config.dashScopeKey
      }
    ];

    return models;
  }

  /**
   * 获取 LLM 实例
   */
  getLLM() {
    if (!this.llm) {
      this.initLLM();
    }
    return this.llm;
  }
}

module.exports = new LLMService();

