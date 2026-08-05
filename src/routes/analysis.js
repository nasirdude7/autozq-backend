import express from 'express';
import CustomerAnalysisService from '../services/CustomerAnalysisService.js';

const router = express.Router();

/**
 * 分析单个客户
 * POST /api/analysis/customer/:id
 */
router.post('/customer/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = await CustomerAnalysisService.analyzeCustomerProfile(id);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('客户分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取客户分析结果
 * GET /api/analysis/customer/:id
 */
router.get('/customer/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = await CustomerAnalysisService.getAnalysis(id);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: '暂无分析结果'
      });
    }

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('获取分析结果失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量分析客户
 * POST /api/analysis/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { limit = 10 } = req.body;

    const results = await CustomerAnalysisService.batchAnalyze(limit);

    res.json({
      success: true,
      data: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      }
    });

  } catch (error) {
    console.error('批量分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
