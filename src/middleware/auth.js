/**
 * JWT认证中间件
 */
import jwt from 'jsonwebtoken';
import { findUserById } from '../models/User.js';
import StaffUser from '../models/StaffUser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'autozq-secret-key-change-in-production';

/**
 * 生成JWT token
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d' // token有效期7天
  });
}

/**
 * 验证JWT token中间件（支持员工和旧系统用户）
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '未提供认证令牌'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: '无效的认证令牌'
      });
    }

    // 判断是员工 token 还是旧系统 token
    if (payload.type === 'staff') {
      // 员工 token（新系统）
      StaffUser.findById(payload.id).then(user => {
        if (!user) {
          return res.status(403).json({
            success: false,
            error: '用户不存在'
          });
        }

        if (user.status !== 'active') {
          return res.status(403).json({
            success: false,
            error: '账号已被停用'
          });
        }

        // 将用户信息附加到请求对象
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          type: 'staff'
        };

        next();
      }).catch(error => {
        console.error('认证错误:', error);
        return res.status(500).json({
          success: false,
          error: '认证失败'
        });
      });
    } else {
      // 旧系统用户 token（兼容性）
      const user = findUserById(payload.id);
      if (!user) {
        return res.status(403).json({
          success: false,
          error: '用户不存在'
        });
      }

      // 将用户信息附加到请求对象
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        sites: user.sites
      };

      next();
    }
  });
}

/**
 * 专用于员工系统的 JWT 认证（更严格）
 */
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '未提供认证令牌'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // 必须是员工 token
    if (payload.type !== 'staff') {
      return res.status(403).json({
        success: false,
        error: '无效的令牌类型'
      });
    }

    const user = await StaffUser.findById(payload.id);

    if (!user) {
      return res.status(403).json({
        success: false,
        error: '用户不存在'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: '账号已被停用'
      });
    }

    // 将用户信息附加到请求对象
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      type: 'staff'
    };

    // 同时附加用户角色（用于权限过滤）
    req.userRole = user.role;

    next();
  } catch (error) {
    console.error('认证错误:', error);
    return res.status(403).json({
      success: false,
      error: '无效的认证令牌'
    });
  }
}

/**
 * 验证管理员权限
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: '需要管理员权限'
    });
  }
  next();
}

/**
 * 验证站点访问权限
 */
export function requireSiteAccess(req, res, next) {
  const siteId = req.body.site_id || req.query.site_id || req.params.siteId;

  if (!siteId) {
    return next(); // 没有指定站点，继续
  }

  // 管理员可以访问所有站点
  if (req.user.role === 'admin') {
    return next();
  }

  // 检查用户是否有该站点的访问权限
  if (!req.user.sites || !req.user.sites.includes(siteId)) {
    return res.status(403).json({
      success: false,
      error: '没有该站点的访问权限'
    });
  }

  next();
}
