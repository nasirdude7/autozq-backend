import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';

/**
 * 上传图片到WordPress媒体库
 * @param {string} imagePath - 图片文件路径
 * @param {object} options - 上传选项
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadToWordPress(imagePath, options = {}) {
  const wpUrl = process.env.WP_URL;
  const wpUsername = process.env.WP_USERNAME;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  if (!wpUrl || !wpUsername || !wpAppPassword) {
    throw new Error('WordPress 配置未设置（WP_URL/WP_USERNAME/WP_APP_PASSWORD）');
  }

  const { alt = '', title = '' } = options;

  try {
    // 读取图片文件
    const imageBuffer = fs.readFileSync(imagePath);
    const filename = imagePath.split(/[/\\]/).pop();

    // 准备表单数据
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: filename,
      contentType: 'image/webp'
    });

    // 构建 Basic Auth
    const auth = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');

    console.log(`📤 上传到 WordPress: ${filename}`);

    // 上传到WordPress媒体库
    const response = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WordPress API error: ${response.status} ${error}`);
    }

    const result = await response.json();

    // 如果提供了 ALT 和 Title，更新媒体信息
    if (alt || title) {
      const updateData = {};
      if (alt) updateData.alt_text = alt;
      if (title) updateData.title = title;

      await fetch(`${wpUrl}/wp-json/wp/v2/media/${result.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      console.log(`✅ 已更新 ALT 和 Title`);
    }

    console.log(`✅ 上传成功: ${result.source_url}`);

    return {
      id: result.id,
      url: result.source_url,
      filename: filename,
      alt: alt,
      title: title
    };

  } catch (error) {
    console.error('❌ WordPress 上传失败:', error.message);
    throw error;
  }
}

/**
 * 批量上传到WordPress
 * @param {Array} imagePaths - 图片路径数组
 * @param {Array} seoData - SEO数据数组
 * @returns {Promise<Array>} 上传结果数组
 */
export async function batchUploadToWordPress(imagePaths, seoData = []) {
  const results = [];

  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`上传第 ${i + 1}/${imagePaths.length} 张图片...`);
    try {
      const options = seoData[i] || {};
      const result = await uploadToWordPress(imagePaths[i], options);
      results.push({
        success: true,
        ...result,
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
