import express from 'express';
import { upload } from '../middleware/upload.js';
import { uploadToWordPress } from '../services/wordpressUpload.js';
import { getWordPressConfig, getDefaultSite } from '../services/siteConfig.js';
import fs from 'fs';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * POST /api/wordpress/upload
 * 上传图片到WordPress媒体库
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传图片' });
    }

    const options = {
      alt: req.body.alt || '',
      title: req.body.title || ''
    };

    console.log(`收到 WordPress 上传请求: ${req.file.originalname}`);
    if (options.alt) console.log(`ALT: ${options.alt}`);
    if (options.title) console.log(`Title: ${options.title}`);

    // 调用上传服务
    const result = await uploadToWordPress(req.file.path, options);

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: '上传成功',
      data: result
    });

  } catch (error) {
    console.error('WordPress 上传失败:', error);

    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'WordPress 上传失败'
    });
  }
});

/**
 * POST /api/wordpress/upload-pdf
 * 上传PDF到WordPress媒体库
 */
router.post('/upload-pdf', async (req, res) => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ success: false, error: '未提供PDF路径' });
    }

    // 将相对URL转换为本地绝对路径
    const pdfPath = pdfUrl.startsWith('/uploads/')
      ? `./uploads/${pdfUrl.split('/uploads/')[1]}`
      : pdfUrl;

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ success: false, error: 'PDF文件不存在' });
    }

    console.log(`收到 WordPress PDF上传请求: ${pdfPath}`);

    const options = {
      title: req.body.title || 'Коммерческое предложение',
      caption: req.body.caption || ''
    };

    // 调用上传服务
    const result = await uploadToWordPress(pdfPath, options);

    res.json({
      success: true,
      message: 'PDF上传成功',
      data: result
    });

  } catch (error) {
    console.error('WordPress PDF上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'WordPress PDF上传失败'
    });
  }
});

/**
 * GET /api/wordpress/test
 * 测试WordPress连接
 */
router.get('/test', async (req, res) => {
  const wpUrl = process.env.WP_URL;
  const wpUsername = process.env.WP_USERNAME;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  if (!wpUrl || !wpUsername || !wpAppPassword) {
    return res.json({
      success: false,
      error: 'WordPress 配置未设置',
      configured: false
    });
  }

  res.json({
    success: true,
    message: 'WordPress 配置已设置',
    configured: true,
    wpUrl: wpUrl
  });
});

/**
 * POST /api/wordpress/publish-article
 * 发布文章到WordPress
 */
router.post('/publish-article', async (req, res) => {
  try {
    const { site_id, title, content, excerpt, keywords, status = 'draft' } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }

    const wpConfig = getWordPressConfig(site_id || getDefaultSite());
    const auth = Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64');

    console.log(`📤 发布文章到WordPress: ${title}`);

    // 创建文章
    const response = await fetch(`${wpConfig.url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        content: content,
        excerpt: excerpt || '',
        status: status,  // draft, publish, pending
        comment_status: 'open',
        ping_status: 'open'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    console.log(`✅ 文章已发布: ${result.id}`);

    res.json({
      success: true,
      message: '文章已发布',
      data: {
        id: result.id,
        link: result.link,
        edit_link: `${wpConfig.url}/wp-admin/post.php?post=${result.id}&action=edit`,
        status: result.status
      }
    });

  } catch (error) {
    console.error('WordPress 文章发布失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'WordPress 文章发布失败'
    });
  }
});

export default router;
