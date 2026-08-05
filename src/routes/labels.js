import express from 'express';
import Label from '../models/Label.js';
import { authenticateJWT } from '../middleware/auth.js';
import { checkPermission, isManagerOrAdmin, logActivity } from '../middleware/checkRole.js';

const router = express.Router();

/**
 * 获取标签列表
 * GET /api/labels
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { category, visibility, limit, offset } = req.query;

    // 获取当前用户角色（用于权限过滤）
    const userRole = req.userRole || 'agent';

    const filters = {
      category,
      visibility,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    };

    const labels = await Label.findAll(filters, userRole);

    res.json({
      success: true,
      data: labels
    });
  } catch (error) {
    console.error('获取标签列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取标签统计
 * GET /api/labels/stats
 */
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const userRole = req.userRole || 'agent';
    const stats = await Label.getStats(userRole);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取标签统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取标签详情
 * GET /api/labels/:id
 */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const label = await Label.findById(id);

    if (!label) {
      return res.status(404).json({
        success: false,
        error: '标签不存在'
      });
    }

    res.json({
      success: true,
      data: label
    });
  } catch (error) {
    console.error('获取标签详情错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建标签
 * POST /api/labels
 */
router.post('/', authenticateJWT, checkPermission('manage_labels'), async (req, res) => {
  try {
    const { name, color, icon, category, visibility, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: '标签名称是必填项'
      });
    }

    // 检查标签名是否已存在
    const existing = await Label.findByName(name);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '标签名称已存在'
      });
    }

    const label = await Label.create({
      name,
      color,
      icon,
      category,
      visibility,
      sort_order,
      created_by: req.user.id
    });

    // 记录日志
    await logActivity(req, 'create_label', 'label', label.id, { name, category });

    res.status(201).json({
      success: true,
      data: label,
      message: '标签创建成功'
    });
  } catch (error) {
    console.error('创建标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新标签
 * PUT /api/labels/:id
 */
router.put('/:id', authenticateJWT, checkPermission('manage_labels'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon, category, visibility, sort_order } = req.body;

    const label = await Label.update(id, {
      name,
      color,
      icon,
      category,
      visibility,
      sort_order
    });

    if (!label) {
      return res.status(404).json({
        success: false,
        error: '标签不存在或为系统标签'
      });
    }

    // 记录日志
    await logActivity(req, 'update_label', 'label', id, { name });

    res.json({
      success: true,
      data: label,
      message: '标签更新成功'
    });
  } catch (error) {
    console.error('更新标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除标签
 * DELETE /api/labels/:id
 */
router.delete('/:id', authenticateJWT, checkPermission('manage_labels'), async (req, res) => {
  try {
    const { id } = req.params;

    const label = await Label.delete(id);

    if (!label) {
      return res.status(404).json({
        success: false,
        error: '标签不存在或为系统标签'
      });
    }

    // 记录日志
    await logActivity(req, 'delete_label', 'label', id, { name: label.name });

    res.json({
      success: true,
      message: '标签已删除'
    });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取标签下的客户列表
 * GET /api/labels/:id/customers
 */
router.get('/:id/customers', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const customers = await Label.getCustomersByLabel(
      id,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('获取标签客户列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
