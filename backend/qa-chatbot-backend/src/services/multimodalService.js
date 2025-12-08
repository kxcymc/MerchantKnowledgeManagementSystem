const axios = require('axios');
const config = require('../config');
const logger = require('../../../shared/utils/logger');

/**
 * 多模态服务（可选工具）
 * 注意：当前系统使用端到端多模态模式，直接传递图片/音频给LLM
 * 此服务作为可选工具，可用于需要先解析再处理的场景
 */
class MultimodalService {
  constructor() {
    // 阿里云图像理解API配置（可选，用于先解析模式）
    this.aliImageApiKey = config.aliImageApiKey || '';
    this.aliImageApiUrl = config.aliImageApiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    
    // 阿里云语音识别API配置（可选，用于先解析模式）
    this.aliSpeechApiKey = config.aliSpeechApiKey || '';
    this.aliSpeechApiUrl = config.aliSpeechApiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  /**
   * 图像理解 - 调用阿里大模型进行图像分析（可选工具）
   * 注意：当前系统使用端到端模式，此方法作为可选工具保留
   * @param {Buffer|string} imageData - 图片数据（Buffer或base64字符串）
   * @param {string} prompt - 用户的问题或提示词
   * @param {string} imageType - 图片类型：'buffer' 或 'base64'
   * @returns {Promise<string>} 图像理解结果文本
   */
  async understandImage(imageData, prompt = '请详细描述这张图片的内容', imageType = 'buffer') {
    try {
      if (!this.aliImageApiKey) {
        throw new Error('阿里云图像理解API密钥未配置，请在环境变量中设置 ALI_IMAGE_API_KEY');
      }

      // 将图片转换为base64
      let base64Image;
      let imageMimeType = 'image/jpeg';
      if (imageType === 'buffer') {
        base64Image = imageData.toString('base64');
        // 尝试从buffer判断图片类型（简单判断，实际可能需要更复杂的逻辑）
        if (imageData[0] === 0x89 && imageData[1] === 0x50) {
          imageMimeType = 'image/png';
        } else if (imageData[0] === 0x47 && imageData[1] === 0x49) {
          imageMimeType = 'image/gif';
        } else if (imageData[0] === 0x52 && imageData[1] === 0x49) {
          imageMimeType = 'image/webp';
        }
      } else {
        // 从data URL中提取mime类型
        const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
          imageMimeType = mimeMatch[1];
        }
        base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
      }

      // 使用 OpenAI 兼容模式 API（与语音识别一致）
      // 构建请求体（OpenAI 兼容格式）
      const requestBody = {
        model: 'qwen-vl-max', // 或 'qwen3-vl-flash' 用于更快的响应
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMimeType};base64,${base64Image}`
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      };

      // 使用 OpenAI 兼容模式的API端点
      let apiUrl = this.aliImageApiUrl;
      // 如果配置的是旧格式URL，转换为兼容模式URL
      if (apiUrl.includes('/api/v1/services/aigc/multimodal-generation/generation')) {
        apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      } else if (!apiUrl.includes('/chat/completions')) {
        apiUrl = apiUrl.replace(/\/$/, '') + '/chat/completions';
      }

      // 发送请求
      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.aliImageApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60秒超时（图像理解可能需要更长时间）
      });

      // 解析响应（OpenAI 兼容格式）
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const choice = response.data.choices[0];
        let result = '';
        
        if (choice.message && choice.message.content) {
          if (typeof choice.message.content === 'string') {
            result = choice.message.content;
          } else if (Array.isArray(choice.message.content)) {
            // content是数组，提取text字段
            for (const item of choice.message.content) {
              if (item.type === 'text' && item.text) {
                result += item.text;
              }
            }
          }
        }
        
        logger.info('图像理解成功', { 
          promptLength: prompt.length,
          resultLength: result?.length || 0 
        });
        return result || '无法解析图像内容';
      } else {
        throw new Error('图像理解API返回格式异常');
      }
    } catch (error) {
      logger.error('图像理解失败', { 
        error: error.message,
        response: error.response?.data 
      });
      throw new Error(`图像理解失败: ${error.message}`);
    }
  }

  /**
   * 语音识别 - 调用阿里大模型进行语音转文字（可选工具）
   * 注意：当前系统使用端到端模式，此方法作为可选工具保留
   * 使用 OpenAI 兼容模式 API，支持 qwen3-livetranslate-flash 等模型
   * @param {Buffer} audioData - 音频数据（Buffer）
   * @param {string} format - 音频格式，如 'wav', 'mp3', 'm4a', 'webm' 等
   * @returns {Promise<string>} 识别出的文本
   */
  async transcribeAudio(audioData, format = 'wav') {
    try {
      logger.info('开始语音识别', { 
        audioDataLength: audioData?.length || 0,
        format: format,
        hasApiKey: !!this.aliSpeechApiKey
      });

      if (!this.aliSpeechApiKey) {
        throw new Error('阿里云语音识别API密钥未配置，请在环境变量中设置 ALI_SPEECH_API_KEY');
      }

      // 将音频转换为base64（纯base64字符串，不包含data URL前缀）
      const base64Audio = audioData.toString('base64');
      logger.info('音频转换为base64完成', { 
        base64Length: base64Audio.length,
        originalLength: audioData.length
      });
      
      // 注意：webm格式可能不被API支持，API通常支持wav、pcm等格式
      // 如果格式是webm，尝试转换为wav格式标识
      let actualFormat = format;
      if (format === 'webm' || format === 'ogg') {
        logger.warn('检测到webm/ogg格式，尝试使用wav格式标识', { originalFormat: format });
        actualFormat = 'wav';
      }
      
      // 使用 DashScope 的 qwen-audio-turbo 模型格式
      // 根据文档，qwen-audio-turbo 使用 MultiModalConversation API 格式
      // 将base64转换为data URL格式（data:audio/wav;base64,...）
      const mimeType = actualFormat === 'wav' ? 'audio/wav' : `audio/${actualFormat}`;
      const dataUrl = `data:${mimeType};base64,${base64Audio}`;
      logger.info('生成data URL', { 
        mimeType: mimeType,
        actualFormat: actualFormat,
        dataUrlLength: dataUrl.length,
        dataUrlPrefix: dataUrl.substring(0, 50) + '...'
      });
      
      // qwen-audio-turbo 使用 MultiModalConversation API（不是 OpenAI 兼容模式）
      // API端点：https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
      // 请求格式：使用 MultiModalConversation API 格式
      const requestBody = {
        model: 'qwen-audio-turbo', // 使用音频识别模型，支持语音转文字
        input: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  audio: dataUrl // 使用audio字段，值为data URL格式
                },
                {
                  text: '请将这段语音转换为文字，不需要翻译，直接输出识别的中文文本。'
                }
              ]
            }
          ]
        }
      };
      
      logger.info('语音识别请求体构建完成', { 
        model: requestBody.model,
        format: actualFormat,
        dataUrlLength: dataUrl.length,
        messagesCount: requestBody.input.messages.length,
        contentItemsCount: requestBody.input.messages[0].content.length,
        firstContentType: requestBody.input.messages[0].content[0]?.audio ? 'audio' : 'unknown',
        hasAudio: !!requestBody.input.messages[0].content[0]?.audio,
        hasText: !!requestBody.input.messages[0].content[1]?.text,
        requestBodyPreview: JSON.stringify(requestBody).substring(0, 200) + '...'
      });

      // qwen-audio-turbo 使用 MultiModalConversation API（不是兼容模式）
      // API端点：https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
      let apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
      
      // 如果配置了自定义URL，使用配置的URL（但qwen-audio-turbo必须使用MultiModalConversation API）
      if (this.aliSpeechApiUrl && !this.aliSpeechApiUrl.includes('/compatible-mode')) {
        // 如果配置的是标准API URL，检查是否是MultiModalConversation API
        if (this.aliSpeechApiUrl.includes('/multimodal-generation/generation')) {
          apiUrl = this.aliSpeechApiUrl;
        }
      }
      
      logger.info('语音识别API URL', { 
        apiUrl: apiUrl, 
        model: 'qwen-audio-turbo',
        originalUrl: this.aliSpeechApiUrl,
        apiKeyPrefix: this.aliSpeechApiKey?.substring(0, 10) + '...'
      });
      
      // 发送请求
      logger.info('准备发送语音识别请求', {
        url: apiUrl,
        method: 'POST',
        hasRequestBody: !!requestBody,
        requestBodySize: JSON.stringify(requestBody).length
      });

      let response;
      try {
        response = await axios.post(apiUrl, requestBody, {
          headers: {
            'Authorization': `Bearer ${this.aliSpeechApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30秒超时
        });
        logger.info('语音识别API请求成功', {
          status: response.status,
          statusText: response.statusText,
          hasData: !!response.data,
          responseKeys: response.data ? Object.keys(response.data) : []
        });
      } catch (axiosError) {
        logger.error('语音识别API请求失败', {
          message: axiosError.message,
          code: axiosError.code,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          responseData: axiosError.response?.data,
          requestUrl: apiUrl,
          requestMethod: 'POST',
          requestBodyPreview: JSON.stringify(requestBody).substring(0, 300)
        });
        throw axiosError;
      }

