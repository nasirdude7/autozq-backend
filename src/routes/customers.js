import express from 'express';
import Customer from '../models/Customer.js';
import CustomerRatingService from '../services/CustomerRatingService.js';
import Label from '../models/Label.js';
import { authenticateJWT } from '../middleware/auth.js';
import { logActivity } from '../middleware/checkRole.js';

const router = express.Router();

/**
 * 获取客户列表
 * GET /api/sales/customers
 */
router.get('/', async (req, res) => {
  try {
    const {
      assigned_to,
      rating,
      status,
      search,
      country,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      assigned_to,
      rating,
      status,
      search,
      country,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const customers = await Customer.findAll(filters);
    const total = await Customer.count(filters);

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + customers.length < total
      }
    });
  } catch (error) {
    console.error('获取客户列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建客户
 * POST /api/sales/customers
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      whatsapp_id,
      country,
      language,
      source,
      assigned_to,
      tags
    } = req.body;

    // 验证必填字段
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: '姓名和电话是必填项'
      });
    }

    // 检查电话号码是否已存在
    const existingCustomer = await Customer.findByPhone(phone);
    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        error: '该电话号码已存在',
        customer: existingCustomer
      });
    }

    const customer = await Customer.create({
      name,
      phone,
      email,
      whatsapp_id,
      country,
      language,
      source,
      assigned_to,
      tags
    });

    res.status(201).json({
      success: true,
      data: customer,
      message: '客户创建成功'
    });
  } catch (error) {
    console.error('创建客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 搜索客户
 * GET /api/sales/customers/search
 * 注意：必须定义在 /:id 之前，否则 "search" 会被当作 :id(uuid) 解析
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: '请提供搜索关键词'
      });
    }

    const customers = await Customer.findAll({
      search: q,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('搜索客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户详情
 * GET /api/sales/customers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: '客户不存在'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('获取客户详情错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新客户信息
 * PATCH /api/sales/customers/:id
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 不允许直接更新某些字段
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;

    const customer = await Customer.update(id, updateData);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: '客户不存在'
      });
    }

    res.json({
      success: true,
      data: customer,
      message: '客户信息更新成功'
    });
  } catch (error) {
    console.error('更新客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除客户
 * DELETE /api/sales/customers/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.delete(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: '客户不存在'
      });
    }

    res.json({
      success: true,
      message: '客户删除成功'
    });
  } catch (error) {
    console.error('删除客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 分配客户给客服
 * POST /api/sales/customers/:id/assign
 */
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id, reason } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        error: '请指定客服ID'
      });
    }

    const customer = await Customer.assign(id, agent_id, reason);

    res.json({
      success: true,
      data: customer,
      message: '客户分配成功'
    });
  } catch (error) {
    console.error('分配客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 添加客户标签
 * POST /api/sales/customers/:id/tags
 */
router.post('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        error: '标签必须是数组格式'
      });
    }

    const customer = await Customer.addTags(id, tags);

    res.json({
      success: true,
      data: customer,
      message: '标签添加成功'
    });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 生成客户画像
 * POST /api/sales/customers/:id/profile
 */
router.post('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await CustomerRatingService.generateProfile(id);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: result.profile,
      recommendations: result.recommendations,
      message: '客户画像生成成功'
    });
  } catch (error) {
    console.error('生成客户画像错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 客户评级
 * POST /api/sales/customers/:id/rate
 */
router.post('/:id/rate', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await CustomerRatingService.rateCustomer(id);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: {
        rating: result.rating,
        score: result.score,
        factors: result.factors
      },
      recommendation: result.recommendation,
      message: '客户评级完成'
    });
  } catch (error) {
    console.error('客户评级错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户评级历史
 * GET /api/sales/customers/:id/ratings
 */
router.get('/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const ratings = await CustomerRatingService.getRatingHistory(id, parseInt(limit));

    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('获取评级历史错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量操作：生成画像并评级
 * POST /api/sales/customers/batch/analyze
 */
router.post('/batch/analyze', async (req, res) => {
  try {
    const { customer_ids } = req.body;

    if (!customer_ids || !Array.isArray(customer_ids)) {
      return res.status(400).json({
        success: false,
        error: '请提供客户ID数组'
      });
    }

    const results = await CustomerRatingService.batchRate(customer_ids);

    res.json({
      success: true,
      data: results,
      message: `批量分析完成，共处理 ${customer_ids.length} 个客户`
    });
  } catch (error) {
    console.error('批量分析错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户的标签
 * GET /api/sales/customers/:id/labels
 */
router.get('/:id/labels', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.userRole || 'agent';

    const labels = await Label.getCustomerLabels(id, userRole);

    res.json({
      success: true,
      data: labels
    });
  } catch (error) {
    console.error('获取客户标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 为客户添加单个标签
 * POST /api/sales/customers/:id/labels
 */
router.post('/:id/labels', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { label_id } = req.body;

    if (!label_id) {
      return res.status(400).json({
        success: false,
        error: '标签ID是必填项'
      });
    }

    await Label.assignToCustomer(id, label_id, req.user.id);

    // 记录日志
    await logActivity(req, 'add_customer_label', 'customer', id, { label_id });

    const labels = await Label.getCustomerLabels(id, req.userRole || 'agent');

    res.json({
      success: true,
      data: labels,
      message: '标签添加成功'
    });
  } catch (error) {
    console.error('添加客户标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量设置客户标签（替换现有标签）
 * PUT /api/sales/customers/:id/labels
 */
router.put('/:id/labels', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { label_ids } = req.body;

    if (!Array.isArray(label_ids)) {
      return res.status(400).json({
        success: false,
        error: '标签ID列表必须是数组'
      });
    }

    const labels = await Label.setCustomerLabels(id, label_ids, req.user.id);

    // 记录日志
    await logActivity(req, 'set_customer_labels', 'customer', id, { label_count: label_ids.length });

    res.json({
      success: true,
      data: labels,
      message: '客户标签设置成功'
    });
  } catch (error) {
    console.error('设置客户标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 从客户移除标签
 * DELETE /api/sales/customers/:id/labels/:labelId
 */
router.delete('/:id/labels/:labelId', authenticateJWT, async (req, res) => {
  try {
    const { id, labelId } = req.params;

    await Label.removeFromCustomer(id, labelId);

    // 记录日志
    await logActivity(req, 'remove_customer_label', 'customer', id, { label_id: labelId });

    res.json({
      success: true,
      message: '标签移除成功'
    });
  } catch (error) {
    console.error('移除客户标签错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
