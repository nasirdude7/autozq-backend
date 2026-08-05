/**
 * 客户端 JWT 认证中间件（与员工端 auth.js 完全独立）
 *
 * 关键隔离：token payload 带 type:'customer'。
 *   - 客户 token 不能访问员工接口（员工中间件 authenticateToken 不校验 type，
 *     但客户 payload 里没有员工 id，findUserById 会失败 → 拒绝）
 *   - 员工 token 不能访问客户接口（这里校验 type !== 'customer' → 拒绝）
 * 这样两套体系互不越权。
 */
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';

const JWT_SECRET = process.env.JWT_SECRET || 'autozq-secret-key-change-in-production';
const CUSTOMER_TOKEN_EXPIRES = process.env.CUSTOMER_TOKEN_EXPIRES || '30d';

/**
 * 生成客户端 JWT
 * @param {Object} customer - { id, phone }
 */
export function generateCustomerToken(customer) {
  const payload = {
    type: 'customer',   // 身份标识：客户
    id: customer.id,
    phone: customer.phone
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: CUSTOMER_TOKEN_EXPIRES });
}

/**
 * 客户端认证中间件
 */
export async function authenticateCustomer(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: '未登录，请先登录' });
  }

  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({ success: false, error: '登录已失效，请重新登录' });
    }

    // 必须是客户类型的 token，拒绝员工 token 越权访问客户接口
    if (!payload || payload.type !== 'customer') {
      return res.status(403).json({ success: false, error: '无效的客户身份' });
    }

    // 确认客户仍存在
    const customer = await Customer.findById(payload.id);
    if (!customer) {
      return res.status(403).json({ success: false, error: '客户不存在' });
    }

    req.customer = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      language: customer.language,
      country: customer.country
    };

    next();
  });
}

export default { generateCustomerToken, authenticateCustomer };
