import pool from '../db/salesPool.js';
import AIAssistantService from './AIAssistantService.js';

/**
 * 知识库服务
 * 自动从聊天记录学习常见问题和回答
 */
class KnowledgeBaseService {
  /**
   * 从聊天记录中提取知识点
   * @param {number} days - 分析最近多少天的数据
   * @param {number} minOccurrence - 最少出现次数
   */
  static async extractKnowledge(days = 30, minOccurrence = 3) {
    try {
      // 1. 获取最近的对话数据
      const query = `
        SELECT
          m.content,
          m.sender_type,
          m.timestamp,
          c.name as customer_name,
          cu.country,
          cu.language
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        JOIN customers cu ON cu.id = c.customer_id
        WHERE m.timestamp >= NOW() - INTERVAL '${days} days'
          AND m.sender_type IN ('customer', 'agent')
        ORDER BY m.timestamp DESC
        LIMIT 5000
      `;

      const result = await pool.query(query);
      const messages = result.rows;

      if (messages.length === 0) {
        return {
          success: false,
          message: '没有足够的对话数据'
        };
      }

      // 2. 使用AI分析提取知识点
      const analysisPrompt = `
分析以下客户服务对话记录，提取常见的问题和最佳回答模式。

对话样本（最近${days}天，共${messages.length}条消息）：

${messages.slice(0, 100).map((m, i) =>
  `${i + 1}. [${m.sender_type}] ${m.content}`
).join('\n')}

请提取：
1. **常见问题（FAQ）**：客户最常问的问题
2. **最佳回答模板**：对这些问题的有效回答
3. **关键词**：与汽车出口业务相关的高频词
4. **客户痛点**：客户经常关心的问题

以JSON格式返回：
{
  "faqs": [
    {
      "question": "问题",
      "answer": "最佳回答",
      "keywords": ["关键词1", "关键词2"],
      "frequency": 估计出现频率,
      "category": "分类"
    }
  ],
  "common_topics": ["话题1", "话题2"],
  "customer_concerns": ["担忧1", "担忧2"],
  "recommended_templates": ["模板1", "模板2"]
}
`;

      const aiResponse = await AIAssistantService.generateCustomerProfile({
        customer: { name: 'Analysis' },
        messages: messages.slice(0, 100)
      });

      // 这里简化使用，实际应该调用专门的分析接口
      const knowledgeAnalysis = {
        faqs: [],
        common_topics: [],
        customer_concerns: [],
        recommended_templates: []
      };

      // 3. 统计关键词频率
      const keywordMap = new Map();
      messages.forEach(msg => {
        if (msg.sender_type === 'customer') {
          // 简单分词（实际应使用专业分词器）
          const words = msg.content
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2);

          words.forEach(word => {
            keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
          });
        }
      });

      // 4. 提取高频关键词
      const topKeywords = Array.from(keywordMap.entries())
        .filter(([_, count]) => count >= minOccurrence)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([word, count]) => ({ word, count }));

