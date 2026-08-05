/**
 * 客户端路由 /api/customer/*（面向客户，公开入口）
 *
 * 认证方式：手机号 + 验证码，自助注册登录（无密码）。
 *   - 首次登录：手机号已存在则自动关联该客户，否则自动创建新客户
 *   - 验证通过后签发"客户 JWT"（与员工体系隔离）
 *
 * 安全：
 *   - 请求验证码接口按 手机号 + IP 双重限流，防短信轰炸
 *   - 验证码 6 位、5 分钟过期、一次性、限尝试次数
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import pool from '../db/salesPool.js';
import Customer from '../models/Customer.js';
import DocumentService from '../services/DocumentService.js';
import { sendCode as sendSmsCode } from '../services/SmsService.js';
import { generateCustomerToken, authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

const CODE_TTL_MINUTES = 5;       // 验证码有效期
const MAX_VERIFY_ATTEMPTS = 5;    // 单个验证码最多尝试次数

// 请求验证码限流：每 IP 15 分钟最多 10 次（叠加下面按手机号的节流）
const requestCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' }
});

/**
 * 简单手机号规范化 + 校验（宽松：要求 6-15 位数字，可带 + 前缀）
 */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 6 || digits.length > 15) return null;
  // 保留前导 + （国际号），其余只留数字
  return trimmed.startsWith('+') ? '+' + digits : digits;
}

function genCode() {
  // 6 位数字验证码
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * POST /api/customer/auth/request-code
 * 请求验证码。body: { phone, lang? }
 */
router.post('/auth/request-code', requestCodeLimiter, async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const lang = req.body.lang || 'ru';
    if (!phone) {
      return res.status(400).json({ success: false, error: '手机号格式不正确' });
    }

    // 按手机号节流：60 秒内已发过则拒绝（防轰炸同一号码）
    const recent = await pool.query(
      `SELECT created_at FROM customer_sms_codes
       WHERE phone = $1 AND created_at > NOW() - INTERVAL '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    if (recent.rows.length > 0) {
      return res.status(429).json({ success: false, error: '验证码发送过于频繁，请 60 秒后再试' });
    }

    const code = genCode();
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();

    await pool.query(
      `INSERT INTO customer_sms_codes (phone, code, expires_at, ip)
       VALUES ($1, $2, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes', $3)`,
      [phone, code, ip]
    );

    const smsResult = await sendSmsCode(phone, code, lang);
    if (!smsResult.success) {
      return res.status(502).json({ success: false, error: '验证码发送失败，请稍后再试' });
    }

    // 桩模式(SMS_PROVIDER=none)且非生产环境会回传验证码，方便测试
    const payload = { success: true, message: '验证码已发送', expires_in: CODE_TTL_MINUTES * 60 };
    if (smsResult.devCode) {
      payload.dev_code = smsResult.devCode;
      payload.dev_hint = '开发/测试模式：验证码直接返回（未接真实短信商）';
    }
    res.json(payload);
  } catch (error) {
    console.error('请求验证码错误:', error);
    res.status(500).json({ success: false, error: '服务异常' });
  }
});

/**
 * POST /api/customer/auth/verify
 * 校验验证码并登录/注册。body: { phone, code, name?, country? }
 */
router.post('/auth/verify', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = (req.body.code || '').toString().trim();
    if (!phone || !code) {
      return res.status(400).json({ success: false, error: '手机号和验证码不能为空' });
    }

    // 取该手机号最新一条未消费且未过期的验证码
    const codeRow = await pool.query(
      `SELECT * FROM customer_sms_codes
       WHERE phone = $1 AND consumed = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (codeRow.rows.length === 0) {
      return res.status(400).json({ success: false, error: '验证码不存在或已过期，请重新获取' });
    }

    const record = codeRow.rows[0];

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await pool.query('UPDATE customer_sms_codes SET consumed = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({ success: false, error: '尝试次数过多，请重新获取验证码' });
    }

    if (record.code !== code) {
      await pool.query('UPDATE customer_sms_codes SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      return res.status(400).json({ success: false, error: '验证码错误' });
    }

    // 验证通过：标记消费
    await pool.query('UPDATE customer_sms_codes SET consumed = TRUE WHERE id = $1', [record.id]);

    // 自助注册/登录：手机号已存在则关联，否则创建
    let customer = await Customer.findByPhone(phone);
    if (!customer) {
      customer = await Customer.create({
        name: req.body.name?.trim() || phone,
        phone,
        country: req.body.country || null,
        language: req.body.lang || 'ru',
        source: 'portal',
        status: 'active'
      });
      console.log('✅ 客户端自助注册新客户:', customer.id, phone);
    }

    // 更新登录/验证时间
    await pool.query(
      'UPDATE customers SET phone_verified_at = COALESCE(phone_verified_at, NOW()), last_login_at = NOW() WHERE id = $1',
      [customer.id]
    );

    const token = generateCustomerToken(customer);
    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        language: customer.language,
        country: customer.country
      }
    });
  } catch (error) {
    console.error('验证码登录错误:', error);
    res.status(500).json({ success: false, error: '服务异常' });
  }
});

/**
 * POST /api/customer/auth/logout —— 客户端 token 是无状态 JWT，前端清除即可
 */
router.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: '已退出登录' });
});

/**
 * GET /api/customer/me —— 当前客户资料
 */
router.get('/me', authenticateCustomer, (req, res) => {
  res.json({ success: true, customer: req.customer });
});

// ---- 报价相关（仅能看发给自己的、已发布的报价）----

/**
 * GET /api/customer/quotations —— 我的报价列表（只含 sent/accepted/rejected/expired，不含 draft）
 */
router.get('/quotations', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, quotation_no, vehicles, subtotal, tax, total, currency,
              valid_until, status, sent_at, accepted_at, created_at
       FROM quotations
       WHERE customer_id = $1 AND status <> 'draft'
       ORDER BY created_at DESC`,
      [req.customer.id]
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('查询客户报价列表错误:', error);
    res.status(500).json({ success: false, error: '服务异常' });
  }
});

/**
 * GET /api/customer/quotations/:id —— 报价详情（含 html_content），限本人且非 draft
 */
router.get('/quotations/:id', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quotations
       WHERE id = $1 AND customer_id = $2 AND status <> 'draft'`,
      [req.params.id, req.customer.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '报价单不存在或无权查看' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('查询报价详情错误:', error);
    res.status(500).json({ success: false, error: '服务异常' });
  }
});

/**
 * POST /api/customer/quotations/:id/accept —— 客户接受报价
 */
router.post('/quotations/:id/accept', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE quotations
       SET status = 'accepted', accepted_at = NOW()
       WHERE id = $1 AND customer_id = $2 AND status = 'sent'
       RETURNING id, quotation_no, status, accepted_at`,
      [req.params.id, req.customer.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: '报价单不存在、无权操作或状态不允许接受' });
    }
    res.json({ success: true, message: '已接受报价', data: result.rows[0] });
  } catch (error) {
    console.error('接受报价错误:', error);
    res.status(500).json({ success: false, error: '服务异常' });
  }
});

export default router;
