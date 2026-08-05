/**
 * 管理员路由
 */
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getAllUsers, createUser, updateUser, deleteUser } from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 所有管理员路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * 获取所有用户
 */
router.get('/users', (req, res) => {
  try {
    const users = getAllUsers();
    // 移除密码字段
    const usersWithoutPassword = users.map(({ password, ...user }) => user);

    res.json({
      success: true,
      data: usersWithoutPassword
    });
  } catch (error) {
    console.error('获取用户失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取用户失败'
    });
  }
});

/**
 * POST /api/admin/users
 * 创建新用户
 */
router.post('/users', (req, res) => {
  try {
    const { username, email, password, role, sites } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    const newUser = createUser({
      username,
      email: email || `${username}@autozq.ru`,
      password,
      role: role || 'user',
      sites: sites || []
    });

    res.json({
      success: true,
      data: newUser,
      message: '用户创建成功'
    });

  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建用户失败'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * 更新用户
 */
router.put('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 不允许通过此接口修改用户ID
    delete updates.id;

    const updatedUser = updateUser(id, updates);

    res.json({
      success: true,
      data: updatedUser,
      message: '用户更新成功'
    });

  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '更新用户失败'
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * 删除用户
 */
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 不允许删除自己
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: '不能删除自己的账号'
      });
    }

    deleteUser(id);

    res.json({
      success: true,
      message: '用户删除成功'
    });

  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '删除用户失败'
    });
  }
});

/**
 * GET /api/admin/config
 * 获取API配置
 */
router.get('/config', (req, res) => {
  try {
    const config = {
      claude_api: {
        base_url: process.env.OPENAI_BASE_URL || '',
        model: process.env.OPENAI_VISION_MODEL || '',
        has_key: !!process.env.OPENAI_API_KEY
      },
      image_api: {
        base_url: process.env.IMAGE_API_BASE || '',
        has_key: !!process.env.IMAGE_API_KEY
      },
      proxy: {
        http: process.env.HTTP_PROXY || '',
        https: process.env.HTTPS_PROXY || ''
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取配置失败'
    });
  }
});

/**
 * PUT /api/admin/config
 * 更新API配置
 */
router.put('/config', (req, res) => {
  try {
    const { claude_api, image_api, proxy } = req.body;

    // 读取当前.env文件
    const envPath = path.join(__dirname, '../../../.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    // 更新配置
    const updateEnvVar = (key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    };

    if (claude_api) {
      if (claude_api.base_url !== undefined) updateEnvVar('OPENAI_BASE_URL', claude_api.base_url);
      if (claude_api.api_key) updateEnvVar('OPENAI_API_KEY', claude_api.api_key);
      if (claude_api.model) updateEnvVar('OPENAI_VISION_MODEL', claude_api.model);
    }

    if (image_api) {
      if (image_api.base_url !== undefined) updateEnvVar('IMAGE_API_BASE', image_api.base_url);
      if (image_api.api_key) updateEnvVar('IMAGE_API_KEY', image_api.api_key);
    }

    if (proxy) {
      if (proxy.http !== undefined) updateEnvVar('HTTP_PROXY', proxy.http);
      if (proxy.https !== undefined) updateEnvVar('HTTPS_PROXY', proxy.https);
    }

    // 保存.env文件
    fs.writeFileSync(envPath, envContent.trim() + '\n');

    res.json({
      success: true,
      message: '配置已更新，请重启服务器使配置生效'
    });

  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '更新配置失败'
    });
  }
});

/**
 * GET /api/admin/sites
 * 获取所有站点配置
 */
router.get('/sites', (req, res) => {
  try {
    const sitesPath = path.join(__dirname, '../../config/sites.json');
    const sitesData = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

    res.json({
      success: true,
      data: sitesData
    });
  } catch (error) {
    console.error('获取站点失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取站点失败'
    });
  }
});

/**
 * POST /api/admin/sites
 * 添加新站点
 */
router.post('/sites', (req, res) => {
  try {
    const { id, name, wordpress } = req.body;

    if (!id || !name || !wordpress) {
      return res.status(400).json({
        success: false,
        error: '站点ID、名称和WordPress配置不能为空'
      });
    }

    const sitesPath = path.join(__dirname, '../../config/sites.json');
    const sitesData = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

    // 检查ID是否已存在
    if (sitesData.some(s => s.id === id)) {
      return res.status(400).json({
        success: false,
        error: '站点ID已存在'
      });
    }

    sitesData.push({ id, name, wordpress });
    fs.writeFileSync(sitesPath, JSON.stringify(sitesData, null, 2));

    res.json({
      success: true,
      data: { id, name, wordpress },
      message: '站点添加成功'
    });

  } catch (error) {
    console.error('添加站点失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '添加站点失败'
    });
  }
});

/**
 * GET /api/admin/stats
 * 获取系统统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const users = getAllUsers();
    const sitesPath = path.join(__dirname, '../../config/sites.json');
    const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

    const stats = {
      users: {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        regular: users.filter(u => u.role === 'user').length
      },
      sites: {
        total: sites.length
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取统计信息失败'
    });
  }
});

export default router;
