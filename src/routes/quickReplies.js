import express from 'express';
import { query } from '../db/salesPool.js';

const router = express.Router();

/**
 * 获取快捷回复列表
 * GET /api/quick-replies
 */
router.get('/', async (req, res) => {
  try {
    const { category, language, search } = req.query;

    let queryText = 'SELECT * FROM quick_replies WHERE is_active = TRUE';
    const params = [];
    let paramIndex = 1;

    if (category) {
      queryText += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (language) {
      queryText += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    queryText += ' ORDER BY usage_count DESC, created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('获取快捷回复失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建快捷回复
 * POST /api/quick-replies
 */
router.post('/', async (req, res) => {
  try {
    const { title, content, category = 'general', language = 'zh' } = req.body;
    const created_by = req.user.id;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }

    const result = await query(
      `INSERT INTO quick_replies (title, content, category, language, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, content, category, language, created_by]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('创建快捷回复失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新快捷回复
 * PUT /api/quick-replies/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, language } = req.body;

    const result = await query(
      `UPDATE quick_replies
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           category = COALESCE($3, category),
           language = COALESCE($4, language),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [title, content, category, language, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '快捷回复不存在'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('更新快捷回复失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除快捷回复（软删除）
 * DELETE /api/quick-replies/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE quick_replies
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '快捷回复不存在'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('删除快捷回复失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 使用快捷回复（增加使用计数）
 * POST /api/quick-replies/:id/use
 */
router.post('/:id/use', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE quick_replies
       SET usage_count = usage_count + 1
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '快捷回复不存在'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('更新使用计数失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取快捷回复分类统计
 * GET /api/quick-replies/stats/categories
 */
router.get('/stats/categories', async (req, res) => {
  try {
    const result = await query(
      `SELECT category, COUNT(*) as count
       FROM quick_replies
       WHERE is_active = TRUE
       GROUP BY category
       ORDER BY count DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('获取分类统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
