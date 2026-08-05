import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import fs from 'fs';
import * as telegramPublisher from '../services/telegramPublisher.js';
import { translateText } from '../services/translator.js';

/**
 * 压缩图片以加快Telegram上传速度
 * 接受 Buffer（base64图片）或本地文件路径，统一压缩为 JPEG
 * 最大宽度1280px，质量80，失败时回退到原始数据
 * @param {Buffer|string} input - 图片Buffer或文件路径
 * @returns {Promise<Buffer|string>} 压缩后的Buffer，失败时返回原输入
 */
async function compressImage(input) {
  try {
    let sourceBuffer;
    if (Buffer.isBuffer(input)) {
      sourceBuffer = input;
    } else if (typeof input === 'string' && fs.existsSync(input)) {
      sourceBuffer = fs.readFileSync(input);
    } else {
      return input;
    }

    const compressed = await sharp(sourceBuffer)
      .rotate() // 根据EXIF自动旋转
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return compressed;
  } catch (error) {
    console.error('图片压缩失败，使用原图:', error.message);
    return input;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * 测试Telegram Bot连接
 */
router.get('/test', async (req, res) => {
  try {
    const botInfo = await telegramPublisher.testConnection();
    res.json({
      success: true,
      data: botInfo,
      message: '✅ Telegram Bot连接成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送纯文本消息
 */
router.post('/send-message', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: '缺少消息文本'
      });
    }

    const result = await telegramPublisher.sendMessage(text);

    res.json({
      success: true,
      data: result,
      message: '✅ 消息已发送'
    });
  } catch (error) {
    console.error('发送Telegram消息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送车辆信息（图片+文字）
 */
router.post('/publish-vehicle', async (req, res) => {
  try {
    const { vehicleData, images } = req.body;

    if (!vehicleData) {
      return res.status(400).json({
        success: false,
        error: '缺少车辆信息'
      });
    }

    // 将卖家描述翻译成俄语（发布到俄罗斯频道）
    if (vehicleData.description && vehicleData.description.trim()) {
      vehicleData.description = await translateText(vehicleData.description, 'Russian');
    }

    // 格式化消息文本
    const messageText = telegramPublisher.formatVehicleMessage(vehicleData);

    let result;

    // 如果有图片，发送图片组
    if (images && images.length > 0) {
      // 处理图片：支持base64、URL、本地路径
      const rawImageData = images.map(img => {
        // 如果是对象，提取dataUrl/url/path
        let imgSource = img;
        if (img && typeof img === 'object') {
          imgSource = img.dataUrl || img.url || img.path || '';
        }

        // base64 dataUrl → 转换为Buffer
        if (typeof imgSource === 'string' && imgSource.startsWith('data:image')) {
          const base64Data = imgSource.replace(/^data:image\/\w+;base64,/, '');
          return Buffer.from(base64Data, 'base64');
        }

        // 本地文件名 → 转换为绝对路径
        if (typeof imgSource === 'string' && imgSource) {
          return path.join(__dirname, '../../uploads', path.basename(imgSource));
        }

        return null;
      }).filter(Boolean);

      // 压缩图片以加快上传速度（减少超时风险）
      const imageData = await Promise.all(rawImageData.map(compressImage));

      if (imageData.length === 0) {
        result = await telegramPublisher.sendMessage(messageText);
      } else if (imageData.length === 1) {
        // 单张图片
        result = await telegramPublisher.sendPhoto(imageData[0], messageText);
      } else {
        // 多张图片（媒体组）
        result = await telegramPublisher.sendMediaGroup(imageData, messageText);
      }
    } else {
      // 没有图片，只发送文本
      result = await telegramPublisher.sendMessage(messageText);
    }

    res.json({
      success: true,
      data: result,
      message: '✅ 车辆信息已发布到Telegram'
    });
  } catch (error) {
    console.error('发布到Telegram失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送文章内容
 */
router.post('/publish-article', async (req, res) => {
  try {
    const { title, content, url } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少标题或内容'
      });
    }

    // 格式化文章消息
    let messageText = `<b>${title}</b>\n\n`;

    // 截取前500字符作为摘要
    const summary = content.substring(0, 500).replace(/<[^>]*>/g, '');
    messageText += summary;

    if (content.length > 500) {
      messageText += '...';
    }

    if (url) {
      messageText += `\n\n🔗 <a href="${url}">阅读全文</a>`;
    }

    const result = await telegramPublisher.sendMessage(messageText);

    res.json({
      success: true,
      data: result,
      message: '✅ 文章已发布到Telegram'
    });
  } catch (error) {
    console.error('发布文章到Telegram失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
