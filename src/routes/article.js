import express from 'express';
import { generateArticle } from '../services/articleGenerator.js';
import { optimizeImagesForSEO, uploadImagesToWordPress, updateContentWithNewImages } from '../services/imageOptimizer.js';
import { downloadOptimizedImages } from '../services/imageDownloader.js';

const router = express.Router();

/**
 * POST /api/article/generate
 * 生成SEO文章
 */
router.post('/generate', async (req, res) => {
  try {
    const { topic, type, word_count, include_faq, language, include_images } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: '文章主题为必填项'
      });
    }

    console.log(`生成文章: ${topic} | 类型:${type} | 字数:${word_count} | 语言:${language} | 配图:${include_images?'是':'否'}`);

    const articleData = await generateArticle({
      topic,
      type: type || 'guide',
      wordCount: word_count || 1200,
      includeFAQ: include_faq || false,
      language: language || 'ru',
      includeImages: include_images || false
    });

    return res.json({
      success: true,
      data: articleData
    });

  } catch (error) {
    console.error('文章生成失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '生成失败'
    });
  }
});

/**
 * POST /api/article/optimize-images
 * SEO优化配图（压缩、重命名、Alt标签）
 */
router.post('/optimize-images', async (req, res) => {
  try {
    const { title, images, keywords, content } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有配图需要优化'
      });
    }

    console.log(`SEO优化配图: ${images.length}张 - 下载、压缩、重命名`);

    const optimizedImages = await optimizeImagesForSEO({ title, images, keywords });

    // 统计压缩效果
    const totalOriginal = optimizedImages.reduce((sum, img) => sum + (img.original_size || 0), 0);
    const totalCompressed = optimizedImages.reduce((sum, img) => sum + (img.compressed_size || 0), 0);
    const totalSaved = totalOriginal - totalCompressed;
    const avgSavedPercent = Math.round((totalSaved / totalOriginal) * 100);

    // 更新文章内容中的Alt标签
    let updatedContent = content || '';
    if (updatedContent) {
      updatedContent = updateContentWithNewImages(updatedContent, images, optimizedImages);
    }

    return res.json({
      success: true,
      data: {
        images: optimizedImages,
        content: updatedContent,
        stats: {
          total_images: images.length,
          optimized_count: optimizedImages.filter(img => img.seo_optimized).length,
          total_original_size: totalOriginal,
          total_compressed_size: totalCompressed,
          total_saved: totalSaved,
          avg_saved_percent: avgSavedPercent
        }
      }
    });

  } catch (error) {
    console.error('配图优化失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '优化失败'
    });
  }
});

/**
 * POST /api/article/upload-images
 * 上传配图到WordPress
 */
router.post('/upload-images', async (req, res) => {
  try {
    const { site_id, title, images, keywords } = req.body;

    if (!site_id) {
      return res.status(400).json({
        success: false,
        error: '请选择WordPress站点'
      });
    }

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有配图需要上传'
      });
    }

    console.log(`上传配图到WordPress: ${site_id} | ${images.length}张`);

    const result = await uploadImagesToWordPress({
      siteId: site_id,
      title,
      images,
      keywords
    });

    // 更新文章内容中的图片URL
    let content = req.body.content || '';
    if (content) {
      content = updateContentWithNewImages(content, images, result.images);
    }

    return res.json({
      success: true,
      data: {
        images: result.images,
        uploaded_count: result.uploaded_count,
        content: content
      }
    });

  } catch (error) {
    console.error('配图上传失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '上传失败'
    });
  }
});

/**
 * POST /api/article/download-images
 * 下载优化后的图片到本地
 */
router.post('/download-images', async (req, res) => {
  try {
    const { title, images } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有配图需要下载'
      });
    }

    // 检查图片是否已优化
    const optimizedImages = images.filter(img => img.seo_optimized);
    if (optimizedImages.length === 0) {
      return res.status(400).json({
        success: false,
        error: '图片未优化，请先点击"SEO优化配图"'
      });
    }

    console.log(`下载优化后的图片: ${optimizedImages.length}张`);

    const result = await downloadOptimizedImages({
      images: optimizedImages,
      articleTitle: title
    });

    return res.json({
      success: true,
      data: {
        images: result.images,
        download_dir: result.download_dir,
        downloaded_count: result.downloaded_count
      }
    });

  } catch (error) {
    console.error('图片下载失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '下载失败'
    });
  }
});

export default router;
