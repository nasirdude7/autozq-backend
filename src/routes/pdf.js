import express from 'express';
import { upload } from '../middleware/upload.js';
import { generateQuotePDF } from '../services/pdfGenerator.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * POST /api/pdf/generate
 * 生成PDF报价单
 */
router.post('/generate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传车辆主图'
      });
    }

    const vehicleInfo = JSON.parse(req.body.vehicleInfo);
    const config = JSON.parse(req.body.config);
    const prices = JSON.parse(req.body.prices);

    // 多语言 + 车辆类型 + 车况
    const language = req.body.language || 'ru';
    const vehicleType = req.body.vehicle_type || 'new';
    const conditionDescription = req.body.condition_description || '';

    console.log('生成PDF:', vehicleInfo.brand, vehicleInfo.model, '| 语言:', language, '| 类型:', vehicleType);

    // 生成PDF
    const pdfPath = await generateQuotePDF({
      imagePath: req.file.path,
      vehicleInfo,
      config,
      prices,
      language,
      vehicleType,
      conditionDescription
    });

    // 返回PDF文件路径
    const filename = path.basename(pdfPath);
    const url = `/uploads/${filename}`;

    return res.json({
      success: true,
      data: {
        url,
        filename
      }
    });

  } catch (error) {
    console.error('生成PDF失败:', error);

    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
