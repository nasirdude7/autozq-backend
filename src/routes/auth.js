/**
 * 认证路由
 */
import express from 'express';
import { findUserByUsername, verifyPassword, updateLastLogin } from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '请提供用户名和密码'
      });
    }

    // 查找用户
    const user = findUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 验证密码
    if (!verifyPassword(user, password)) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    updateLastLogin(user.id);

    // 生成token
    const token = generateToken(user);

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword
      }
    });

  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '登录失败'
    });
  }
});

/**
 * POST /api/auth/logout
 * 用户登出（客户端删除token即可，无需服务器处理）
 */
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: '已登出'
  });
});

export default router;
