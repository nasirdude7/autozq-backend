import express from 'express';
import jwt from 'jsonwebtoken';
import StaffUser from '../models/StaffUser.js';
import { authenticateJWT } from '../middleware/auth.js';
import { checkRole, checkPermission, isSuperAdmin, logActivity } from '../middleware/checkRole.js';

const router = express.Router();

/**
 * 员工登录
 * POST /api/staff/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码是必填项'
      });
    }

    // 查找用户
    const user = await StaffUser.findByUsername(username);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 检查账号状态
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: '账号已被停用'
      });
    }

    // 验证密码
    const isPasswordValid = await StaffUser.verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    await StaffUser.updateLastLogin(user.id, ip);

    // 获取权限
    const permissions = await StaffUser.getPermissions(user.id);

    // 生成 JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        type: 'staff'  // 区分员工和客户 token
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 记录登录日志
    await StaffUser.logActivity(user.id, 'login', null, null, {}, ip, req.headers['user-agent']);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar_url: user.avatar_url,
          is_first_login: user.is_first_login,
          permissions
        }
      }
    });
  } catch (error) {
    console.error('员工登录错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前登录员工信息
 * GET /api/staff/me
 */
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await StaffUser.findByIdWithPermissions(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 移除敏感信息
    delete user.password_hash;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('获取当前用户信息错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 修改当前用户密码
 * PUT /api/staff/me/password
 */
router.put('/me/password', authenticateJWT, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: '旧密码和新密码是必填项'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '新密码长度至少为6位'
      });
    }

    // 验证旧密码
    const user = await StaffUser.findById(req.user.id);
    const isPasswordValid = await StaffUser.verifyPassword(old_password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '旧密码错误'
      });
    }

    // 修改密码
    await StaffUser.changePassword(req.user.id, new_password);

    // 记录日志
    await logActivity(req, 'change_password', 'staff_user', req.user.id);

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取员工列表
 * GET /api/staff/users
 */
router.get('/users', authenticateJWT, checkPermission('manage_users'), async (req, res) => {
  try {
    const { role, status, manager_id, limit, offset } = req.query;

    const filters = {
      role,
      status,
      manager_id,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    };

    const users = await StaffUser.findAll(filters);
    const total = await StaffUser.count(filters);

    // 移除敏感信息
    users.forEach(user => delete user.password_hash);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + users.length < total
      }
    });
  } catch (error) {
    console.error('获取员工列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取员工详情
 * GET /api/staff/users/:id
 */
router.get('/users/:id', authenticateJWT, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await StaffUser.findByIdWithPermissions(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '员工不存在'
      });
    }

    delete user.password_hash;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('获取员工详情错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建员工
 * POST /api/staff/users
 */
router.post('/users', authenticateJWT, checkPermission('manage_users'), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role, manager_id } = req.body;

    // 验证必填字段
    if (!username || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: '用户名、密码和姓名是必填项'
      });
    }

    // 验证密码强度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少为6位'
      });
    }

    // 检查用户名是否已存在
    const existingUser = await StaffUser.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '用户名已存在'
      });
    }

    // 创建用户
    const user = await StaffUser.create({
      username,
      password,
      full_name,
      email,
      phone,
      role: role || 'agent',
      manager_id
    });

    delete user.password_hash;

    // 记录日志
    await logActivity(req, 'create_user', 'staff_user', user.id, { username, role: user.role });

    res.status(201).json({
      success: true,
      data: user,
      message: '员工创建成功'
    });
  } catch (error) {
    console.error('创建员工错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新员工信息
 * PUT /api/staff/users/:id
 */
router.put('/users/:id', authenticateJWT, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, role, manager_id, status } = req.body;

    const user = await StaffUser.update(id, {
      full_name,
      email,
      phone,
      role,
      manager_id,
      status
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '员工不存在'
      });
    }

    delete user.password_hash;

    // 记录日志
    await logActivity(req, 'update_user', 'staff_user', id, { full_name, role, status });

    res.json({
      success: true,
      data: user,
      message: '员工信息更新成功'
    });
  } catch (error) {
    console.error('更新员工信息错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 重置员工密码
 * PUT /api/staff/users/:id/password
 */
router.put('/users/:id/password', authenticateJWT, isSuperAdmin(), async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '新密码长度至少为6位'
      });
    }

    await StaffUser.changePassword(id, new_password);

    // 记录日志
    await logActivity(req, 'reset_password', 'staff_user', id);

    res.json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除员工（软删除）
 * DELETE /api/staff/users/:id
 */
router.delete('/users/:id', authenticateJWT, isSuperAdmin(), async (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: '不能删除自己的账号'
      });
    }

    const user = await StaffUser.softDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '员工不存在'
      });
    }

    // 记录日志
    await logActivity(req, 'delete_user', 'staff_user', id);

    res.json({
      success: true,
      message: '员工已删除'
    });
  } catch (error) {
    console.error('删除员工错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取员工权限
 * GET /api/staff/users/:id/permissions
 */
router.get('/users/:id/permissions', authenticateJWT, checkPermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    const permissions = await StaffUser.getPermissions(id);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('获取员工权限错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 授予权限
 * POST /api/staff/users/:id/permissions
 */
router.post('/users/:id/permissions', authenticateJWT, isSuperAdmin(), async (req, res) => {
  try {
    const { id } = req.params;
    const { permission } = req.body;

    if (!permission) {
      return res.status(400).json({
        success: false,
        error: '权限标识符是必填项'
      });
    }

    await StaffUser.grantPermission(id, permission, req.user.id);

    // 记录日志
    await logActivity(req, 'grant_permission', 'staff_user', id, { permission });

    res.json({
      success: true,
      message: '权限授予成功'
    });
  } catch (error) {
    console.error('授予权限错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 撤销权限
 * DELETE /api/staff/users/:id/permissions/:permission
 */
router.delete('/users/:id/permissions/:permission', authenticateJWT, isSuperAdmin(), async (req, res) => {
  try {
    const { id, permission } = req.params;

    await StaffUser.revokePermission(id, permission);

    // 记录日志
    await logActivity(req, 'revoke_permission', 'staff_user', id, { permission });

    res.json({
      success: true,
      message: '权限撤销成功'
    });
  } catch (error) {
    console.error('撤销权限错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
