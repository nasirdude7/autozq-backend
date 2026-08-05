import { query } from '../db/salesPool.js';
import { callClaude, MODELS } from './aiProviders.js';

/**
 * AI 客户分析服务
 * 基于客户的消息历史、行为数据生成智能分析
 * 模型：Opus（深度分析，低频高价值）
 */
class CustomerAnalysisService {
  constructor() {
    this.model = MODELS.PREMIUM; // Opus 4.8
  }

  /**
   * 分析客户画像
   */
  async analyzeCustomerProfile(customerId) {
    try {
      // 获取客户基本信息
      const customerResult = await query(
        'SELECT * FROM customers WHERE id = $1',
        [customerId]
      );

      if (customerResult.rows.length === 0) {
        throw new Error('客户不存在');
      }

      const customer = customerResult.rows[0];

      // 获取客户消息历史
      const messagesResult = await query(
        `SELECT content, sender_type, timestamp as created_at
         FROM messages
         WHERE conversation_id IN (
           SELECT id FROM conversations WHERE customer_id = $1
         )
         ORDER BY timestamp DESC
         LIMIT 50`,
        [customerId]
      );

      const messages = messagesResult.rows.map(m => ({
        content: m.content,
        direction: m.sender_type === 'customer' ? 'inbound' : 'outbound',
        created_at: m.created_at
      }));

      // 获取客户标签
      const labelsResult = await query(
        `SELECT l.name
         FROM labels l
         JOIN customer_labels cl ON l.id = cl.label_id
         WHERE cl.customer_id = $1`,
        [customerId]
      );

      const labels = labelsResult.rows.map(r => r.name);

      // 构建分析提示词
      const analysisPrompt = this._buildAnalysisPrompt(customer, messages, labels);

      // 调用 AI 分析
      const analysis = await this._callAI(analysisPrompt);

      // 保存分析结果
      await this._saveAnalysis(customerId, analysis);

      return {
        customer_id: customerId,
        customer_name: customer.name,
        analysis: analysis,
        analyzed_at: new Date()
      };

    } catch (error) {
      console.error('客户分析失败:', error);
      throw error;
    }
  }

  /**
   * 构建分析提示词
   */
  _buildAnalysisPrompt(customer, messages, labels) {
    const messageHistory = messages
      .map(m => `[${m.direction === 'inbound' ? '客户' : '我方'}]: ${m.content}`)
      .join('\n');

    return `你是一位专业的汽车出口业务分析专家。请分析以下客户信息，给出专业的客户画像和建议。

## 客户基本信息
- 姓名: ${customer.name || '未知'}
- 电话: ${customer.phone || '未知'}
- 邮箱: ${customer.email || '未知'}
- 来源: ${customer.source || '未知'}
- 语言: ${customer.language || '未知'}
- 当前标签: ${labels.join(', ') || '无'}
- 首次联系: ${customer.first_contact_at || '未知'}
- 最后联系: ${customer.last_contact_at || '未知'}

## 近期对话记录（最近50条）
${messageHistory || '暂无对话记录'}

---

请根据以上信息，以JSON格式输出分析结果：

{
  "intent_score": 0-100的整数（购买意向评分），
  "intent_level": "高意向" | "中意向" | "低意向" | "观望中",
  "customer_type": "个人买家" | "B端经销商" | "中间商" | "咨询者",
  "interested_categories": ["车型类别1", "车型类别2"],
  "budget_range": "预估预算区间",
  "urgency": "紧急" | "一般" | "不急",
  "communication_style": "沟通风格描述（1-2句话）",
  "key_concerns": ["关注点1", "关注点2", "关注点3"],
  "next_action": "建议下一步行动（1-2句话）",
  "summary": "综合分析总结（2-3句话）"
}

注意：
1. 仅输出JSON，不要有其他文字
2. 如果信息不足，给出基于现有信息的合理推测
3. intent_score 要综合考虑对话频率、询价行为、回复速度等因素
4. 建议要具体可执行`;
  }

  /**
   * 调用 AI API
   */
  async _callAI(prompt) {
    const content = await callClaude({
      model: this.model,
      max_tokens: 1024,
      temperature: 0.3,
      system: '你是专业的汽车出口业务分析师，擅长客户画像分析和销售策略建议。',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // 解析 JSON（可能包裹在 markdown 代码块中）
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (error) {
      console.error('AI 返回的内容不是有效的 JSON:', content);
      // 返回默认结构
      return {
        intent_score: 50,
        intent_level: '中意向',
        customer_type: '咨询者',
        interested_categories: [],
        budget_range: '未知',
        urgency: '一般',
        communication_style: '信息不足，需要进一步沟通',
        key_concerns: [],
        next_action: '主动联系客户，了解具体需求',
        summary: 'AI 分析暂时不可用，建议人工跟进'
      };
    }
  }

  /**
   * 保存分析结果到数据库
   */
  async _saveAnalysis(customerId, analysis) {
    try {
      await query(
        `INSERT INTO customer_analysis (
          customer_id,
          intent_score,
          intent_level,
          customer_type,
          analysis_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (customer_id)
        DO UPDATE SET
          intent_score = EXCLUDED.intent_score,
          intent_level = EXCLUDED.intent_level,
          customer_type = EXCLUDED.customer_type,
          analysis_data = EXCLUDED.analysis_data,
          updated_at = NOW()`,
        [
          customerId,
          analysis.intent_score,
          analysis.intent_level,
          analysis.customer_type,
          JSON.stringify(analysis)
        ]
      );
    } catch (error) {
      console.error('保存分析结果失败:', error);
      // 不抛出错误，允许继续返回分析结果
    }
  }

  /**
   * 获取已保存的分析结果
   */
  async getAnalysis(customerId) {
    try {
      const result = await query(
        `SELECT * FROM customer_analysis
         WHERE customer_id = $1`,
        [customerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('获取分析结果失败:', error);
      return null;
    }
  }

  /**
   * 批量分析客户（用于定时任务）
   */
  async batchAnalyze(limit = 10) {
    try {
      // 获取最近活跃但未分析的客户
      const customersResult = await query(
        `SELECT c.id
         FROM customers c
         LEFT JOIN customer_analysis ca ON c.id = ca.customer_id
         WHERE c.last_contact_at IS NOT NULL
         AND (ca.id IS NULL OR ca.updated_at < NOW() - INTERVAL '7 days')
         ORDER BY c.last_contact_at DESC
         LIMIT $1`,
        [limit]
      );

      const results = [];

      for (const row of customersResult.rows) {
        try {
          const analysis = await this.analyzeCustomerProfile(row.id);
          results.push({ success: true, customer_id: row.id, analysis });
        } catch (error) {
          results.push({ success: false, customer_id: row.id, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('批量分析失败:', error);
      throw error;
    }
  }
}

export default new CustomerAnalysisService();
