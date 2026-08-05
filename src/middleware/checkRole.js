import StaffUser from '../models/StaffUser.js';

/**
 * 检查用户角色
 * @param {Array<string>} allowedRoles - 允许的角色列表 ['super_admin', 'manager', 'agent']
 */
export function checkRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未认证'
        });
      }

      const user = await StaffUser.findById(userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: '用户不存在'
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: '权限不足',
          required_role: allowedRoles
        });
      }

      // 将用户角色附加到请求对象
      req.userRole = user.role;
      next();
    } catch (error) {
      console.error('角色检查错误:', error);
      return res.status(500).json({
        success: false,
        error: '角色检查失败'
      });
    }
  };
}

/**
 * 检查用户权限
 * @param {string} permission - 需要的权限标识符
 */
export function checkPermission(permission) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未认证'
        });
      }

      const hasPermission = await StaffUser.hasPermission(userId, permission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: '权限不足',
          required_permission: permission
        });
      }

      next();
    } catch (error) {
      console.error('权限检查错误:', error);
      return res.status(500).json({
        success: false,
        error: '权限检查失败'
      });
    }
  };
}

/**
 * 检查是否是超级管理员
 */
export function isSuperAdmin() {
  return checkRole(['super_admin']);
}

/**
 * 检查是否是主管或超级管理员
 */
export function isManagerOrAdmin() {
  return checkRole(['super_admin', 'manager']);
}

/**
 * 记录员工活动日志
 */
export async function logActivity(req, action, targetType = null, targetId = null, details = {}) {
  try {
    const userId = req.user?.id;
    if (!userId) return;

    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await StaffUser.logActivity(userId, action, targetType, targetId, details, ip, userAgent);
  } catch (error) {
    console.error('记录活动日志失败:', error);
  }
}
