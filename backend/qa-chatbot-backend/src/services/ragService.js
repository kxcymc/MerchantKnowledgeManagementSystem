const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { RunnableSequence } = require('@langchain/core/runnables');
const { getEmbeddings } = require('../utils/getEmbeddings');
const vectorStore = require('./vectorStore');
const dbService = require('./dbService');
const llmService = require('./llmService');
const config = require('../config');
const logger = require('../../../shared/utils/logger');

class RAGService {
  constructor() {
    this.llm = null;
    this.initLLM();
  }

  initLLM() {
    // 使用 LLM 服务获取 LLM 实例
    this.llm = llmService.getLLM();
  }

  /**
   * 切换模型
   */
  switchModel(provider, model = null) {
    llmService.switchModel(provider, model);
    this.initLLM(); // 重新初始化 LLM
  }

  /**
   * 判断问题类型（专业问题 vs 日常问答）
   * @param {string} question - 用户问题
   * @returns {Promise<{isProfessional: boolean, confidence: number}>}
   */
  async classifyQuestion(question) {
    try {
      const questionLower = question.toLowerCase();
      const questionTrimmed = question.trim();
      
      // ========== 第一步：明显日常对话关键词（高置信度） ==========
      const obviousCasualKeywords = [
        // 问候类
        '你好', '您好', 'hello', 'hi', '早上好', '下午好', '晚上好', '晚安',
        '谢谢', '感谢', 'thanks', 'thank you', '不客气',
        '再见', '拜拜', 'bye', 'goodbye', 'see you',
        // 天气类
        '天气', '今天天气', '明天天气', '下雨', '晴天', '阴天',
        // 自我介绍类
        '你是谁', '你是什么', '介绍一下', '介绍一下你自己', '你叫什么',
        '你好吗', '你怎么样', '你还好吗',
        // 功能询问类（非业务相关）
        '你能干什么', '你能做什么', '你会什么', '你有什么功能',
        '你能帮我什么', '你能做什么', '你的功能', '你的作用',
        // 娱乐、笑话类（明显日常）
        '笑话', '讲个笑话', '说个笑话', '讲笑话', '说笑话', '来一个笑话',
        '段子', '讲个段子', '说个段子', '来一个段子',
        '搞笑', '逗我', '逗我笑', '让我笑', '开心一下',
        '故事', '讲个故事', '说个故事', '来一个故事',
        '脑筋急转弯', '谜语', '猜谜',
        // 闲聊类
        '聊天', '聊一聊', '聊聊天', '随便聊聊', '闲聊',
        '陪我', '陪我聊天', '陪我说话',
        // 其他明显日常对话
        '无聊', '好无聊', '好没意思', '打发时间',
        '唱歌', '唱首歌', '来首歌',
        '时间', '现在几点', '几点了', '什么时候'
      ];
      
      const isObviousCasual = obviousCasualKeywords.some(keyword => questionLower.includes(keyword.toLowerCase()));
      if (isObviousCasual) {
        logger.info('问题分类结果（明显日常关键词）', { 
          question: question.substring(0, 50), 
          isProfessional: false,
          confidence: 0.95,
          reason: '明显日常对话关键词' 
        });
        return { isProfessional: false, confidence: 0.95 };
      }
      
      // ========== 第二步：明显专业问题关键词（高置信度） ==========
      const obviousProfessionalKeywords = [
        // 核心业务领域关键词（非常明确）
        '保证金', '保证金管理', '保证金缴纳', '保证金退还', '保证金冻结',
        '招商入驻', '入驻申请', '入驻流程', '入驻条件', '商家入驻',
        '资金结算', '结算规则', '结算周期', '提现', '提现规则', '提现流程',
        '退出流程', '关店', '退店', '退出申请',
        '经营成长', '店铺经营', '经营策略', '经营数据',
        // 明确的业务操作
        '入驻审核', '资质审核', '开店流程', '关店流程',
        '结算单', '对账单', '发票申请', '开票',
        '服务费', '平台费', '佣金', '费率',
        '订单管理', '发货', '物流', '售后', '退款', '退货',
        '违规', '处罚', '申诉', '投诉', '举报'
      ];
      
      const isObviousProfessional = obviousProfessionalKeywords.some(keyword => question.includes(keyword));
      if (isObviousProfessional) {
        logger.info('问题分类结果（明显专业关键词）', { 
          question: question.substring(0, 50), 
          isProfessional: true,
          confidence: 0.95,
          reason: '明显专业关键词' 
        });
        return { isProfessional: true, confidence: 0.95 };
      }
      
      // ========== 第三步：边界情况 - 先使用LLM判断得出初步结论 ==========
      // 对于拿不准的问题，先问大模型
      const shouldUseLLM = questionTrimmed.length > 5; // 降低阈值，更早使用LLM判断
      
      if (shouldUseLLM) {
        try {
          const classificationPrompt = `请判断以下问题是否是关于商家业务的专业问题，还是日常聊天对话。

问题：${question}

请只回答 JSON 格式：{"isProfessional": true/false, "reason": "简短原因", "confidence": 0.0-1.0}

判断标准（重要：优先识别日常对话）：
- **日常对话**（isProfessional: false）：以下情况都属于日常对话
  * 问候、寒暄：如"你好"、"谢谢"、"再见"等
  * 闲聊、聊天：如"聊聊天"、"陪我说话"、"随便聊聊"等
  * 娱乐、笑话：如"讲个笑话"、"说个段子"、"逗我笑"、"脑筋急转弯"等
  * 非业务相关的功能询问：如"你能做什么"、"你会什么"、"介绍一下你自己"等
  * 天气、时间等通用话题：如"今天天气怎么样"、"现在几点了"等
  * 心情、感受等个人话题：如"心情怎么样"、"最近好吗"等
  * 明显的玩笑、调侃：如"你好无聊"、"好没意思"等
  * 其他与商家业务无关的日常交流

- **专业问题**（isProfessional: true）：必须明确涉及商家业务
  * 经营成长：店铺经营、商品管理、数据分析、业绩提升等
  * 招商入驻：入驻申请、资质审核、开店流程等
  * 保证金管理：保证金缴纳、退还、冻结等
  * 入驻与退出：退出流程、关店申请等
  * 资金结算：结算规则、提现流程、账单发票等
  * 其他业务规则、政策、操作流程等

**判断原则**：
1. 如果不确定是否为专业问题，优先判断为日常对话（isProfessional: false）
2. 只有明确涉及商家业务的问题才判断为专业问题
3. 笑话、闲聊、娱乐等明显是日常对话，必须判断为日常对话
4. confidence 表示判断的置信度（0.0-1.0），越确定置信度越高`;

          const response = await this.llm.invoke(classificationPrompt);
          const content = response.content.trim();
          
          // 尝试解析 JSON
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            const llmIsProfessional = result.isProfessional !== false;
            const llmConfidence = result.confidence || 0.8;
            
            logger.info('问题分类结果（LLM初步判断）', { 
              question: question.substring(0, 50), 
              isProfessional: llmIsProfessional,
              confidence: llmConfidence,
              reason: result.reason || 'LLM判断' 
            });
            
            // ========== 第四步：结合多方面判断 ==========
            // 如果LLM判断置信度较高，直接采用
            if (llmConfidence >= 0.8) {
              return {
                isProfessional: llmIsProfessional,
                confidence: llmConfidence
              };
            }
            
            // 如果LLM判断置信度较低，结合关键词进行二次判断
            // 检查是否有边界关键词（可能同时出现在日常和专业场景）
            const ambiguousKeywords = [
              '怎么', '如何', '怎样', '什么', '为什么', '哪个', '哪些',
              '规则', '政策', '流程', '操作', '管理', '数据', '分析'
            ];
            
            const hasAmbiguousKeyword = ambiguousKeywords.some(keyword => question.includes(keyword));
            
            if (hasAmbiguousKeyword) {
              // 有边界关键词，进一步检查是否包含业务相关词汇
              const businessContextKeywords = [
                '店铺', '商家', '商品', '订单', '客户', '用户', '平台',
                '经营', '销售', '业绩', '收益', 'GMV', '转化', '流量'
              ];
              
              const hasBusinessContext = businessContextKeywords.some(keyword => question.includes(keyword));
              
              if (hasBusinessContext) {
                // 有业务上下文，判断为专业问题
                logger.info('问题分类结果（综合判断-专业）', { 
                  question: question.substring(0, 50), 
                  isProfessional: true,
                  confidence: 0.75,
                  reason: '边界关键词+业务上下文' 
                });
                return { isProfessional: true, confidence: 0.75 };
              } else {
                // 没有业务上下文，判断为日常对话
                logger.info('问题分类结果（综合判断-日常）', { 
                  question: question.substring(0, 50), 
                  isProfessional: false,
                  confidence: 0.75,
                  reason: '边界关键词但无业务上下文' 
                });
                return { isProfessional: false, confidence: 0.75 };
              }
            }
            
            // 没有边界关键词，采用LLM的判断（即使置信度较低）
            return {
              isProfessional: llmIsProfessional,
              confidence: Math.max(llmConfidence, 0.6) // 最低置信度0.6
            };
          }
        } catch (e) {
          logger.warn('LLM分类失败，使用默认策略', { error: e.message });
        }
      }
      
      // ========== 第五步：默认策略 ==========
      // 如果无法明确判断，对于短问题（<=5字符）优先判断为日常对话
      // 对于较长问题，使用知识库检索（更安全）
      if (questionTrimmed.length <= 5) {
        logger.info('问题分类结果（默认-日常）', { 
          question: question.substring(0, 50), 
          isProfessional: false,
          confidence: 0.5,
          reason: '短问题默认日常' 
        });
        return { isProfessional: false, confidence: 0.5 };
      }
      
      logger.info('问题分类结果（默认-专业）', { 
        question: question.substring(0, 50), 
        isProfessional: true,
        confidence: 0.5,
        reason: '默认策略-使用知识库检索' 
      });
      return { isProfessional: true, confidence: 0.5 };
      
    } catch (error) {
      logger.warn('问题分类失败，默认使用知识库检索', { error: error.message });
      // 分类失败时，默认使用知识库检索（更安全）
      return { isProfessional: true, confidence: 0.5 };
    }
  }

  /**
   * 构建纯对话提示词模板（不依赖知识库）
   */
  buildChatPrompt() {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是"小抖"，一个专业、智能的商家运营管理助手，专门为抖音商家提供业务咨询服务。

**你的核心定位**：
- 专业、准确、高效的商家运营管理助手
- 专注于帮助商家解决业务问题，提升运营效率
- 友好但保持专业形象，不过度娱乐化

**你的专业服务领域**：
1. **经营成长**：店铺经营策略、商品管理、数据分析、业绩提升、营销推广等
2. **招商入驻**：入驻申请流程、资质要求、审核标准、开店指导等
3. **保证金管理**：保证金缴纳、退还、冻结解冻、余额查询等规则
4. **入驻与退出**：退出流程、关店申请、退出条件、账户处理等
5. **资金结算**：结算规则、提现流程、账单发票、对账查询等

**回答风格**：
1. **专业准确**：回答要准确、专业，基于事实和规则
2. **简洁高效**：直接回答核心问题，避免冗余信息
3. **友好专业**：保持友好语气，但不过度使用表情符号（最多1-2个），保持专业形象
4. **结构化表达**：使用清晰的段落、列表等方式组织内容

**回答规则**：
1. 对于日常问候（如"你好"、"谢谢"等），简洁友好地回应，然后引导到业务咨询
2. 对于业务相关问题，要礼貌地引导用户："这个问题涉及业务规则，建议您使用专业问答模式，我可以为您查找准确的知识库内容。"
3. **回答格式要求**：
   - 使用清晰的结构，可以用段落、列表等方式组织内容
   - 重要信息可以用**加粗**强调
   - 如果涉及步骤，使用有序列表（1. 2. 3.）
   - 如果涉及多个要点，使用无序列表（• 或 -）
4. **重要**：不要主动提及日常聊天、讲笑话、讲段子等非业务功能，专注于商家运营管理服务
5. 当用户询问"你能做什么"、"你有什么功能"时，只介绍专业服务领域，不要提及娱乐功能

**自我介绍（当用户询问时）**：
简洁专业地介绍："我是小抖，您的商家运营管理助手。我可以帮助您解决以下业务问题：
• 经营成长：店铺经营策略、商品管理、数据分析、业绩提升等
• 招商入驻：入驻申请流程、资质要求、审核标准等
• 保证金管理：保证金缴纳、退还、冻结解冻等规则
• 入驻与退出：退出流程、关店申请、退出条件等
• 资金结算：结算规则、提现流程、账单发票等

有什么业务问题需要我帮助的吗？"`

      ],
      new MessagesPlaceholder('chat_history'),
      ['human', `用户问题：{question}

请用专业、简洁、友好的方式回答用户的问题：`]
    ]);
  }

  /**
   * 构建 RAG 提示词模板（基于知识库）
   */
  buildRAGPrompt() {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是一个专业、智能、有趣的智能客服助手"小抖"，专门为抖音商家提供业务咨询服务。你的核心职责是帮助商家解决以下专业领域的问题：
- **经营成长**：店铺经营策略、商品管理、数据分析、业绩提升等
- **招商入驻**：入驻申请流程、资质要求、审核标准等
- **保证金管理**：保证金缴纳、退还、冻结解冻等规则
- **入驻与退出**：退出流程、关店申请、退出条件等
- **资金结算**：结算规则、提现流程、账单发票等

回答原则：
1. **精确回答，不会不乱答**：
   - **严格基于提供的知识库内容回答**，绝对不要编造、猜测或推断知识库中没有的信息
   - 如果知识库中没有相关信息或信息不完整，必须明确说明："抱歉，根据当前知识库内容，我暂时无法准确回答您的问题。建议您联系客服或查看相关帮助文档获取最新信息。"
   - 对于专业问题，准确性是第一位的，宁可说"不知道"也不要给出错误信息

2. **回答风格**：
   - 保持专业、准确，但可以用友好、轻松的语气
   - 对于复杂问题，用清晰的结构组织答案
   - 重要信息用**加粗**强调，让商家一眼看到关键点

3. **回答格式要求**：
   - 使用清晰的结构，可以用段落、列表等方式组织内容
   - **标题标记规则**：
     * 对于主标题（如"如何退回保证金："、"什么是商家体验分："等），使用 #标题# 格式标记（例如：#如何退回保证金：#）
     * 对于二级标题（如"一、店铺经营中部分退回"、"二、店铺关闭后余额退回"等），使用 #标题# 格式标记（例如：#一、店铺经营中部分退回#）
     * 标题会被渲染为深蓝色加粗，突出显示
   - **加粗使用规则**：
     * 对于重要名词、关键概念、专业术语（如"商品体验"、"物流体验"、"服务体验"、"保证金"、"结算单"、"对公账户"等），使用**加粗**标记（例如：**商品体验**、**物流体验**）
     * **重要**：不要使用【】包裹专业术语，直接使用**加粗**标记即可（例如：使用**商品体验**而不是【商品体验】）
     * 对于金额、时间、条件等关键信息，使用**加粗**标记
     * 对于流程步骤中的关键操作，使用**加粗**标记
     * 对于需要特别注意的重要提示，使用**加粗**标记
   - **来源标注规则**：
     * 当回答涉及多个知识文档时，必须在每个部分后面明确标注来源
     * 格式：在每个部分结束后，新起一行，使用 [来源：文档名] 格式标注（例如：[来源：保证金管理规范.pdf]）
     * 例如：
       "如何退回保证金：
       [内容...]
       [来源：保证金管理规范.pdf]
       
       什么是商家体验分：
       [内容...]
       [来源：商家体验分规范.pdf]"
   - 如果涉及步骤，使用有序列表（1. 2. 3.）
   - 如果涉及多个要点，使用无序列表（• 或 -）
   - 对于金额、时间、条件等关键信息，务必准确无误

4. **重要：不要在回答中使用任何引用标记**（如 [1]、[2] 等），引用信息会在回答下方单独显示

5. 回答要准确、简洁、专业、易读，让商家能够快速理解并采取行动`
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', `知识库内容：
{context}

用户问题：{question}

请基于以上知识库内容，用清晰、专业、准确的格式回答用户问题。

**核心要求**：
1. **严格基于知识库内容**，不要编造任何信息
2. 如果知识库中没有相关信息，明确说明无法回答，不要猜测
3. 对于专业问题（经营成长、招商入驻、保证金管理、入驻与退出、资金结算），准确性是第一位的
4. **不要在回答中使用任何引用标记**（如 [1]、[2] 等），引用信息会在回答下方单独显示

**格式要求**：
1. **标题标记**：使用 #标题# 格式标记所有标题（主标题和二级标题），例如：#如何退回保证金：#、#一、店铺经营中部分退回#
2. **重要词汇加粗**：使用**加粗**标记重要专业术语（如**商品体验**、**物流体验**、**服务体验**），不要使用【】包裹
3. **来源标注**：如果回答涉及多个知识文档，必须在每个部分后面新起一行，使用 [来源：文档名] 格式标注来源，例如：[来源：保证金管理规范.pdf]
5. 直接回答问题即可，不需要标注引用来源`]
    ]);
  }

  /**
   * 向量检索（公共方法，供外部调用）
   */
  async retrieveDocuments(question, topK = null) {
    const k = topK || config.rag.topK;
    const queryEmbedding = await getEmbeddings().embedQuery(question);
    
    const results = await vectorStore.similaritySearch(
      queryEmbedding,
      k,
      (record) => {
        // 只检索生效中的文档
        return record.metadata?.status === '生效中' || record.metadata?.isActive === true;
      }
    );

    // 过滤低分文档
    const filtered = results.filter(doc => 
      (doc.score || 0) >= config.rag.minScore
    );

    logger.info('向量检索完成', { 
      question: question.substring(0, 50),
      totalResults: results.length,
      filteredResults: filtered.length
    });

    return filtered;
  }

  /**
   * 构建上下文
   */
  buildContext(documents) {
    if (!documents || documents.length === 0) {
      return '知识库中没有找到相关信息。';
    }

    return documents
      .map((doc, index) => {
        const title = doc.metadata?.title || '未知文档';
        const business = doc.metadata?.business || '';
        const scene = doc.metadata?.scene || '';
        
        // 提取页码信息
        let pageInfo = '';
        if (doc.metadata?.page !== undefined) {
          pageInfo = `（第 ${doc.metadata.page} 页）`;
        } else if (doc.metadata?.pageNumber !== undefined) {
          pageInfo = `（第 ${doc.metadata.pageNumber} 页）`;
        } else if (doc.metadata?.page_num !== undefined) {
          pageInfo = `（第 ${doc.metadata.page_num} 页）`;
        }
        
        const metadataStr = [business, scene].filter(Boolean).join(' - ');
        return `[文档${index + 1}] ${title}${pageInfo}${metadataStr ? ` (${metadataStr})` : ''}\n${doc.text}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * RAG 流式查询（实时返回）
   * @param {string} question - 用户问题
   * @param {Array} chatHistory - 对话历史
   * @param {Function} onToken - 每个 token 的回调函数 (token) => void
   * @returns {Promise<{answer: string, role: string, references: Array, hasRelevantDocs: boolean}>}
   */
  /**
   * 流式查询 RAG 服务
   * 注意：所有模型（volcano_ark、deepseek、qwen）都支持流式处理
   * 使用 chain.stream() 时会自动启用流式处理，即使 LLM 实例的 streaming 配置为 false
   */
  async queryStream(question, chatHistory = [], onToken) {
    try {
      // 1. 判断问题类型（专业问题 vs 日常问答）
      const classification = await this.classifyQuestion(question);
      
      // 2. 如果是日常问答，使用纯对话模式（不检索知识库）
      if (!classification.isProfessional) {
        logger.info('识别为日常问答，使用纯对话模式', { question: question.substring(0, 50) });
        
        const prompt = this.buildChatPrompt();
        const chain = RunnableSequence.from([prompt, this.llm]);
        
        let fullAnswer = '';
        // 使用 chain.stream() 启用流式处理，所有模型都支持
        const stream = await chain.stream({
          question,
          chat_history: chatHistory
        });

        // 实时处理流式响应
        for await (const chunk of stream) {
          const content = chunk.content || '';
          if (content) {
            fullAnswer += content;
            if (onToken) {
              onToken(content);
            }
          }
        }

        return {
          answer: fullAnswer,
          role: 'AI',
          references: [],
          hasRelevantDocs: false
        };
      }

      // 3. 专业问题：进行知识库检索
      logger.info('识别为专业问题，使用知识库检索', { question: question.substring(0, 50) });
      
      // 3.1 向量检索
      const documents = await this.retrieveDocuments(question);
      
      // 3.2 构建上下文
      const context = this.buildContext(documents);
      
      // 3.3 如果没有检索到相关内容
      if (!documents || documents.length === 0) {
        const answer = '抱歉，根据提供的知识库内容，我暂时无法回答您的问题。建议您联系客服或查看相关帮助文档。';
        // 即使是零命中，也流式返回
        if (onToken) {
          for (let i = 0; i < answer.length; i++) {
            onToken(answer[i]);
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }
        return {
          answer,
          role: 'AI',
          references: [],
          hasRelevantDocs: false
        };
      }

      // 3.4 构建提示词
      const prompt = this.buildRAGPrompt();
      
      // 3.5 构建 Chain
      const chain = RunnableSequence.from([
        prompt,
        this.llm
      ]);

      // 3.6 流式调用 LLM（所有模型都支持流式处理）
      let fullAnswer = '';
      const stream = await chain.stream({
        context,
        question,
        chat_history: chatHistory
      });

      // 3.7 实时处理流式响应
      for await (const chunk of stream) {
        const content = chunk.content || '';
        if (content) {
          fullAnswer += content;
          // 实时回调每个 token
          if (onToken) {
            onToken(content);
          }
        }
      }

      // 3.8 提取引用信息
      const references = await this.extractReferences(documents);

      logger.info('RAG 流式查询完成', { 
        question: question.substring(0, 50),
        answerLength: fullAnswer.length,
        referencesCount: references.length
      });

      return {
        answer: fullAnswer,
        role: 'AI',
        references,
        hasRelevantDocs: true
      };

    } catch (error) {
      logger.error('RAG 流式查询失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * RAG 查询（非流式，保持向后兼容）
   */
  async query(question, chatHistory = []) {
    try {
      // 1. 判断问题类型（专业问题 vs 日常问答）
      const classification = await this.classifyQuestion(question);
      
      // 2. 如果是日常问答，使用纯对话模式（不检索知识库）
      if (!classification.isProfessional) {
        logger.info('识别为日常问答，使用纯对话模式', { question: question.substring(0, 50) });
        
        const prompt = this.buildChatPrompt();
        const chain = RunnableSequence.from([prompt, this.llm]);
        
        const response = await chain.invoke({
          question,
          chat_history: chatHistory
        });

        return {
          answer: response.content,
          role: 'AI',
          references: [],
          hasRelevantDocs: false
        };
      }

      // 3. 专业问题：进行知识库检索
      logger.info('识别为专业问题，使用知识库检索', { question: question.substring(0, 50) });
      
      // 3.1 向量检索
      const documents = await this.retrieveDocuments(question);
      
      // 3.2 构建上下文
      const context = this.buildContext(documents);
      
      // 3.3 如果没有检索到相关内容
      if (!documents || documents.length === 0) {
        return {
          answer: '抱歉，根据提供的知识库内容，我暂时无法回答您的问题。建议您联系客服或查看相关帮助文档。',
          role: 'AI',
          references: [],
          hasRelevantDocs: false
        };
      }

      // 3.4 构建提示词
      const prompt = this.buildRAGPrompt();
      
      // 3.5 构建 Chain
      const chain = RunnableSequence.from([
        prompt,
        this.llm
      ]);

      // 3.6 调用 LLM
      const response = await chain.invoke({
        context,
        question,
        chat_history: chatHistory
      });

      const answer = response.content;

      // 3.7 提取引用信息
      const references = await this.extractReferences(documents);

      logger.info('RAG 查询完成', { 
        question: question.substring(0, 50),
        answerLength: answer.length,
        referencesCount: references.length
      });

      return {
        answer,
        role: 'AI',
        references,
        hasRelevantDocs: true
      };

    } catch (error) {
      logger.error('RAG 查询失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 提取引用信息（包含页码）
   */
  async extractReferences(documents) {
    const references = [];
    // 使用 Map 存储，key 为 knowledgeId，value 包含文档信息和所有页码（带得分）
    const knowledgeIdMap = new Map();

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const knowledgeId = doc.metadata?.knowledgeId;

      if (knowledgeId) {
        const knowledgeIdNum = parseInt(knowledgeId);
        
        // 提取页码信息（从 metadata 中）
        let page = null;
        if (doc.metadata?.page !== undefined && doc.metadata.page !== null) {
          page = parseInt(doc.metadata.page);
          // 确保页码是有效的正整数（从1开始）
          if (isNaN(page) || page < 1) {
            page = null;
          }
        } else if (doc.metadata?.pageNumber !== undefined && doc.metadata.pageNumber !== null) {
          page = parseInt(doc.metadata.pageNumber);
          if (isNaN(page) || page < 1) {
            page = null;
          }
        } else if (doc.metadata?.page_num !== undefined && doc.metadata.page_num !== null) {
          page = parseInt(doc.metadata.page_num);
          if (isNaN(page) || page < 1) {
            page = null;
          }
        }
        
        const currentScore = doc.score || 0;
        
        // 如果该知识库还没有添加到引用列表
        if (!knowledgeIdMap.has(knowledgeIdNum)) {
          // 从知识库数据库获取完整信息
          try {
            const knowledge = await dbService.getKnowledgeById(knowledgeIdNum);
            if (knowledge) {
              // 初始化页码列表
              const pages = [];
              if (page !== null) {
                pages.push({ 
                  page, 
                  score: currentScore, // 用于排序的总权重
                  totalScore: currentScore, // 总权重
                  count: 1, // 引用次数
                  maxScore: currentScore // 最大权重
                });
              }
              
              knowledgeIdMap.set(knowledgeIdNum, {
                knowledge_id: knowledge.knowledge_id,
                title: knowledge.title,
                type: this.getFileType(knowledge.type),
                file_url: knowledge.file_url || '',
                pages: pages, // 存储所有页码和得分
                score: currentScore // 最高得分
              });
            }
          } catch (error) {
            logger.warn('获取知识库信息失败', { knowledgeId, error: error.message });
          }
        } else {
          // 如果已存在，添加新的页码信息（如果不同）
          const existingRef = knowledgeIdMap.get(knowledgeIdNum);
          
          // 更新最高得分
          if (currentScore > existingRef.score) {
            existingRef.score = currentScore;
          }
          
          // 如果当前chunk有页码，添加到页码列表
          if (page !== null) {
            // 检查是否已存在该页码
            const existingPageIndex = existingRef.pages.findIndex(p => p.page === page);
            if (existingPageIndex >= 0) {
              // 如果已存在，累加权重
              const existingPage = existingRef.pages[existingPageIndex];
              existingPage.totalScore = (existingPage.totalScore || existingPage.score || 0) + currentScore; // 累加总权重
              existingPage.count = (existingPage.count || 1) + 1; // 增加引用次数
              existingPage.maxScore = Math.max(existingPage.maxScore || existingPage.score || 0, currentScore); // 更新最大权重
              existingPage.score = existingPage.totalScore; // 使用总权重作为排序依据
            } else {
              // 如果不存在，添加新页码
              existingRef.pages.push({ 
                page, 
                score: currentScore, // 用于排序的总权重
                totalScore: currentScore, // 总权重
                count: 1, // 引用次数
                maxScore: currentScore // 最大权重
              });
            }
          }
        }
      }
    }

    // 转换为数组并按相关性排序（score 降序）
    const result = Array.from(knowledgeIdMap.values())
      .map(ref => {
        // 对页码按总权重降序排序，总权重相同时按最大权重降序，再相同时按页码升序
        ref.pages.sort((a, b) => {
          const aTotalScore = a.totalScore || a.score || 0;
          const bTotalScore = b.totalScore || b.score || 0;
          
          if (Math.abs(aTotalScore - bTotalScore) > 0.001) {
            return bTotalScore - aTotalScore; // 总权重降序
          }
          
          const aMaxScore = a.maxScore || a.score || 0;
          const bMaxScore = b.maxScore || b.score || 0;
          if (Math.abs(aMaxScore - bMaxScore) > 0.001) {
            return bMaxScore - aMaxScore; // 最大权重降序
          }
          
          return a.page - b.page; // 页码升序
        });
        
        // 为了向后兼容，保留 page 字段（使用总权重最高的页码）
        ref.page = ref.pages.length > 0 ? ref.pages[0].page : null;
        
        return ref;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    
    logger.info('提取引用信息完成', {
      totalReferences: result.length,
      references: result.map(r => ({
        knowledge_id: r.knowledge_id,
        title: r.title,
        pages: r.pages,
        score: r.score
      }))
    });
    
    return result;
  }

  /**
   * 获取文件类型
   */
  getFileType(type) {
    const typeMap = {
      'pdf': 'PDF',
      'docx': '富文本',
      'txt': '富文本',
      'md': '富文本',
      'json': '富文本'
    };
    return typeMap[type] || '富文本';
  }
}

module.exports = new RAGService();

