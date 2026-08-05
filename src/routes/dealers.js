import express from 'express';
import { query } from '../db/salesPool.js';
import { checkRole } from '../middleware/checkRole.js';

const router = express.Router();

// B端经销商标签名（数据库中的系统标签）
const B2B_LABEL_NAME = '🏢 B端经销商';

// 所有经销商端点仅超级管理员可访问
router.use(checkRole(['super_admin']));

/**
 * 获取 B端经销商标签 ID（内部辅助）
 */
async function getB2BLabelId() {
  const result = await query(
    `SELECT id FROM labels WHERE name = $1 LIMIT 1`,
    [B2B_LABEL_NAME]
  );
  return result.rows[0]?.id || null;
}

/**
 * B端经销商列表
 * GET /api/dealers
 */
router.get('/', async (req, res) => {
  try {
    const labelId = await getB2BLabelId();
    if (!labelId) {
      return res.json({ success: true, data: [], count: 0, message: 'B端经销商标签未配置' });
    }

    const dealers = await query(
      `SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.country,
        c.language,
        c.source,
        c.status,
        c.last_contact_at,
        c.created_at,
        s.full_name AS assigned_agent,
        ca.intent_score,
        ca.intent_level,
        (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = c.id) AS order_count,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o
          WHERE o.customer_id = c.id AND o.status NOT IN ('cancelled')) AS total_amount
      FROM customers c
      JOIN customer_labels cl ON cl.customer_id = c.id
      LEFT JOIN staff_users s ON s.id = c.assigned_to
      LEFT JOIN customer_analysis ca ON ca.customer_id = c.id
      WHERE cl.label_id = $1
      ORDER BY c.last_contact_at DESC NULLS LAST`,
      [labelId]
    ).then(r => r.rows);

    res.json({ success: true, data: dealers, count: dealers.length });
  } catch (error) {
    console.error('获取经销商列表错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * B端经销商监控概览
 * GET /api/dealers/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const labelId = await getB2BLabelId();
    if (!labelId) {
      return res.json({ success: true, data: { total: 0 }, message: 'B端经销商标签未配置' });
    }

    const overview = await query(
      `SELECT
        COUNT(DISTINCT c.id)::int AS total,
        COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days')::int AS new_this_month,
        COUNT(DISTINCT c.id) FILTER (WHERE c.last_contact_at >= CURRENT_DATE - INTERVAL '7 days')::int AS active_this_week,
        COUNT(DISTINCT c.id) FILTER (WHERE c.last_contact_at < CURRENT_DATE - INTERVAL '14 days' OR c.last_contact_at IS NULL)::int AS needs_followup
      FROM customers c
      JOIN customer_labels cl ON cl.customer_id = c.id
      WHERE cl.label_id = $1`,
      [labelId]
    ).then(r => r.rows[0]);

    // 经销商业绩（订单）
    const business = await query(
      `SELECT
        COUNT(DISTINCT o.id)::int AS total_orders,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('cancelled')), 0) AS total_revenue
      FROM orders o
      JOIN customer_labels cl ON cl.customer_id = o.customer_id
      WHERE cl.label_id = $1`,
      [labelId]
    ).then(r => r.rows[0]);

    res.json({
      success: true,
      data: { ...overview, ...business }
    });
  } catch (error) {
    console.error('获取经销商概览错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 标记/取消标记客户为 B端经销商
 * POST /api/dealers/:customerId/mark
 * body: { is_dealer: true|false }
 */
router.post('/:customerId/mark', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { is_dealer = true } = req.body;

    const labelId = await getB2BLabelId();
    if (!labelId) {
      return res.status(400).json({ success: false, error: 'B端经销商标签未配置' });
    }

    // 确认客户存在
    const customer = await query(`SELECT id FROM customers WHERE id = $1`, [customerId]);
    if (customer.rows.length === 0) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }

    if (is_dealer) {
      await query(
        `INSERT INTO customer_labels (customer_id, label_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (customer_id, label_id) DO NOTHING`,
        [customerId, labelId, req.user.id]
      );
    } else {
      await query(
        `DELETE FROM customer_labels WHERE customer_id = $1 AND label_id = $2`,
        [customerId, labelId]
      );
    }

    res.json({
      success: true,
      message: is_dealer ? '已标记为B端经销商' : '已取消B端经销商标记'
    });
  } catch (error) {
    console.error('标记经销商错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
