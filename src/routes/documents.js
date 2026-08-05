import express from 'express';
import DocumentService from '../services/DocumentService.js';

const router = express.Router();

/**
 * 生成报价单
 * POST /api/sales/documents/quotation
 */
router.post('/quotation', async (req, res) => {
  try {
    const {
      customer_id,
      vehicles,
      currency,
      valid_days,
      terms,
      created_by
    } = req.body;

    if (!customer_id || !vehicles || !Array.isArray(vehicles)) {
      return res.status(400).json({
        success: false,
        error: '客户ID和车辆清单是必填项'
      });
    }

    const result = await DocumentService.generateQuotation({
      customer_id,
      vehicles,
      currency,
      valid_days,
      terms,
      created_by
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('生成报价单错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 生成订单
 * POST /api/sales/documents/order
 */
router.post('/order', async (req, res) => {
  try {
    const {
      customer_id,
      quotation_id,
      vehicles,
      total_amount,
      currency,
      payment_method,
      delivery_address,
      notes,
      created_by
    } = req.body;

    if (!customer_id || !vehicles || !total_amount) {
      return res.status(400).json({
        success: false,
        error: '客户ID、车辆清单和总金额是必填项'
      });
    }

    const result = await DocumentService.generateOrder({
      customer_id,
      quotation_id,
      vehicles,
      total_amount,
      currency,
      payment_method,
      delivery_address,
      notes,
      created_by
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('生成订单错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 生成合同
 * POST /api/sales/documents/contract
 */
router.post('/contract', async (req, res) => {
  try {
    const {
      order_id,
      customer_id,
      contract_type,
      terms,
      created_by
    } = req.body;

    if (!order_id || !customer_id) {
      return res.status(400).json({
        success: false,
        error: '订单ID和客户ID是必填项'
      });
    }

    const result = await DocumentService.generateContract({
      order_id,
      customer_id,
      contract_type,
      terms,
      created_by
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('生成合同错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单据统计
 * GET /api/sales/documents/stats/overview
 * 注意：必须定义在 /:type 之前，否则 "stats" 会被当作单据类型解析
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const result = await DocumentService.getStats({
      start_date,
      end_date
    });

    res.json(result);
  } catch (error) {
    console.error('获取单据统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发布报价给客户（个人中心 + 聊天双通道）
 * POST /api/sales/documents/quotation/:id/publish
 * 注意：必须定义在 /:type 之前，避免被动态路由吞掉
 */
router.post('/quotation/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const publishedBy = req.user?.id || null;
    const result = await DocumentService.publishToCustomer(id, publishedBy);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('发布报价错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取单据列表
 * GET /api/sales/documents/:type
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const {
      customer_id,
      status,
      limit = 50,
      offset = 0
    } = req.query;

    if (!['quotation', 'order', 'contract'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '无效的单据类型'
      });
    }

    const result = await DocumentService.listDocuments(type, {
      customer_id,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(result);
  } catch (error) {
    console.error('获取单据列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单据详情
 * GET /api/sales/documents/:type/:id
 */
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['quotation', 'order', 'contract'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '无效的单据类型'
      });
    }

    const result = await DocumentService.getDocument(type, id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('获取单据详情错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送单据
 * POST /api/sales/documents/:type/:id/send
 */
router.post('/:type/:id/send', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { method = 'whatsapp' } = req.body;

    if (!['quotation', 'order', 'contract'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '无效的单据类型'
      });
    }

    const result = await DocumentService.sendDocument(id, type, method);

    res.json(result);
  } catch (error) {
    console.error('发送单据错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新单据状态
 * PATCH /api/sales/documents/:type/:id/status
 */
router.patch('/:type/:id/status', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: '请提供新状态'
      });
    }

    const result = await DocumentService.updateStatus(type, id, status, notes);

    res.json(result);
  } catch (error) {
    console.error('更新单据状态错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
