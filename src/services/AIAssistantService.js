import dotenv from 'dotenv';
import { callClaude, callDeepSeek, MODELS } from './aiProviders.js';

dotenv.config();

/**
 * AI 助手服务
 * 提供翻译、智能回复建议、意图分析等功能
 *
 * 模型分级（成本优化，由 .env 控制）：
 * - 翻译 / 语言检测 → DeepSeek（TRANSLATE_PROVIDER=deepseek），失败回退 Claude Haiku
 * - 回复建议 / 意图分析 → Sonnet（MODELS.MID）
 * - 客户深度画像 → Opus（MODELS.PREMIUM）
 */
class AIAssistantService {
  /**
   * 翻译消息
   * @param {string} text - 要翻译的文本
   * @param {string} targetLanguage - 目标语言代码
   * @param {string} sourceLanguage - 源语言代码（可选）
   */
  static async translate(text, targetLanguage, sourceLanguage = 'auto') {
    try {
      const languageNames = {
        'zh': 'Chinese',
        'en': 'English',
        'ru': 'Russian',
        'ar': 'Arabic',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'ja': 'Japanese',
        'ko': 'Korean'
      };

      const targetLangName = languageNames[targetLanguage] || targetLanguage;

      const prompt = sourceLanguage === 'auto'
        ? `Translate the following text to ${targetLangName}. Only return the translation, no explanations:\n\n${text}`
        : `Translate from ${languageNames[sourceLanguage]} to ${targetLangName}. Only return the translation:\n\n${text}`;

      const useDeepSeek = (process.env.TRANSLATE_PROVIDER || 'deepseek') === 'deepseek';
      let translatedText;
      let usedModel;

      if (useDeepSeek) {
        // 首选 DeepSeek（便宜、快、中俄互译质量好）
        try {
          translatedText = await callDeepSeek({ prompt, max_tokens: 1000, temperature: 0.3 });
          usedModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        } catch (dsError) {
          // DeepSeek 故障时回退 Claude Haiku，保证翻译永不中断
          console.error('DeepSeek 翻译失败，回退 Haiku:', dsError.message);
          translatedText = await callClaude({
            model: MODELS.CHEAP,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          });
          usedModel = `${MODELS.CHEAP} (fallback)`;
        }
      } else {
        translatedText = await callClaude({
          model: MODELS.CHEAP,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });
        usedModel = MODELS.CHEAP;
      }

      return {
        success: true,
        original: text,
        translated: translatedText,
        sourceLanguage,
        targetLanguage,
        model: usedModel
      };
    } catch (error) {
      console.error('翻译错误:', error);
      return {
        success: false,
        error: error.message,
        original: text
      };
    }
  }

