import express from 'express';
import Assignment from '../models/Assignment.js';
import { authenticateJWT } from '../middleware/auth.js';
import { checkPermission, isManagerOrAdmin, logActivity } from '../middleware/checkRole.js';

const router = express.Router();

/**
 * 一键自动分配所有未分配客户（负载均衡）
 * POST /api/assignments/auto-assign-all
 */
router.post('/auto-assign-all', authenticateJWT, checkPermission('assign_customers'), async (req, res) => {
  try {
    const result = await Assignment.autoAssignAllUnassigned(req.user.id);

    await logActivity(req, 'auto_assign_all', 'customer', null, result);

    res.json({
      success: true,
      data: result,
      message: result.assigned > 0
        ? `已自动分配 ${result.assigned} 位客户给 ${result.agents} 名坐席`
        : (result.skipped > 0 ? '无可用坐席，请先创建员工账号' : '没有待分配的客户')
    });
  } catch (error) {
    console.error('批量自动分配错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 分配客户给坐席
 * POST /api/assignments/assign
 */
router.post('/assign', authenticateJWT, checkPermission('assign_customers'), async (req, res) => {
  try {
    const { customer_id, assigned_to, notes } = req.body;

    if (!customer_id || !assigned_to) {
      return res.status(400).json({
        success: false,
        error: '客户ID和坐席ID是必填项'
      });
    }

    const assignment = await Assignment.assignCustomer(
      customer_id,
      assigned_to,
      req.user.id,
      notes
    );

    // 记录日志
    await logActivity(req, 'assign_customer', 'customer', customer_id, { assigned_to });

    res.status(201).json({
      success: true,
      data: assignment,
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
 * 批量分配客户
 * POST /api/assignments/batch-assign
 */
router.post('/batch-assign', authenticateJWT, checkPermission('assign_customers'), async (req, res) => {
  try {
    const { customer_ids, assigned_to, notes } = req.body;

    if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '客户ID列表是必填项'
      });
    }

    if (!assigned_to) {
      return res.status(400).json({
        success: false,
        error: '坐席ID是必填项'
      });
    }

    const assignments = await Assignment.batchAssign(
      customer_ids,
      assigned_to,
      req.user.id,
      notes
    );

    // 记录日志
    await logActivity(req, 'batch_assign_customer', null, null, {
      customer_count: customer_ids.length,
      assigned_to
    });

    res.status(201).json({
      success: true,
      data: assignments,
      message: `成功分配 ${assignments.length} 个客户`
    });
  } catch (error) {
    console.error('批量分配客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 转移客户
 * POST /api/assignments/transfer
 */
router.post('/transfer', authenticateJWT, checkPermission('assign_customers'), async (req, res) => {
  try {
    const { customer_id, from_user, to_user, reason } = req.body;

    if (!customer_id || !from_user || !to_user) {
      return res.status(400).json({
        success: false,
        error: '客户ID、原坐席和目标坐席是必填项'
      });
    }

    const assignment = await Assignment.transferCustomer(
      customer_id,
      from_user,
      to_user,
      reason,
      req.user.id
    );

    // 记录日志
    await logActivity(req, 'transfer_customer', 'customer', customer_id, {
      from_user,
      to_user,
      reason
    });

    res.json({
      success: true,
      data: assignment,
      message: '客户转移成功'
    });
  } catch (error) {
    console.error('转移客户错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 取消分配（释放客户到未分配池）
 * DELETE /api/assignments/:customerId
 */
router.delete('/:customerId', authenticateJWT, checkPermission('assign_customers'), async (req, res) => {
  try {
    const { customerId } = req.params;

    const assignment = await Assignment.unassignCustomer(customerId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: '未找到活跃的分配记录'
      });
    }

    // 记录日志
    await logActivity(req, 'unassign_customer', 'customer', customerId);

    res.json({
      success: true,
      message: '客户已释放到未分配池'
    });
  } catch (error) {
    console.error('取消分配错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取我的客户列表
 * GET /api/assignments/my-customers
 */
router.get('/my-customers', authenticateJWT, async (req, res) => {
  try {
    const { status, limit, offset } = req.query;

    const filters = {
      status: status || 'active',
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    };

    const customers = await Assignment.getAgentCustomers(req.user.id, filters);
    const total = await Assignment.countAgentCustomers(req.user.id, filters.status);

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + customers.length < total
      }
    });
  } catch (error) {
    console.error('获取我的客户列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取未分配客户池
 * GET /api/assignments/unassigned
 */
router.get('/unassigned', authenticateJWT, isManagerOrAdmin(), async (req, res) => {
  try {
    const { limit, offset } = req.query;

    const filters = {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    };

    const customers = await Assignment.getUnassignedCustomers(filters);
    const total = await Assignment.countUnassignedCustomers();

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + customers.length < total
      }
    });
  } catch (error) {
    console.error('获取未分配客户池错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户的当前分配
 * GET /api/assignments/customer/:customerId
 */
router.get('/customer/:customerId', authenticateJWT, async (req, res) => {
  try {
    const { customerId } = req.params;

    const assignment = await Assignment.getCurrentAssignment(customerId);

    if (!assignment) {
      return res.json({
        success: true,
        data: null,
        message: '客户未分配'
      });
    }

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('获取客户分配错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户分配历史
 * GET /api/assignments/customer/:customerId/history
 */
router.get('/customer/:customerId/history', authenticateJWT, isManagerOrAdmin(), async (req, res) => {
  try {
    const { customerId } = req.params;
    const { limit } = req.query;

    const history = await Assignment.getHistory(customerId, parseInt(limit) || 20);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取分配历史错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取坐席工作负载统计
 * GET /api/assignments/workload
 */
router.get('/workload', authenticateJWT, isManagerOrAdmin(), async (req, res) => {
  try {
    const workload = await Assignment.getAgentWorkload();

    res.json({
      success: true,
      data: workload
    });
  } catch (error) {
    console.error('获取工作负载统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
