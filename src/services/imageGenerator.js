import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getImageFromPool } from '../config/imagePool.js';

/**
 * 为文章生成配图建议（不实际生成图片）
 * @param {object} options - { topic, sections, language, count }
 * @returns {Array} 配图建议数组
 */
export async function generateImageSuggestions(options) {
  const { topic, sections = [], language = 'ru', count = 3 } = options;

  const suggestions = [];

  // 主题头图建议
  suggestions.push({
    position: 'header',
    description: `${topic}相关的专业摄影照片`,
    keywords: extractKeywords(topic),
    unsplash_search: `${topic.split(' ').slice(0, 3).join(' ')} professional photography`
  });

  // 章节配图建议
  sections.slice(0, count - 1).forEach((section, idx) => {
    suggestions.push({
      position: `section_${idx + 1}`,
      description: `${section}相关场景`,
      keywords: extractKeywords(section),
      unsplash_search: `${section.split(' ').slice(0, 3).join(' ')} scene`
    });
  });

  return suggestions;
}

/**
 * 提取关键词
 */
function extractKeywords(text) {
  return text.split(/[\s,，]+/).slice(0, 5).join(', ');
}

/**
 * 尝试从API生成实际图片（可选）
 */
export async function generateArticleImages(options) {
  const { topic, sections = [], language = 'ru', count = 3 } = options;

  console.log('🎨 尝试生成配图...');

  // 先返回配图建议
  const suggestions = await generateImageSuggestions(options);

  // 尝试调用图片生成API
  const images = [];

  for (let i = 0; i < Math.min(count, 3); i++) {
    const suggestion = suggestions[i];
    if (!suggestion) break;

    try {
      const prompt = `Professional photograph: ${suggestion.unsplash_search}, high quality, realistic, detailed`;

      const requestBody = {
        model: 'gpt-image-2',
        prompt: prompt,
        n: 1,
        size: '1024x1024'
      };

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.IMAGE_API_KEY}`,
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify(requestBody),
        timeout: 30000
      };

      if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      }

      const apiUrl = `${process.env.IMAGE_API_BASE || 'https://moai.wiki/v1'}/images/generations`;
      const response = await fetch(apiUrl, fetchOptions);

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data[0] && result.data[0].url) {
          images.push({
            url: result.data[0].url,
            prompt: prompt,
            position: suggestion.position,
            suggestion: suggestion
          });
          console.log(`✅ 配图${i + 1}生成成功`);
        }
      } else {
        console.log(`⚠️ 配图${i + 1}生成失败: ${response.status}, 使用图片池`);

        // 从图片池获取可靠的图片
        const unsplashUrl = getImageFromPool(suggestion.unsplash_search, i);

        images.push({
          url: unsplashUrl,
          prompt: prompt,
          position: suggestion.position,
          suggestion: suggestion,
          source: 'unsplash-pool'
        });
      }

    } catch (error) {
      console.error(`配图${i + 1}生成错误:`, error.message);

      // 从图片池获取可靠的图片作为回退
      const unsplashUrl = getImageFromPool(suggestion.unsplash_search, i);

      images.push({
        url: unsplashUrl,
        position: suggestion.position,
        suggestion: suggestion,
        source: 'unsplash-pool'
      });
    }
  }

  return images;
}

/**
 * 将图片插入到文章HTML中
 */
export function insertImagesIntoContent(content, images) {
  if (!images || images.length === 0) return content;

  let result = content;

  // 在H1后插入主图
  if (images[0]) {
    result = result.replace(
      '</h1>',
      `</h1>\n<img src="${images[0].url}" alt="${images[0].suggestion?.description || 'Header image'}" style="width:100%; max-width:800px; height:auto; border-radius:8px; margin:20px 0;">`
    );
  }

  // 在每个H2前插入图片
  let h2Index = 0;
  result = result.replace(/<h2>/g, () => {
    h2Index++;
    if (images[h2Index]) {
      return `<img src="${images[h2Index].url}" alt="${images[h2Index].suggestion?.description || 'Section image'}" style="width:100%; max-width:800px; height:auto; border-radius:8px; margin:20px 0;">\n<h2>`;
    }
    return '<h2>';
  });

  return result;
}
