import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

/**
 * 使用 gpt-image-2 API 替换背景
 * @param {string} imagePath - 原始图片路径
 * @param {object} vehicleInfo - 车辆信息（品牌、车型）
 * @returns {Promise<Buffer>} 处理后的图片Buffer
 */
export async function replaceBackground(imagePath, vehicleInfo = {}) {
  const apiKey = process.env.IMAGE_API_KEY;
  const apiBase = process.env.IMAGE_API_BASE || 'https://moai.wiki/v1';

  if (!apiKey) {
    throw new Error('IMAGE_API_KEY not configured');
  }

  const { brand = '', model = '' } = vehicleInfo;

  // 构建 prompt
  const prompt = `Replace the background of this ${brand} ${model} car image with a professional showroom style. Requirements:
1. Pure light gray gradient background (#F0F0F0)
2. Center the vehicle, align to bottom
3. Vehicle width 80% of canvas
4. Soft ground shadow
5. Professional studio lighting
6. Enhanced paint gloss
7. Size: 800x600px`;

  try {
    console.log('🎨 调用 gpt-image-2 API 替换背景...');
    console.log(`车辆信息: ${brand} ${model}`);

    // 使用 FormData 构建请求
    // 配置代理
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

    // 带重试的API调用（应对524超时）
    const maxRetries = 3;
    let response;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 每次重试重新创建FormData（流只能用一次）
        const fd = new FormData();
        fd.append('model', 'gpt-image-2');
        fd.append('image', fs.createReadStream(imagePath));
        fd.append('prompt', prompt);
        fd.append('n', '1');
        fd.append('size', '800x600');

        // 使用 AbortController 控制总超时（240秒，图片生成约需70-120秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 240000);

        const fetchOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...fd.getHeaders()
          },
          body: fd,
          signal: controller.signal
        };

        if (proxyUrl) {
          fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
        }

        console.log(`🎨 尝试 ${attempt}/${maxRetries} 调用背景替换API...`);
        if (proxyUrl) console.log(`📡 使用代理: ${proxyUrl}`);

        try {
          response = await fetch(`${apiBase}/images/edits`, fetchOptions);
        } finally {
          clearTimeout(timeoutId);
        }

        // 524/502/503 是服务器超时/繁忙，重试
        if (response.status === 524 || response.status === 502 || response.status === 503) {
          lastError = `API ${response.status} (服务器超时/繁忙)`;
          console.log(`⚠️ ${lastError}，准备重试...`);
          await new Promise(r => setTimeout(r, 3000)); // 等3秒再试
          continue;
        }

        // 其他响应直接处理
        break;
      } catch (err) {
        lastError = err.message;
        console.log(`⚠️ 请求异常: ${err.message}，准备重试...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!response || (response.status === 524 || response.status === 502 || response.status === 503)) {
      throw new Error(`背景替换失败（已重试${maxRetries}次）: ${lastError}。图片生成服务繁忙，请稍后再试。`);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} ${error}`);
    }

    const result = await response.json();

    // 调试：打印 API 返回结果
    console.log('📥 API 返回成功');
    console.log('📄 返回格式:', JSON.stringify(result).substring(0, 200));

    // 尝试多种可能的响应格式
    let imageUrl = null;

    // 格式1: OpenAI标准格式 {data: [{url: "..."}]}
    if (result.data && result.data[0] && result.data[0].url) {
      imageUrl = result.data[0].url;
    }
    // 格式2: {data: [{b64_json: "..."}]}
    else if (result.data && result.data[0] && result.data[0].b64_json) {
      const resultBuffer = Buffer.from(result.data[0].b64_json, 'base64');
      console.log('✅ 背景替换成功，图片大小:', (resultBuffer.length / 1024).toFixed(2), 'KB');
      return resultBuffer;
    }
    // 格式3: {choices: [{message: {content: "..."}}]}
    else if (result.choices && result.choices[0]) {
      const content = result.choices[0].message?.content || '';
      // 提取 markdown 格式的 base64 图片
      const base64Match = content.match(/!\[.*?\]\(data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)\)/);
      if (base64Match && base64Match[1]) {
        const resultBuffer = Buffer.from(base64Match[1], 'base64');
        console.log('✅ 背景替换成功，图片大小:', (resultBuffer.length / 1024).toFixed(2), 'KB');
        return resultBuffer;
      }
    }

    // 如果有URL，下载图片
    if (imageUrl) {
      console.log('📥 下载处理后的图片...');
      console.log('📍 图片URL:', imageUrl);

      const downloadOptions = {
        timeout: 60000  // 60秒超时
      };

      if (proxyUrl) {
        downloadOptions.agent = new HttpsProxyAgent(proxyUrl);
      }

      try {
        const imageResponse = await fetch(imageUrl, downloadOptions);
        console.log('📥 下载响应状态:', imageResponse.status);

        if (!imageResponse.ok) {
          throw new Error(`下载图片失败: ${imageResponse.status} ${imageResponse.statusText}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const resultBuffer = Buffer.from(arrayBuffer);
        console.log('✅ 背景替换成功，图片大小:', (resultBuffer.length / 1024).toFixed(2), 'KB');
        return resultBuffer;
      } catch (downloadError) {
        console.error('❌ 下载图片出错:', downloadError.message);
        throw new Error(`下载处理后的图片失败: ${downloadError.message}`);
      }
    }

    throw new Error('无法从API响应中提取图片，响应格式: ' + JSON.stringify(result).substring(0, 100));

  } catch (error) {
    console.error('❌ 背景替换失败:', error.message);
    throw error;
  }
}

/**
 * 批量替换背景
 * @param {Array} imagePaths - 图片路径数组
 * @param {object} vehicleInfo - 车辆信息
 * @returns {Promise<Array>} 处理后的图片Buffer数组
 */
export async function batchReplaceBackground(imagePaths, vehicleInfo) {
  const results = [];

  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`处理第 ${i + 1}/${imagePaths.length} 张图片...`);
    try {
      const result = await replaceBackground(imagePaths[i], vehicleInfo);
      results.push({
        success: true,
        data: result,
        originalPath: imagePaths[i]
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        originalPath: imagePaths[i]
      });
    }
  }

  return results;
}
