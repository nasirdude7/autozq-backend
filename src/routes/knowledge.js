import express from 'express';
import KnowledgeBaseService from '../services/KnowledgeBaseService.js';

const router = express.Router();

/**
 * 搜索知识库
 * GET /api/sales/knowledge/search?q=关键词
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: '请提供搜索关键词'
      });
    }

    const result = await KnowledgeBaseService.search(q, parseInt(limit));

    res.json(result);
  } catch (error) {
    console.error('搜索知识库错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取推荐回复（RAG增强）
 * POST /api/sales/knowledge/recommend-reply
 */
router.post('/recommend-reply', async (req, res) => {
  try {
    const { message, conversation_history } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '请提供客户消息'
      });
    }

    const result = await KnowledgeBaseService.getRecommendedReply(
      message,
      conversation_history || []
    );

    res.json(result);
  } catch (error) {
    console.error('获取推荐回复错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 提取知识
 * POST /api/sales/knowledge/extract
 */
router.post('/extract', async (req, res) => {
  try {
    const { days = 30, min_occurrence = 3 } = req.body;

    const result = await KnowledgeBaseService.extractKnowledge(
      parseInt(days),
      parseInt(min_occurrence)
    );

    res.json(result);
  } catch (error) {
    console.error('提取知识错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 自动学习
 * POST /api/sales/knowledge/auto-learn
 */
router.post('/auto-learn', async (req, res) => {
  try {
    const { min_rating = 4, days = 7 } = req.body;

    const result = await KnowledgeBaseService.autoLearn(
      parseInt(min_rating),
      parseInt(days)
    );

    res.json(result);
  } catch (error) {
    console.error('自动学习错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 添加知识条目
 * POST /api/sales/knowledge
 */
router.post('/', async (req, res) => {
  try {
    const { question, answer, keywords, category, confidence } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        error: '问题和答案是必填项'
      });
    }

    const result = await KnowledgeBaseService.saveKnowledge({
      question,
      answer,
      keywords: keywords || [],
      category: category || 'general',
      source: 'manual',
      confidence: confidence || 1.0
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('添加知识条目错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取知识统计
 * GET /api/sales/knowledge/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await KnowledgeBaseService.getStats();

    res.json(result);
  } catch (error) {
    console.error('获取知识统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
