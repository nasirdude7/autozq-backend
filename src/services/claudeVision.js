import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

// 初始化 Anthropic 客户端
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_API_BASE || 'https://api.anthropic.com',
});

/**
 * 使用 Claude Vision 识别车辆信息
 * @param {string} imagePath - 图片文件路径
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeVehicleFromImage(imagePath) {
  try {
    // 读取图片文件并转为 base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // 获取图片 MIME 类型
    const mimeType = getImageMimeType(imagePath);

    // 构建识别 Prompt
    const prompt = `你是一个专业的汽车信息识别助手。请从图片中提取以下字段，
严格返回JSON格式，不要任何多余文字：

{
  "brand": {"value": "", "confidence": "high|medium|low"},
  "model": {"value": "", "confidence": "high|medium|low"},
  "year": {"value": "", "confidence": "high|medium|low"},
  "color": {"value": "", "confidence": "high|medium|low"},
  "mileage": {"value": "", "unit": "km", "confidence": "high|medium|low"},
  "displacement": {"value": "", "confidence": "high|medium|low"},
  "horsepower": {"value": "", "confidence": "high|medium|low"},
  "transmission": {"value": "", "confidence": "high|medium|low"},
  "drive_type": {"value": "", "confidence": "high|medium|low"}
}

置信度规则：
- high：图片中明确可见
- medium：可以推断但不完全确定
- low：无法识别或图片中未显示，value留空`;

    // 调用 Claude Vision API
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // 提取响应内容
    const responseText = message.content[0].text;

    // 解析 JSON 响应
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Claude 响应中未找到有效的 JSON 格式');
    }

    const recognizedData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: recognizedData,
    };
  } catch (error) {
    console.error('Claude Vision 识别失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param {string} filePath - 文件路径
 * @returns {string} MIME 类型
 */
function getImageMimeType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}
