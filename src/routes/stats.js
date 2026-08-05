import express from 'express';
import { query } from '../db/salesPool.js';
import Customer from '../models/Customer.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import CustomerRatingService from '../services/CustomerRatingService.js';

const router = express.Router();

/**
 * 获取数据看板统计
 * GET /api/sales/stats/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { agent_id, date_from, date_to } = req.query;

    // 客户统计
    const customerStats = {
      total: await Customer.count({ status: 'active' }),
      new_today: await query(
        `SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE`,
        []
      ).then(r => parseInt(r.rows[0].count)),
      by_rating: await query(
        `SELECT rating, COUNT(*) as count FROM customers WHERE status = 'active' GROUP BY rating`,
        []
      ).then(r => r.rows)
    };

    // 会话统计
    const conversationStats = {
      active: await Conversation.count({ status: 'active' }),
      unread: await Conversation.count({ status: 'active', unread_only: true }),
      closed_today: await query(
        `SELECT COUNT(*) FROM conversations WHERE status = 'closed' AND DATE(updated_at) = CURRENT_DATE`,
        []
      ).then(r => parseInt(r.rows[0].count))
    };

    // 消息统计
    const messageStats = {
      total_today: await query(
        `SELECT COUNT(*) FROM messages WHERE DATE(timestamp) = CURRENT_DATE`,
        []
      ).then(r => parseInt(r.rows[0].count)),
      by_type: await query(
        `SELECT sender_type, COUNT(*) as count FROM messages WHERE DATE(timestamp) = CURRENT_DATE GROUP BY sender_type`,
        []
      ).then(r => r.rows)
    };

    // 客服工作量统计
    const agentWorkload = await query(
      `SELECT
        u.id,
        u.full_name,
        u.workload,
        COUNT(DISTINCT c.id) as customer_count,
        COUNT(DISTINCT conv.id) as conversation_count
      FROM users u
      LEFT JOIN customers c ON c.assigned_to = u.id AND c.status = 'active'
      LEFT JOIN conversations conv ON conv.assigned_to = u.id AND conv.status = 'active'
      WHERE u.role IN ('agent', 'manager') AND u.status = 'active'
      GROUP BY u.id, u.full_name, u.workload
      ORDER BY u.workload DESC`,
      []
    ).then(r => r.rows);

    // 评级分布
    const ratingDistribution = await CustomerRatingService.getRatingStats(agent_id);

    res.json({
      success: true,
      data: {
        customers: customerStats,
        conversations: conversationStats,
        messages: messageStats,
        agents: agentWorkload,
        ratings: ratingDistribution,
        generated_at: new Date()
      }
    });
  } catch (error) {
    console.error('获取看板数据错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客服统计
 * GET /api/sales/stats/agents
 */
