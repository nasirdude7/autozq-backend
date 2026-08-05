import { query } from '../db/salesPool.js';
import AIAssistantService from './AIAssistantService.js';

/**
 * 客户评级服务
 * 提供智能评级、画像生成等功能
 */
class CustomerRatingService {
  /**
   * 计算客户评级
   * @param {string} customerId - 客户ID
   */
  static async rateCustomer(customerId) {
    try {
      // 获取客户画像
      const profileQuery = `
        SELECT * FROM customer_profiles
        WHERE customer_id = $1
      `;
      const profileResult = await query(profileQuery, [customerId]);
      const profile = profileResult.rows[0];

      if (!profile) {
        throw new Error('客户画像不存在，请先生成画像');
      }

      // 评分算法
      let score = 0;
      const factors = {};

      // 1. 购买意向分数 (40%)
      const intentScore = profile.purchase_intent_score || 0;
      factors.purchase_intent = {
        score: intentScore,
        weight: 0.4,
        contribution: intentScore * 0.4
      };
      score += intentScore * 0.4;

      // 2. 互动频率 (20%)
      const interactionCount = profile.interaction_count || 0;
      const interactionScore = Math.min((interactionCount / 10) * 100, 100);
      factors.interaction_frequency = {
        score: interactionScore,
        weight: 0.2,
        contribution: interactionScore * 0.2
      };
      score += interactionScore * 0.2;

      // 3. 响应速度 (20%)
      const avgResponseTime = profile.avg_response_time || 7200; // 默认2小时
      let responseScore = 0;
      if (avgResponseTime < 1800) responseScore = 100; // < 30分钟
      else if (avgResponseTime < 3600) responseScore = 80; // < 1小时
      else if (avgResponseTime < 7200) responseScore = 60; // < 2小时
      else if (avgResponseTime < 14400) responseScore = 40; // < 4小时
      else responseScore = 20;

      factors.response_speed = {
        score: responseScore,
        weight: 0.2,
        contribution: responseScore * 0.2
      };
      score += responseScore * 0.2;

      // 4. 行为标签 (20%)
      const behaviorTags = profile.behavior_tags || [];
      let behaviorScore = 50; // 默认50分

      // 积极标签加分
      const positiveTagsCount = behaviorTags.filter(tag =>
        ['询问价格', '询问配置', '询问库存', '询问运输', '要求报价', '预约看车'].includes(tag)
      ).length;
      behaviorScore += positiveTagsCount * 10;

      // 消极标签减分
      const negativeTags = behaviorTags.filter(tag =>
        ['价格敏感', '多次询问不购买', '响应缓慢'].includes(tag)
      ).length;
      behaviorScore -= negativeTags * 5;

      behaviorScore = Math.max(0, Math.min(100, behaviorScore));

      factors.behavior_analysis = {
        score: behaviorScore,
        weight: 0.2,
        contribution: behaviorScore * 0.2
      };
      score += behaviorScore * 0.2;

      // 确保分数在 0-100 之间
      score = Math.max(0, Math.min(100, score));

      // 确定评级
      let rating;
      if (score >= 80) rating = 'A';
      else if (score >= 60) rating = 'B';
      else if (score >= 40) rating = 'C';
      else rating = 'D';

      // 保存评级记录
      const insertText = `
        INSERT INTO customer_ratings (customer_id, rating, score, factors, rated_by)
        VALUES ($1, $2, $3, $4, 'ai')
        RETURNING *
      `;
      const ratingResult = await query(insertText, [
        customerId,
        rating,
        Math.round(score),
        JSON.stringify(factors)
      ]);

      // 更新客户表的评级
      const updateText = `
        UPDATE customers
        SET rating = $1
        WHERE id = $2
      `;
      await query(updateText, [rating, customerId]);

      return {
        success: true,
        rating,
        score: Math.round(score),
        factors,
        recommendation: this.getRecommendation(rating, score)
      };
    } catch (error) {
      console.error('客户评级错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成客户画像
   * @param {string} customerId - 客户ID
   */
  static async generateProfile(customerId) {
    try {
      // 获取客户信息
      const customerQuery = `
        SELECT * FROM customers WHERE id = $1
      `;
      const customerResult = await query(customerQuery, [customerId]);
      const customer = customerResult.rows[0];

      if (!customer) {
        throw new Error('客户不存在');
      }

      // 获取消息历史
      const messagesQuery = `
        SELECT m.* FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.customer_id = $1
        ORDER BY m.timestamp DESC
        LIMIT 50
      `;
      const messagesResult = await query(messagesQuery, [customerId]);
      const messages = messagesResult.rows;

      // 计算基础统计
      const customerMessages = messages.filter(m => m.sender_type === 'customer');
      const agentMessages = messages.filter(m => m.sender_type === 'agent');

      const interactionCount = customerMessages.length;

      // 计算平均响应时间
      let totalResponseTime = 0;
      let responseCount = 0;

      for (let i = 0; i < agentMessages.length; i++) {
        const agentMsg = agentMessages[i];
        // 找到这条回复前最近的客户消息
        const prevCustomerMsg = messages.find(m =>
          m.sender_type === 'customer' &&
          new Date(m.timestamp) < new Date(agentMsg.timestamp)
        );

        if (prevCustomerMsg) {
          const responseTime = (new Date(agentMsg.timestamp) - new Date(prevCustomerMsg.timestamp)) / 1000;
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      const avgResponseTime = responseCount > 0
        ? Math.round(totalResponseTime / responseCount)
        : null;

      // 使用 AI 生成画像
      const aiProfile = await AIAssistantService.generateCustomerProfile({
        customer,
        messages,
        interactions: []
      });

      if (!aiProfile.success) {
        throw new Error('AI画像生成失败: ' + aiProfile.error);
      }

      const profile = aiProfile.profile;

      // 保存或更新画像
      const upsertText = `
        INSERT INTO customer_profiles (
          customer_id,
          purchase_intent_score,
          budget_range,
          preferred_brands,
          preferred_vehicle_types,
          behavior_tags,
          communication_style,
          ai_summary,
          interaction_count,
          avg_response_time,
          last_analysis_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (customer_id)
        DO UPDATE SET
          purchase_intent_score = EXCLUDED.purchase_intent_score,
          budget_range = EXCLUDED.budget_range,
          preferred_brands = EXCLUDED.preferred_brands,
          preferred_vehicle_types = EXCLUDED.preferred_vehicle_types,
          behavior_tags = EXCLUDED.behavior_tags,
          communication_style = EXCLUDED.communication_style,
          ai_summary = EXCLUDED.ai_summary,
          interaction_count = EXCLUDED.interaction_count,
          avg_response_time = EXCLUDED.avg_response_time,
          last_analysis_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;

      const result = await query(upsertText, [
        customerId,
        profile.purchase_intent_score || 50,
        profile.budget_range || 'unknown',
        profile.preferred_brands || [],
        profile.preferred_vehicle_types || [],
        profile.behavior_tags || [],
        profile.communication_style || 'normal',
        profile.ai_summary || '',
        interactionCount,
        avgResponseTime
      ]);

      return {
        success: true,
        profile: result.rows[0],
        recommendations: profile.recommendations
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
   * 批量评级
   * @param {Array} customerIds - 客户ID数组
   */
  static async batchRate(customerIds) {
    const results = [];

    for (const customerId of customerIds) {
      try {
        // 先生成画像
        const profileResult = await this.generateProfile(customerId);
        if (!profileResult.success) {
          results.push({
            customerId,
            success: false,
            error: profileResult.error
          });
          continue;
        }

        // 再进行评级
        const ratingResult = await this.rateCustomer(customerId);
        results.push({
          customerId,
          ...ratingResult
        });
      } catch (error) {
        results.push({
          customerId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 获取评级建议
   */
  static getRecommendation(rating, score) {
    const recommendations = {
      A: {
        priority: '高优先级',
        action: '重点跟进，尽快促成交易',
        tips: [
          '立即分配给资深销售',
          '提供VIP服务',
          '准备详细报价方案',
          '安排专人跟进',
          '考虑提供优惠或增值服务'
        ]
      },
      B: {
        priority: '中高优先级',
        action: '持续培育，推动决策',
        tips: [
          '定期跟进，保持联系',
          '提供更多产品信息',
          '解答疑问，建立信任',
          '分享成功案例',
          '适时推送促销信息'
        ]
      },
      C: {
        priority: '中等优先级',
        action: '长期培育，观察意向变化',
        tips: [
          '定期发送有价值内容',
          '了解客户真实需求',
          '耐心解答问题',
          '建立长期关系',
          '等待时机成熟'
        ]
      },
      D: {
        priority: '低优先级',
        action: '保持联系，低成本维护',
        tips: [
          '加入邮件列表',
          '偶尔发送信息',
          '不投入过多资源',
          '观察是否有变化',
          '考虑是否值得继续跟进'
        ]
      }
    };

    return recommendations[rating] || recommendations.D;
  }

  /**
   * 获取客户评级历史
   */
  static async getRatingHistory(customerId, limit = 10) {
    const text = `
      SELECT * FROM customer_ratings
      WHERE customer_id = $1
      ORDER BY rated_at DESC
      LIMIT $2
    `;

    const result = await query(text, [customerId, limit]);
    return result.rows;
  }

  /**
   * 获取评级统计
   */
  static async getRatingStats(agentId = null) {
    let text = `
      SELECT
        rating,
        COUNT(*) as count,
        AVG(score) as avg_score
      FROM (
        SELECT DISTINCT ON (customer_id) *
        FROM customer_ratings
        ORDER BY customer_id, rated_at DESC
      ) latest_ratings
    `;

    const values = [];

    if (agentId) {
      text += `
        WHERE customer_id IN (
          SELECT id FROM customers WHERE assigned_to = $1
        )
      `;
      values.push(agentId);
    }

    text += `
      GROUP BY rating
      ORDER BY rating
    `;

    const result = await query(text, values);
    return result.rows;
  }
}

export default CustomerRatingService;
