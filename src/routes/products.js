import express from 'express';
import { query } from '../db/salesPool.js';
import { chatUpload } from '../middleware/upload.js';
import { generateProductSpecs } from '../services/productSpecsGenerator.js';

const router = express.Router();

// 公网可访问的基础地址（产品图片给 SalesMartly 用）
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

/**
 * GET /api/products
 * 获取产品列表（支持搜索和筛选）
 */
router.get('/', async (req, res) => {
  try {
    const { q = '', brand = '', category = '', limit = 100 } = req.query;

    let sql = 'SELECT * FROM products WHERE is_active = TRUE';
    const params = [];
    let paramIndex = 1;

    if (q) {
      sql += ` AND (brand ILIKE $${paramIndex} OR model ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (brand) {
      sql += ` AND brand ILIKE $${paramIndex}`;
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + paramIndex;
    params.push(parseInt(limit));

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/products/:id
 * 获取单个产品详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '产品不存在' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('获取产品详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products
 * 新增产品
 */
router.post('/', async (req, res) => {
  try {
    const {
      brand,
      model,
      year,
      variant,
      category = 'sedan',
      price,
      currency = 'USD',
      specs = {},
      description = '',
      images = [],
      stock_status = 'in_stock',
      tags = []
    } = req.body;

    if (!brand || !model) {
      return res.status(400).json({ success: false, error: '品牌和车型是必填项' });
    }

    const staff_id = req.user.id;

    const result = await query(
      `INSERT INTO products
       (brand, model, year, variant, category, price, currency, specs, description, images, stock_status, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [brand, model, year, variant, category, price, currency, JSON.stringify(specs), description, images, stock_status, tags, staff_id]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('新增产品失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/products/:id
 * 更新产品
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      brand,
      model,
      year,
      variant,
      category,
      price,
      currency,
      specs,
      description,
      images,
      stock_status,
      tags,
      is_active
    } = req.body;

    // 构建动态更新 SQL
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (brand !== undefined) {
      updates.push(`brand = $${paramIndex++}`);
      params.push(brand);
    }
    if (model !== undefined) {
      updates.push(`model = $${paramIndex++}`);
      params.push(model);
    }
    if (year !== undefined) {
      updates.push(`year = $${paramIndex++}`);
      params.push(year);
    }
    if (variant !== undefined) {
      updates.push(`variant = $${paramIndex++}`);
      params.push(variant);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(category);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      params.push(price);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      params.push(currency);
    }
    if (specs !== undefined) {
      updates.push(`specs = $${paramIndex++}`);
      params.push(JSON.stringify(specs));
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (images !== undefined) {
      updates.push(`images = $${paramIndex++}`);
      params.push(images);
    }
    if (stock_status !== undefined) {
      updates.push(`stock_status = $${paramIndex++}`);
      params.push(stock_status);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(tags);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    params.push(id);
    const sql = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '产品不存在' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/products/:id
 * 删除产品（软删除：设为 is_active=false）
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE products SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '产品不存在' });
    }

    res.json({
      success: true,
      message: '产品已下架'
    });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products/upload-image
 * 上传产品图片（复用 chatUpload → 返回公网 URL）
 */
router.post('/upload-image', chatUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未收到图片文件' });
    }

    if (!PUBLIC_BASE_URL) {
      console.warn('⚠️ PUBLIC_BASE_URL 未配置，返回相对路径');
    }

    const relPath = `/uploads/${req.file.filename}`;
    const url = PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${relPath}` : relPath;

    res.json({
      success: true,
      data: {
        url,
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('上传产品图片失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products/generate-specs
 * AI 补全产品配置
 */
router.post('/generate-specs', async (req, res) => {
  try {
    const { brand, model, year, variant, category } = req.body;

    if (!brand || !model) {
      return res.status(400).json({ success: false, error: '品牌和车型是必填项' });
    }

    const specs = await generateProductSpecs({ brand, model, year, variant, category });

    res.json({
      success: true,
      data: specs
    });
  } catch (error) {
    console.error('AI 补全配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
