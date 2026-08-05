import fetch from 'node-fetch';
import fs from 'fs';
import sharp from 'sharp';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 使用原生 fetch 调用 OpenAI Vision API（绕过 SDK 的 403 问题）
 * @param {string} imagePath - 图片文件路径
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeVehicleFromImage(imagePath) {
  try {
    // 读取并压缩图片
    const imageBuffer = fs.readFileSync(imagePath);
    const compressedBuffer = await sharp(imageBuffer)
      .resize(800, 600, { fit: 'inside' })
      .jpeg({ quality: 75 })
      .toBuffer();

    const base64Image = compressedBuffer.toString('base64');

    // 构建识别 Prompt
    const prompt = `You are a professional vehicle information recognition expert. Please carefully analyze this image and extract vehicle information.

Return JSON format with **English values only**:
{
  "brand": {"value": "Brand name", "confidence": "high|medium|low"},
  "model": {"value": "Model name", "confidence": "high|medium|low"},
  "year": {"value": "Year", "confidence": "high|medium|low"},
  "color": {"value": "Color", "confidence": "high|medium|low"},
  "mileage": {"value": "Number only", "unit": "km", "confidence": "high|medium|low"},
  "displacement": {"value": "e.g., 2.0L", "confidence": "high|medium|low"},
  "horsepower": {"value": "e.g., 150hp", "confidence": "high|medium|low"},
  "transmission": {"value": "Type", "confidence": "high|medium|low"},
  "drive_type": {"value": "FWD/RWD/AWD", "confidence": "high|medium|low"}
}

Return only JSON, no other text.`;

    // 准备请求体
    const requestBody = {
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5.5-openai-compact',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
      }],
      max_tokens: 1024,
      temperature: 0.3
    };

    // 配置请求头和代理
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const fetchOptions = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    };

    // 如果配置了代理，使用代理
    if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    const apiUrl = `${process.env.OPENAI_API_BASE || 'https://9527code.com/v1'}/chat/completions`;

    // 调用 API
    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // 提取响应内容
    const responseText = result.choices[0].message.content;
    console.log('🤖 OpenAI 原始响应:', responseText);

    // 解析 JSON 响应
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('OpenAI 响应中未找到有效的 JSON 格式');
    }

    const recognizedData = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: recognizedData,
    };
  } catch (error) {
    console.error('OpenAI Vision 识别失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