      // 解析响应（MultiModalConversation API 格式）
      logger.info('开始解析语音识别响应', {
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        fullResponse: JSON.stringify(response.data).substring(0, 500)
      });

      // MultiModalConversation API 响应格式：{ output: { choices: [...] } }
      if (response.data && response.data.output && response.data.output.choices && response.data.output.choices.length > 0) {
        const choice = response.data.output.choices[0];
        logger.info('解析choice对象', {
          hasChoice: !!choice,
          hasMessage: !!choice.message,
          hasContent: !!choice.message?.content,
          contentType: typeof choice.message?.content,
          isArray: Array.isArray(choice.message?.content)
        });

        let result = '';
        
        // 提取消息内容
        if (choice.message && choice.message.content) {
          if (typeof choice.message.content === 'string') {
            result = choice.message.content;
            logger.info('提取字符串类型content', { resultLength: result.length });
          } else if (Array.isArray(choice.message.content)) {
            // content可能是数组，提取文本部分
            logger.info('提取数组类型content', { arrayLength: choice.message.content.length });
            for (const item of choice.message.content) {
              logger.info('处理content项', {
                itemType: item.type,
                hasText: !!item.text,
                itemKeys: Object.keys(item),
                itemValue: item
              });
              // MultiModalConversation API 返回的 content 项可能没有 type 字段，直接有 text 字段
              if (item.text) {
                result += item.text;
                logger.info('提取到文本', { text: item.text, resultLength: result.length });
              } else if (item.type === 'text' && item.text) {
                // 兼容有 type 字段的情况
                result += item.text;
                logger.info('提取到文本（带type字段）', { text: item.text, resultLength: result.length });
              }
            }
          } else {
            logger.warn('未知的content类型', {
              contentType: typeof choice.message.content,
              contentValue: choice.message.content
            });
          }
        } else {
          logger.warn('响应中缺少message或content', {
            hasMessage: !!choice.message,
            hasContent: !!choice.message?.content,
            choiceKeys: Object.keys(choice)
          });
        }
        
        if (result) {
          logger.info('语音识别成功', { 
            audioSize: audioData.length,
            format: actualFormat,
            resultLength: result.length,
            resultPreview: result.substring(0, 100),
            requestId: response.data.request_id
          });
          return result;
        } else {
          logger.error('语音识别API返回结果为空', {
            responseData: JSON.stringify(response.data).substring(0, 500)
          });
          throw new Error('语音识别API返回结果为空');
        }
      } else {
        // 尝试兼容 OpenAI 格式（向后兼容）
        if (response.data && response.data.choices && response.data.choices.length > 0) {
          const choice = response.data.choices[0];
          let result = '';
          if (choice.message && choice.message.content) {
            if (typeof choice.message.content === 'string') {
              result = choice.message.content;
            } else if (Array.isArray(choice.message.content)) {
              for (const item of choice.message.content) {
                if (item.type === 'text' && item.text) {
                  result += item.text;
                }
              }
            }
          }
          if (result) {
            logger.info('语音识别成功（OpenAI兼容格式）', { 
              audioSize: audioData.length,
              format: actualFormat,
              resultLength: result.length,
              resultPreview: result.substring(0, 100)
            });
            return result;
          }
        }
        
        logger.error('语音识别API返回格式异常', {
          hasData: !!response.data,
          hasOutput: !!response.data?.output,
          hasChoices: !!response.data?.output?.choices,
          choicesLength: response.data?.output?.choices?.length || 0,
          fullResponse: JSON.stringify(response.data).substring(0, 500)
        });
        throw new Error('语音识别API返回格式异常');
      }
    } catch (error) {
      logger.error('语音识别失败', { 
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
        response: error.response?.data,
        responseStatus: error.response?.status,
        responseHeaders: error.response?.headers
      });
      throw new Error(`语音识别失败: ${error.message}`);
    }
  }

  /**
   * 检查图像理解服务是否可用
   */
  isImageServiceAvailable() {
    return !!this.aliImageApiKey;
  }

  /**
   * 检查语音识别服务是否可用
   */
  isSpeechServiceAvailable() {
    return !!this.aliSpeechApiKey;
  }
}

module.exports = new MultimodalService();