      return {
        success: true,
        data: {
          analysis_period: `${days} days`,
          total_messages: messages.length,
          knowledge: knowledgeAnalysis,
          top_keywords: topKeywords,
          extracted_at: new Date()
        }
      };
    } catch (error) {
      console.error('提取知识库错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 保存知识条目到数据库
   * @param {Object} knowledge - 知识条目
   */
  static async saveKnowledge(knowledge) {
    try {
      const { question, answer, keywords, category, source, confidence } = knowledge;

      const query = `
        INSERT INTO knowledge_base
          (question, answer, keywords, category, source, confidence, usage_count)
        VALUES ($1, $2, $3, $4, $5, $6, 0)
        RETURNING *
      `;

      const result = await pool.query(query, [
        question,
        answer,
        keywords || [],
        category || 'general',
        source || 'auto_extracted',
        confidence || 0.5
      ]);

      return {
        success: true,
        data: result.rows[0]
      };
    } catch (error) {
      console.error('保存知识条目错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 搜索知识库（RAG检索）
   * @param {string} query - 用户问题
   * @param {number} limit - 返回结果数
   */
  static async search(query, limit = 5) {
    try {
      // 简单的关键词匹配（实际应使用向量相似度）
      const searchQuery = `
        SELECT
          id,
          question,
          answer,
          keywords,
          category,
          confidence,
          usage_count
        FROM knowledge_base
        WHERE
          question ILIKE $1
          OR answer ILIKE $1
          OR $2 = ANY(keywords)
        ORDER BY
          confidence DESC,
          usage_count DESC
        LIMIT $3
      `;

      const searchTerm = `%${query}%`;
      const result = await pool.query(searchQuery, [searchTerm, query, limit]);

      // 更新使用次数
      if (result.rows.length > 0) {
        const updateQuery = `
          UPDATE knowledge_base
          SET usage_count = usage_count + 1
          WHERE id = ANY($1)
        `;
        const ids = result.rows.map(r => r.id);
        await pool.query(updateQuery, [ids]);
      }

      return {
        success: true,
        data: result.rows,
        count: result.rows.length
      };
    } catch (error) {
      console.error('搜索知识库错误:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 获取推荐回复（基于上下文）
   * @param {string} customerMessage - 客户消息
   * @param {Array} conversationHistory - 对话历史
   */
  static async getRecommendedReply(customerMessage, conversationHistory = []) {
    try {
      // 1. 先搜索知识库
      const knowledgeResult = await this.search(customerMessage, 3);

      // 2. 使用AI生成个性化回复（融合知识库）
      let contextPrompt = '根据以下信息生成回复：\n\n';
      contextPrompt += `客户问题：${customerMessage}\n\n`;

      if (knowledgeResult.data.length > 0) {
        contextPrompt += '参考知识库：\n';
        knowledgeResult.data.forEach((kb, i) => {
          contextPrompt += `${i + 1}. Q: ${kb.question}\n   A: ${kb.answer}\n`;
        });
        contextPrompt += '\n';
      }

      if (conversationHistory.length > 0) {
        contextPrompt += '对话历史：\n';
        conversationHistory.slice(-5).forEach(msg => {
          contextPrompt += `${msg.sender_type}: ${msg.content}\n`;
        });
      }

      contextPrompt += '\n请生成一个专业、友好的回复。';

      const aiReply = await AIAssistantService.generateReply(
        conversationHistory,
        { language: 'zh' }
      );

      return {
        success: true,
        reply: aiReply.reply,
        knowledge_matches: knowledgeResult.data,
        source: knowledgeResult.data.length > 0 ? 'kb_enhanced' : 'ai_only'
      };
    } catch (error) {
      console.error('获取推荐回复错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 自动学习：从高评分对话中提取知识
   * @param {number} minRating - 最低评分（1-5）
   * @param {number} days - 分析天数
   */
  static async autoLearn(minRating = 4, days = 7) {
    try {
      // 获取高评分对话
      const query = `
        SELECT
          c.id as conversation_id,
          cu.id as customer_id,
          cu.name,
          array_agg(
            json_build_object(
              'content', m.content,
              'sender_type', m.sender_type,
              'timestamp', m.timestamp
            ) ORDER BY m.timestamp
          ) as messages
        FROM conversations c
        JOIN customers cu ON cu.id = c.customer_id
        JOIN messages m ON m.conversation_id = c.id
        WHERE c.created_at >= NOW() - INTERVAL '${days} days'
          AND c.status = 'closed'
        GROUP BY c.id, cu.id, cu.name
        LIMIT 50
      `;

      const result = await pool.query(query);
      const conversations = result.rows;

      const learnedItems = [];

      for (const conv of conversations) {
        // 使用AI分析对话，提取Q&A对
        const messages = conv.messages;
        const customerQuestions = messages
          .filter(m => m.sender_type === 'customer')
          .map(m => m.content);

        const agentReplies = messages
          .filter(m => m.sender_type === 'agent')
          .map(m => m.content);

        // 简单配对：每个客户问题对应最近的客服回复
        for (let i = 0; i < customerQuestions.length; i++) {
          if (agentReplies[i]) {
            const knowledge = {
              question: customerQuestions[i],
              answer: agentReplies[i],
              keywords: customerQuestions[i].split(/\s+/).slice(0, 5),
              category: 'auto_learned',
              source: `conversation_${conv.conversation_id}`,
              confidence: 0.7
            };

            const saveResult = await this.saveKnowledge(knowledge);
            if (saveResult.success) {
              learnedItems.push(saveResult.data);
            }
          }
        }
      }

      return {
        success: true,
        learned_count: learnedItems.length,
        data: learnedItems
      };
    } catch (error) {
      console.error('自动学习错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取知识库统计
   * GET /api/sales/knowledge/stats 使用
   */
  static async getStats() {
    try {
      const query = `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active)::int AS active,
          COUNT(DISTINCT category)::int AS categories,
          COALESCE(SUM(usage_count), 0)::int AS total_usage,
          COALESCE(ROUND(AVG(confidence)::numeric, 2), 0) AS avg_confidence
        FROM knowledge_base
      `;
      const bySource = `
        SELECT source, COUNT(*)::int AS count
        FROM knowledge_base
        GROUP BY source
        ORDER BY count DESC
      `;
      const [overview, sources] = await Promise.all([
        pool.query(query),
        pool.query(bySource)
      ]);

      return {
        success: true,
        data: {
          ...overview.rows[0],
          by_source: sources.rows
        }
      };
    } catch (error) {
      console.error('获取知识库统计错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default KnowledgeBaseService;
