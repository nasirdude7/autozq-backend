import express from 'express';
import { query } from '../db/salesPool.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

/**
 * 数据分析总览
 * GET /api/analytics/overview
 * 权限：主管及以上看全部；坐席只看自己
 */
router.get('/overview', async (req, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;

    // 坐席只能看自己名下的客户；主管/超管看全部
    const scopeCustomers = role === 'agent'
      ? { clause: 'WHERE assigned_to = $1', values: [userId] }
      : { clause: '', values: [] };

    // 客户概览
    const customerOverview = await query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::int AS new_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int AS new_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::int AS new_this_month,
        COUNT(*) FILTER (WHERE assigned_to IS NULL)::int AS unassigned
      FROM customers
      ${scopeCustomers.clause}`,
      scopeCustomers.values
    ).then(r => r.rows[0]);

    // 会话概览
    const convScope = role === 'agent'
      ? { clause: 'WHERE assigned_to = $1', values: [userId] }
      : { clause: '', values: [] };

    const conversationOverview = await query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE unread_count > 0)::int AS unread,
        COALESCE(SUM(unread_count), 0)::int AS unread_messages
      FROM conversations
      ${convScope.clause}`,
      convScope.values
    ).then(r => r.rows[0]);

    // 消息概览（今日）
    const messageOverview = await query(
      `SELECT
        COUNT(*)::int AS total_today,
        COUNT(*) FILTER (WHERE sender_type = 'customer')::int AS from_customer,
        COUNT(*) FILTER (WHERE sender_type = 'agent')::int AS from_agent
      FROM messages
      WHERE DATE(timestamp) = CURRENT_DATE`,
      []
    ).then(r => r.rows[0]);

    // 报价与订单（业绩）
    const businessOverview = await query(
      `SELECT
        (SELECT COUNT(*)::int FROM quotations) AS total_quotations,
        (SELECT COUNT(*)::int FROM quotations WHERE status = 'accepted') AS accepted_quotations,
        (SELECT COUNT(*)::int FROM orders) AS total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status NOT IN ('cancelled')) AS total_revenue`,
      []
    ).then(r => r.rows[0]);

    res.json({
      success: true,
      data: {
        customers: customerOverview,
        conversations: conversationOverview,
        messages: messageOverview,
        business: businessOverview,
        scope: role === 'agent' ? 'self' : 'all',
        generated_at: new Date()
      }
    });
  } catch (error) {
    console.error('获取分析总览错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 趋势分析（客户增长 + 消息量，最近 N 天）
 * GET /api/analytics/trends?days=30
 */
router.get('/trends', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    // 客户新增趋势
    const customerTrend = await query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
       FROM customers
       WHERE created_at >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [days]
    ).then(r => r.rows);

    // 消息量趋势（区分收发）
    const messageTrend = await query(
      `SELECT
        DATE(timestamp) AS date,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE sender_type = 'customer')::int AS inbound,
        COUNT(*) FILTER (WHERE sender_type = 'agent')::int AS outbound
      FROM messages
      WHERE timestamp >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
      GROUP BY DATE(timestamp)
      ORDER BY date`,
      [days]
    ).then(r => r.rows);

    res.json({
      success: true,
      data: {
        days,
        customer_trend: customerTrend,
        message_trend: messageTrend
      }
    });
  } catch (error) {
    console.error('获取趋势分析错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 客户分布（来源 / 国家 / 语言 / 意向等级）
 * GET /api/analytics/distribution
 */
router.get('/distribution', async (req, res) => {
  try {
    const bySource = await query(
      `SELECT COALESCE(NULLIF(source, ''), '未知') AS source, COUNT(*)::int AS count
       FROM customers GROUP BY source ORDER BY count DESC`,
      []
    ).then(r => r.rows);

    const byCountry = await query(
      `SELECT COALESCE(NULLIF(country, ''), '未知') AS country, COUNT(*)::int AS count
       FROM customers GROUP BY country ORDER BY count DESC LIMIT 10`,
      []
    ).then(r => r.rows);

    const byLanguage = await query(
      `SELECT COALESCE(NULLIF(language, ''), '未知') AS language, COUNT(*)::int AS count
       FROM customers GROUP BY language ORDER BY count DESC`,
      []
    ).then(r => r.rows);

    // 意向等级（来自 AI 分析）
    const byIntent = await query(
      `SELECT COALESCE(intent_level, '未分析') AS intent_level, COUNT(*)::int AS count
       FROM customer_analysis GROUP BY intent_level ORDER BY count DESC`,
      []
    ).then(r => r.rows);

    res.json({
      success: true,
      data: {
        by_source: bySource,
        by_country: byCountry,
        by_language: byLanguage,
        by_intent: byIntent
      }
    });
  } catch (error) {
    console.error('获取客户分布错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 客服绩效排行（仅主管/超管）
 * GET /api/analytics/agents
 */
router.get('/agents', checkRole(['super_admin', 'manager']), async (req, res) => {
  try {
    const agentStats = await query(
      `SELECT
        s.id,
        s.full_name,
        s.username,
        s.role,
        COUNT(DISTINCT c.id)::int AS customer_count,
        COUNT(DISTINCT conv.id)::int AS conversation_count,
        COUNT(DISTINCT conv.id) FILTER (WHERE conv.status = 'active')::int AS active_conversations,
        (
          SELECT COUNT(*)::int
          FROM messages m
          JOIN conversations c2 ON m.conversation_id = c2.id
          WHERE c2.assigned_to = s.id
            AND m.sender_type = 'agent'
            AND m.timestamp >= CURRENT_DATE - INTERVAL '7 days'
        ) AS messages_sent_7d
      FROM staff_users s
      LEFT JOIN customers c ON c.assigned_to = s.id
      LEFT JOIN conversations conv ON conv.assigned_to = s.id
      WHERE s.status = 'active' AND s.role IN ('agent', 'manager', 'super_admin')
      GROUP BY s.id, s.full_name, s.username, s.role
      ORDER BY customer_count DESC, messages_sent_7d DESC`,
      []
    ).then(r => r.rows);

    res.json({ success: true, data: agentStats });
  } catch (error) {
    console.error('获取客服绩效错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