  /**
   * 生成单条自动回复（用于 Webhook 自动接待）
   * 直接返回一段可发送的回复文本，使用客户的语言
   * @param {Array} conversationHistory - 会话历史记录（含最新客户消息）
   * @param {Object} customerProfile - 客户信息 { name, country, language }
   */
  static async generateReply(conversationHistory = [], customerProfile = {}) {
    try {
      const languageNames = {
        zh: 'Chinese', en: 'English', ru: 'Russian', ar: 'Arabic',
        es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean'
      };
      const lang = customerProfile.language || 'en';
      const langName = languageNames[lang] || 'English';

      // 系统提示：AutoZQ 汽车出口销售顾问
      const systemPrompt =
        `You are a professional sales consultant for AutoZQ, a company that exports cars from China to Russia and other countries via Manzhouli. ` +
        `You specialize in vehicles under 160 horsepower (exempt from Russian scrappage fees), with 10 years of experience, dual quality inspection, and VTB Bank payment support. ` +
        `Reply to the customer in ${langName}. Be warm, concise, and helpful. Ask a clarifying question when useful to move the deal forward. ` +
        `Do not invent specific prices or availability you don't know — offer to check and follow up. Keep the reply to 1-3 short sentences.`;

      // 构建对话消息（转成 Anthropic 的 messages 格式）
      const recent = conversationHistory.slice(-10);
      const messages = recent.map(msg => ({
        role: msg.sender_type === 'customer' ? 'user' : 'assistant',
        content: msg.content
      }));

      // 确保最后一条是 user 消息（Anthropic 要求以 user 开头/结尾对话）
      if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
        messages.push({ role: 'user', content: '(Customer is waiting for a reply)' });
      }
      // 确保第一条是 user 角色
      while (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift();
      }

      const replyText = await callClaude({
        model: MODELS.MID,
        max_tokens: 500,
        system: systemPrompt,
        messages
      });

      return {
        success: true,
        reply: replyText,
        language: lang,
        model: MODELS.MID
      };
    } catch (error) {
      console.error('生成自动回复错误:', error);
      return {
        success: false,
        error: error.message,
        reply: null
      };
    }
  }

  /**
   * 生成智能回复建议
   * @param {Array} conversationHistory - 会话历史记录
   * @param {Object} customerProfile - 客户画像信息
   * @param {Object} context - 额外上下文（车辆信息等）
   */
  static async suggestReplies(conversationHistory, customerProfile = {}, context = {}) {
    try {
      // 构建上下文
      let contextText = '你是一个汽车销售顾问，需要为以下对话生成3-5条专业的回复建议。\n\n';

      // 客户信息
      if (customerProfile.name) {
        contextText += `客户信息：\n`;
        contextText += `- 姓名：${customerProfile.name}\n`;
        if (customerProfile.country) contextText += `- 国家：${customerProfile.country}\n`;
        if (customerProfile.language) contextText += `- 语言：${customerProfile.language}\n`;
        if (customerProfile.rating) contextText += `- 评级：${customerProfile.rating}\n`;
        if (customerProfile.budget_range) contextText += `- 预算：${customerProfile.budget_range}\n`;
        if (customerProfile.preferred_brands?.length) {
          contextText += `- 偏好品牌：${customerProfile.preferred_brands.join(', ')}\n`;
        }
        contextText += '\n';
      }

      // 会话历史
      contextText += '对话历史：\n';
      const recentMessages = conversationHistory.slice(-10); // 最近10条
      recentMessages.forEach(msg => {
        const speaker = msg.sender_type === 'customer' ? '客户' : '我';
        contextText += `${speaker}：${msg.content}\n`;
      });

      contextText += '\n请生成3-5条不同风格的回复建议：\n';
      contextText += '1. 专业正式\n';
      contextText += '2. 友好热情\n';
      contextText += '3. 简短直接\n';
      contextText += '4. 详细解释\n';
      contextText += '5. 询问需求\n\n';
      contextText += '以JSON格式返回，格式：\n';
      contextText += '{\n';
      contextText += '  "suggestions": [\n';
      contextText += '    {"type": "professional", "content": "回复内容", "reason": "适用场景"},\n';
      contextText += '    ...\n';
      contextText += '  ]\n';
      contextText += '}';

      const responseText = await callClaude({
        model: MODELS.MID, // Sonnet（平衡性能与成本）
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: contextText
        }]
      });

      // 尝试解析 JSON
      let suggestions;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        } else {
          suggestions = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('JSON解析失败:', parseError);
        // 如果解析失败，返回原始文本
        suggestions = {
          suggestions: [{
            type: 'general',
            content: responseText,
            reason: 'AI生成的回复'
          }]
        };
      }

      return {
        success: true,
        suggestions: suggestions.suggestions || [],
        model: MODELS.MID
      };
    } catch (error) {
      console.error('生成回复建议错误:', error);
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  }

  /**
   * 分析客户意图
   * @param {string} message - 客户消息
   * @param {Array} conversationHistory - 会话历史
   */
  static async analyzeIntent(message, conversationHistory = []) {
    try {
      let prompt = '分析以下客户消息的意图，判断客户想要：\n\n';

      if (conversationHistory.length > 0) {
        prompt += '对话历史：\n';
        conversationHistory.slice(-5).forEach(msg => {
          prompt += `${msg.sender_type === 'customer' ? '客户' : '客服'}：${msg.content}\n`;
        });
        prompt += '\n';
      }

      prompt += `当前消息：${message}\n\n`;
      prompt += '请返回JSON格式，包含：\n';
      prompt += '{\n';
      prompt += '  "intent": "inquiry|pricing|negotiation|complaint|order|other",\n';
      prompt += '  "confidence": 0.0-1.0,\n';
      prompt += '  "sentiment": "positive|neutral|negative",\n';
      prompt += '  "urgency": "high|medium|low",\n';
      prompt += '  "keywords": ["关键词1", "关键词2"],\n';
      prompt += '  "summary": "意图简要说明"\n';
      prompt += '}';

      const resultText = await callClaude({
        model: MODELS.MID,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // 解析 JSON
      let analysis;
      try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        analysis = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
      } catch (parseError) {
        analysis = {
          intent: 'other',
          confidence: 0.5,
          sentiment: 'neutral',
          urgency: 'medium',
          keywords: [],
          summary: resultText
        };
      }

      return {
        success: true,
        ...analysis,
        model: MODELS.MID
      };
    } catch (error) {
      console.error('意图分析错误:', error);
      return {
        success: false,
        error: error.message,
        intent: 'unknown',
        sentiment: 'neutral'
      };
    }
  }

  /**
   * 生成客户画像
   * @param {Object} customerData - 客户数据（消息、互动记录等）
   */
  static async generateCustomerProfile(customerData) {
    try {
      const { customer, messages = [], interactions = [] } = customerData;

      let prompt = '分析以下客户数据，生成详细的客户画像：\n\n';

      prompt += `客户基本信息：\n`;
      prompt += `- 姓名：${customer.name}\n`;
      prompt += `- 国家：${customer.country || '未知'}\n`;
      prompt += `- 来源：${customer.source}\n`;
      prompt += `- 注册时间：${customer.created_at}\n\n`;

      if (messages.length > 0) {
        prompt += `客户消息记录（最近${Math.min(messages.length, 20)}条）：\n`;
        messages.slice(-20).forEach((msg, idx) => {
          if (msg.sender_type === 'customer') {
            prompt += `${idx + 1}. ${msg.content}\n`;
          }
        });
        prompt += '\n';
      }

      prompt += '请生成JSON格式的客户画像，包含：\n';
      prompt += '{\n';
      prompt += '  "purchase_intent_score": 0-100,\n';
      prompt += '  "budget_range": "预估预算范围",\n';
      prompt += '  "preferred_brands": ["品牌1", "品牌2"],\n';
      prompt += '  "preferred_vehicle_types": ["车型类型1", "车型类型2"],\n';
      prompt += '  "behavior_tags": ["标签1", "标签2"],\n';
      prompt += '  "communication_style": "描述沟通风格",\n';
      prompt += '  "ai_summary": "客户特征总结",\n';
      prompt += '  "recommendations": "销售建议"\n';
      prompt += '}';

      const resultText = await callClaude({
        model: MODELS.PREMIUM, // Opus（深度分析）
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // 解析 JSON
      let profile;
      try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        profile = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
      } catch (parseError) {
        console.error('画像解析失败:', parseError);
        profile = {
          purchase_intent_score: 50,
          budget_range: 'unknown',
          preferred_brands: [],
          preferred_vehicle_types: [],
          behavior_tags: [],
          communication_style: 'normal',
          ai_summary: resultText,
          recommendations: '需要更多数据分析'
        };
      }

      return {
        success: true,
        profile,
        model: MODELS.PREMIUM
      };
    } catch (error) {
      console.error('生成客户画像错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检测语言
   * @param {string} text - 文本
   */
  static async detectLanguage(text) {
    try {
      const prompt = `Detect the language of this text and return only the ISO 639-1 language code (e.g., "en", "zh", "ru", "ar"):\n\n${text}`;

      const useDeepSeek = (process.env.TRANSLATE_PROVIDER || 'deepseek') === 'deepseek';
      let languageCode;

      if (useDeepSeek) {
        try {
          languageCode = await callDeepSeek({ prompt, max_tokens: 10, temperature: 0 });
        } catch (dsError) {
          console.error('DeepSeek 语言检测失败，回退 Haiku:', dsError.message);
          languageCode = await callClaude({
            model: MODELS.CHEAP,
            max_tokens: 10,
            messages: [{ role: 'user', content: prompt }],
          });
        }
      } else {
        languageCode = await callClaude({
          model: MODELS.CHEAP,
          max_tokens: 10,
          messages: [{ role: 'user', content: prompt }],
        });
      }

      return {
        success: true,
        language: languageCode.trim().toLowerCase()
      };
    } catch (error) {
      console.error('语言检测错误:', error);
      return {
        success: false,
        language: 'en'
      };
    }
  }
}

export default AIAssistantService;
