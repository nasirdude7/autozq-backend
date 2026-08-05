import express from 'express';
import { getAllSites, getDefaultSite } from '../services/siteConfig.js';

const router = express.Router();

/**
 * GET /api/sites/list
 * 获取所有站点列表（不含敏感信息）
 */
router.get('/list', (req, res) => {
  try {
    const sites = getAllSites();
    res.json({
      success: true,
      data: sites
    });
  } catch (error) {
    console.error('获取站点列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sites/default
 * 获取默认站点信息（不含敏感信息）
 */
router.get('/default', (req, res) => {
  try {
    const site = getDefaultSite();
    res.json({
      success: true,
      data: {
        id: site.id,
        name: site.name,
        country: site.country,
        language: site.seo.language,
        currency: site.seo.currency
      }
    });
  } catch (error) {
    console.error('获取默认站点失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
