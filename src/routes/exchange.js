import express from 'express';
import { getExchangeRate } from '../services/exchangeRate.js';

const router = express.Router();

/**
 * GET /api/exchange/rate
 * 获取俄罗斯央行官方人民币兑卢布汇率
 */
router.get('/rate', async (req, res) => {
  try {
    const result = await getExchangeRate();

    if (result.success) {
      res.json({
        success: true,
        data: {
          cnyToRub: result.cnyToRub,
          date: result.date,
          source: result.source
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