router.get('/agents', async (req, res) => {
  try {
    const { agent_id, date_from, date_to } = req.query;

    let whereClause = '';
    const values = [];
    let paramCount = 1;

    if (agent_id) {
      whereClause = `WHERE u.id = $${paramCount}`;
      values.push(agent_id);
      paramCount++;
    }

    const agentStats = await query(
      `SELECT
        u.id,
        u.full_name,
        u.email,
        u.status,
        u.workload,
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT CASE WHEN c.rating = 'A' THEN c.id END) as a_customers,
        COUNT(DISTINCT CASE WHEN c.rating = 'B' THEN c.id END) as b_customers,
        COUNT(DISTINCT CASE WHEN c.rating = 'C' THEN c.id END) as c_customers,
        COUNT(DISTINCT CASE WHEN c.rating = 'D' THEN c.id END) as d_customers,
        COUNT(DISTINCT conv.id) as total_conversations,
        COUNT(DISTINCT CASE WHEN conv.status = 'active' THEN conv.id END) as active_conversations,
        COUNT(DISTINCT CASE WHEN conv.unread_count > 0 THEN conv.id END) as unread_conversations,
        (
          SELECT COUNT(*)
          FROM messages m
          JOIN conversations conv2 ON m.conversation_id = conv2.id
          WHERE conv2.assigned_to = u.id
            AND m.sender_type = 'agent'
            AND DATE(m.timestamp) = CURRENT_DATE
        ) as messages_sent_today,
        (
          SELECT AVG(EXTRACT(EPOCH FROM (m2.timestamp - m1.timestamp)))
          FROM messages m1
          JOIN messages m2 ON m1.conversation_id = m2.conversation_id
          JOIN conversations conv3 ON m1.conversation_id = conv3.id
          WHERE conv3.assigned_to = u.id
            AND m1.sender_type = 'customer'
            AND m2.sender_type = 'agent'
            AND m2.timestamp > m1.timestamp
            AND m2.timestamp = (
              SELECT MIN(timestamp)
              FROM messages
              WHERE conversation_id = m1.conversation_id
                AND sender_type = 'agent'
                AND timestamp > m1.timestamp
            )
        ) as avg_response_time_seconds
      FROM users u
      LEFT JOIN customers c ON c.assigned_to = u.id
      LEFT JOIN conversations conv ON conv.assigned_to = u.id
      ${whereClause}
      GROUP BY u.id, u.full_name, u.email, u.status, u.workload
      ORDER BY u.full_name`,
      values
    );

    res.json({
      success: true,
      data: agentStats.rows
    });
  } catch (error) {
    console.error('获取客服统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户统计
 * GET /api/sales/stats/customers
 */
router.get('/customers', async (req, res) => {
  try {
    const { agent_id, date_from, date_to } = req.query;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (agent_id) {
      whereClause += ` AND assigned_to = $${paramCount}`;
      values.push(agent_id);
      paramCount++;
    }

    // 按评级统计
    const byRating = await query(
      `SELECT
        rating,
        COUNT(*) as count,
        COUNT(CASE WHEN DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_this_week
      FROM customers
      ${whereClause}
      GROUP BY rating
      ORDER BY rating`,
      values
    );

    // 按来源统计
    const bySource = await query(
      `SELECT
        source,
        COUNT(*) as count
      FROM customers
      ${whereClause}
      GROUP BY source
      ORDER BY count DESC`,
      values
    );

    // 按国家统计
    const byCountry = await query(
      `SELECT
        country,
        COUNT(*) as count
      FROM customers
      ${whereClause} AND country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10`,
      values
    );

    // 新增趋势（最近30天）
    const newCustomerTrend = await query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM customers
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        ${agent_id ? `AND assigned_to = $${paramCount}` : ''}
      GROUP BY DATE(created_at)
      ORDER BY date`,
      agent_id ? [agent_id] : []
    );

    res.json({
      success: true,
      data: {
        by_rating: byRating.rows,
        by_source: bySource.rows,
        by_country: byCountry.rows,
        new_customer_trend: newCustomerTrend.rows
      }
    });
  } catch (error) {
    console.error('获取客户统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取会话统计
 * GET /api/sales/stats/conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { agent_id, date_from, date_to } = req.query;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (agent_id) {
      whereClause += ` AND assigned_to = $${paramCount}`;
      values.push(agent_id);
      paramCount++;
    }

    // 按状态统计
    const byStatus = await query(
      `SELECT
        status,
        COUNT(*) as count
      FROM conversations
      ${whereClause}
      GROUP BY status`,
      values
    );

    // 按平台统计
    const byPlatform = await query(
      `SELECT
        platform,
        COUNT(*) as count
      FROM conversations
      ${whereClause}
      GROUP BY platform`,
      values
    );

    // 消息量趋势（最近7天）
    const messageTrend = await query(
      `SELECT
        DATE(m.timestamp) as date,
        COUNT(*) as message_count,
        COUNT(DISTINCT m.conversation_id) as conversation_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.timestamp >= CURRENT_DATE - INTERVAL '7 days'
        ${agent_id ? `AND c.assigned_to = $${paramCount}` : ''}
      GROUP BY DATE(m.timestamp)
      ORDER BY date`,
      agent_id ? [agent_id] : []
    );

    // 响应时间分析
    const responseTimeStats = await query(
      `SELECT
        AVG(EXTRACT(EPOCH FROM (m2.timestamp - m1.timestamp))) as avg_seconds,
        MIN(EXTRACT(EPOCH FROM (m2.timestamp - m1.timestamp))) as min_seconds,
        MAX(EXTRACT(EPOCH FROM (m2.timestamp - m1.timestamp))) as max_seconds
      FROM messages m1
      JOIN messages m2 ON m1.conversation_id = m2.conversation_id
      JOIN conversations conv ON m1.conversation_id = conv.id
      WHERE m1.sender_type = 'customer'
        AND m2.sender_type = 'agent'
        AND m2.timestamp > m1.timestamp
        AND m2.timestamp = (
          SELECT MIN(timestamp)
          FROM messages
          WHERE conversation_id = m1.conversation_id
            AND sender_type = 'agent'
            AND timestamp > m1.timestamp
        )
        AND DATE(m1.timestamp) >= CURRENT_DATE - INTERVAL '7 days'
        ${agent_id ? `AND conv.assigned_to = $${paramCount}` : ''}`,
      agent_id ? [agent_id] : []
    );

    res.json({
      success: true,
      data: {
        by_status: byStatus.rows,
        by_platform: byPlatform.rows,
        message_trend: messageTrend.rows,
        response_time: responseTimeStats.rows[0]
      }
    });
  } catch (error) {
    console.error('获取会话统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取实时统计（轻量级，用于实时刷新）
 * GET /api/sales/stats/realtime
 */
router.get('/realtime', async (req, res) => {
  try {
    const { agent_id } = req.query;

    const stats = {
      pending_conversations: await query(
        `SELECT COUNT(*) FROM conversations
         WHERE status = 'active' AND unread_count > 0
         ${agent_id ? `AND assigned_to = $1` : ''}`,
        agent_id ? [agent_id] : []
      ).then(r => parseInt(r.rows[0].count)),

      active_conversations: await query(
        `SELECT COUNT(*) FROM conversations
         WHERE status = 'active'
         ${agent_id ? `AND assigned_to = $1` : ''}`,
        agent_id ? [agent_id] : []
      ).then(r => parseInt(r.rows[0].count)),

      messages_today: await query(
        `SELECT COUNT(*) FROM messages m
         ${agent_id ? 'JOIN conversations c ON m.conversation_id = c.id' : ''}
         WHERE DATE(m.timestamp) = CURRENT_DATE
         ${agent_id ? `AND c.assigned_to = $1` : ''}`,
        agent_id ? [agent_id] : []
      ).then(r => parseInt(r.rows[0].count)),

      new_customers_today: await query(
        `SELECT COUNT(*) FROM customers
         WHERE DATE(created_at) = CURRENT_DATE
         ${agent_id ? `AND assigned_to = $1` : ''}`,
        agent_id ? [agent_id] : []
      ).then(r => parseInt(r.rows[0].count))
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('获取实时统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
