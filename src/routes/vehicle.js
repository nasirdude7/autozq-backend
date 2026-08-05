import express from 'express';
import { upload } from '../middleware/upload.js';
// import { recognizeVehicleFromImage } from '../services/claudeVision.js';
import { recognizeVehicleFromImage } from '../services/openaiVision.js';  // 使用真实 OpenAI API
// import { recognizeVehicleFromImage } from '../services/mockVision.js';
import { postProcessRecognitionData } from '../services/confidenceEvaluator.js';
import fs from 'fs';

const router = express.Router();

/**
 * POST /api/vehicle/recognize
 * 上传车辆图片并识别信息
 */
router.post('/recognize', upload.single('image'), async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传图片文件'
      });
    }

    console.log('收到图片上传:', req.file.filename);

    // 调用 Claude Vision 识别服务
    const result = await recognizeVehicleFromImage(req.file.path);

    // 识别失败
    if (!result.success) {
      // 删除上传的文件
      fs.unlinkSync(req.file.path);

      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // 后处理识别数据
    const processedData = postProcessRecognitionData(result.data);

    // 删除上传的文件（可选：如果需要保留图片用于记录，可以注释掉这行）
    fs.unlinkSync(req.file.path);

    // 返回识别结果
    return res.json({
      success: true,
      data: processedData
    });

  } catch (error) {
    console.error('车辆识别接口错误:', error);

    // 如果文件已上传，删除它
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vehicle/health
 * 健康检查接口
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '车辆识别服务运行正常',
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY
  });
});

export default router;
