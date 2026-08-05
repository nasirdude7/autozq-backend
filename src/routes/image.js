import express from 'express';
import { upload } from '../middleware/upload.js';
import { replaceBackground } from '../services/backgroundReplacement.js';
import { compressToWebP } from '../services/imageCompression.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * POST /api/image/compress-webp
 * 压缩为WebP并重命名
 */
router.post('/compress-webp', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传图片' });
    }

    const options = {
      brand: req.body.brand || '',
      model: req.body.model || '',
      year: req.body.year || '',
      category: req.body.category || 'main',
      index: parseInt(req.body.index) || 1
    };

    console.log(`收到压缩请求: ${req.file.originalname}`);
    console.log(`重命名参数:`, options);

    // 调用压缩服务
    const result = await compressToWebP(req.file.path, options);

    // 保存压缩后的文件
    const outputPath = path.join(process.env.UPLOAD_DIR || './uploads', result.filename);
    fs.writeFileSync(outputPath, result.buffer);

    // 删除原始上传文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: '压缩成功',
      data: {
        filename: result.filename,
        path: outputPath,
        url: `/uploads/${result.filename}`,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: result.compressionRatio
      }
    });

  } catch (error) {
    console.error('压缩失败:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || '压缩失败'
    });
  }
});

/**
 * POST /api/image/replace-background
 * 替换单张图片背景
 */
router.post('/replace-background', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传图片' });
    }

    // 获取车辆信息
    const vehicleInfo = {
      brand: req.body.brand || '',
      model: req.body.model || ''
    };

    console.log(`收到背景替换请求: ${req.file.originalname}`);
    console.log(`车辆信息: ${vehicleInfo.brand} ${vehicleInfo.model}`);

    // 调用背景替换服务
    const resultBuffer = await replaceBackground(req.file.path, vehicleInfo);

    // 生成输出文件名
    const outputFileName = `bg-replaced-${Date.now()}.png`;
    const outputPath = path.join(process.env.UPLOAD_DIR || './uploads', outputFileName);

    // 保存处理后的图片
    fs.writeFileSync(outputPath, resultBuffer);

    // 删除原始上传文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: '背景替换成功',
      data: {
        filename: outputFileName,
        path: outputPath,
        url: `/uploads/${outputFileName}`
      }
    });

  } catch (error) {
    console.error('背景替换失败:', error);

    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || '背景替换失败'
    });
  }
});

/**
 * POST /api/image/batch-replace-background
 * 批量替换背景
 */
router.post('/batch-replace-background', upload.array('images', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '未上传图片' });
    }

    const vehicleInfo = {
      brand: req.body.brand || '',
      model: req.body.model || ''
    };

    console.log(`收到批量背景替换请求: ${req.files.length} 张图片`);

    const results = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`处理第 ${i + 1}/${req.files.length} 张: ${file.originalname}`);

      try {
        const resultBuffer = await replaceBackground(file.path, vehicleInfo);

        const outputFileName = `bg-replaced-${Date.now()}-${i}.png`;
        const outputPath = path.join(process.env.UPLOAD_DIR || './uploads', outputFileName);

        fs.writeFileSync(outputPath, resultBuffer);
        fs.unlinkSync(file.path);

        results.push({
          success: true,
          originalName: file.originalname,
          filename: outputFileName,
          url: `/uploads/${outputFileName}`
        });

      } catch (error) {
        console.error(`处理失败 ${file.originalname}:`, error.message);
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        results.push({
          success: false,
          originalName: file.originalname,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `成功处理 ${successCount}/${req.files.length} 张图片`,
      data: results
    });

  } catch (error) {
    console.error('批量背景替换失败:', error);

    // 清理所有上传的文件
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || '批量背景替换失败'
    });
  }
});

export default router;
