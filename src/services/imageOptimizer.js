import fetch from 'node-fetch';
import FormData from 'form-data';
import sharp from 'sharp';
import { getSiteById, getWordPressConfig } from './siteConfig.js';
import { Readable } from 'stream';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 创建代理agent（如果配置了代理）
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
let proxyAgent = null;
if (proxyUrl) {
  proxyAgent = new HttpsProxyAgent(proxyUrl);
}

/**
 * SEO优化配图（下载、压缩、重命名）
 * @param {object} options - { title, images, keywords }
 */
export async function optimizeImagesForSEO(options) {
  const { title, images, keywords = [] } = options;

  const optimizedImages = [];

  for (let idx = 0; idx < images.length; idx++) {
    const img = images[idx];

    try {
      // 1. 生成SEO友好的文件名
      const keyword = keywords[idx] || keywords[0] || 'image';

      // 支持俄语和其他语言的关键词
      let slug = keyword.toLowerCase()
        .replace(/[^Ѐ-ӿa-z0-9\s-]/g, '')  // 保留俄语字母、英文字母、数字
        .replace(/\s+/g, '-')
        .substring(0, 50);

      // 如果slug为空（关键词全是特殊字符），使用默认名称
      if (!slug || slug === '-' || slug === '--') {
        slug = `article-image-${idx + 1}`;
      }

      const filename = `${slug}-${idx + 1}.jpg`;

      // 2. 下载原图
      console.log(`下载图片 ${idx + 1}: ${img.url.substring(0, 60)}...`);
      const imageResponse = await fetch(img.url);

      if (!imageResponse.ok) {
        console.error(`图片下载失败: ${imageResponse.status}`);
        optimizedImages.push({
          ...img,
          filename: filename,
          seo_optimized: false,
          error: 'download_failed'
        });
        continue;
      }

      const imageBuffer = await imageResponse.buffer();

      // 3. 压缩图片（WebP格式）
      console.log(`压缩图片 ${idx + 1}...`);
      const compressedBuffer = await sharp(imageBuffer)
        .resize(1200, 675, {
          fit: 'cover',
          position: 'center'
        })
        .webp({
          quality: 80,  // WebP质量80相当于JPEG质量90
          effort: 4     // 压缩力度（0-6，越高压缩越好但越慢）
        })
        .toBuffer();

      const originalSize = imageBuffer.length;
      const compressedSize = compressedBuffer.length;
      const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);

      console.log(`✅ 压缩完成: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (节省${savedPercent}%)`);

      // 4. 生成Alt标签
      const alt = img.suggestion?.description || `${title} - ${keyword}`;

      // 5. 将压缩后的图片转为Base64（用于传递到前端或上传）
      const base64Image = compressedBuffer.toString('base64');

      // 6. 修改文件名扩展名为.webp
      const webpFilename = filename.replace(/\.(jpg|jpeg|png)$/i, '.webp');

      optimizedImages.push({
        ...img,
        filename: webpFilename,  // 使用WebP文件名
        alt: alt,
        compressed_buffer: compressedBuffer,
        base64: `data:image/webp;base64,${base64Image}`,  // 改为webp MIME类型
        original_size: originalSize,
        compressed_size: compressedSize,
        saved_percent: savedPercent,
        seo_optimized: true
      });

    } catch (error) {
      console.error(`图片${idx + 1}优化失败:`, error.message);
      optimizedImages.push({
        ...img,
        seo_optimized: false,
        error: error.message
      });
    }
  }

  return optimizedImages;
}

/**
 * 上传配图到WordPress（使用已优化的图片）
 * @param {object} options - { siteId, title, images, keywords }
 */
export async function uploadImagesToWordPress(options) {
  const { siteId, title, images, keywords = [] } = options;

  const site = getSiteById(siteId);
  const wpConfig = getWordPressConfig(siteId);

  // 先优化图片（如果还没优化过）
  let imagesToUpload = images;

  if (!images[0]?.seo_optimized) {
    console.log('图片未优化，先执行优化...');
    imagesToUpload = await optimizeImagesForSEO({ title, images, keywords });
    console.log(`优化完成，检查结果:`, imagesToUpload.map(img => ({
      filename: img.filename,
      has_buffer: !!img.compressed_buffer,
      buffer_size: img.compressed_buffer?.length
    })));
  } else {
    // 图片已优化，但compressed_buffer是base64字符串，需要转换回Buffer
    console.log('图片已优化，转换base64为Buffer...');
    imagesToUpload = images.map(img => {
      if (img.base64 && !Buffer.isBuffer(img.compressed_buffer)) {
        // 从base64字符串提取实际数据（去掉"data:image/webp;base64,"前缀）
        const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, '');
        return {
          ...img,
          compressed_buffer: Buffer.from(base64Data, 'base64')
        };
      }
      return img;
    });
    console.log(`Buffer转换完成:`, imagesToUpload.map(img => ({
      filename: img.filename,
      has_buffer: !!img.compressed_buffer,
      buffer_size: img.compressed_buffer?.length
    })));
  }

  const uploadedImages = [];
  let uploadedCount = 0;

  // 先测试WordPress API连接
  console.log('测试WordPress API连接...');

  // 测试：直接连接（不通过代理）
  try {
    const testResponse = await fetch(`${wpConfig.url}/wp-json/wp/v2/media?per_page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64')}`
      }
      // 不使用代理 - 直连WordPress
    });
    console.log(`WordPress API测试: ${testResponse.status} ${testResponse.statusText}`);
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error(`WordPress API错误响应: ${errorText.substring(0, 500)}`);
    }
  } catch (error) {
    console.error(`WordPress连接测试失败:`, error.message);
  }

  for (const img of imagesToUpload) {
    try {
      // 如果优化失败，跳过
      if (!img.seo_optimized || !img.compressed_buffer) {
        console.error(`图片优化失败，跳过上传`);
        uploadedImages.push(img);
        continue;
      }

      // 上传到WordPress
      console.log(`上传到WordPress: ${img.filename}`);

      if (!img.compressed_buffer) {
        console.error(`图片优化失败，跳过上传`);
        uploadedImages.push(img);
        continue;
      }

      const authHeader = `Basic ${Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64')}`;
      console.log(`WordPress URL: ${wpConfig.url}/wp-json/wp/v2/media`);
      console.log(`文件大小: ${Math.round(img.compressed_buffer.length / 1024)}KB`);

      // 添加重试机制
      let wpResponse;
      let uploadSuccess = false;
      const maxRetries = 3;

      for (let retry = 0; retry < maxRetries && !uploadSuccess; retry++) {
        try {
          if (retry > 0) {
            console.log(`第${retry + 1}次尝试上传...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * retry)); // 递增延迟
          }

          // 每次重试都重新创建FormData和流（因为流只能读一次）
          const formData = new FormData();
          const bufferStream = new Readable();
          bufferStream.push(img.compressed_buffer);
          bufferStream.push(null); // 结束流

          formData.append('file', bufferStream, {
            filename: img.filename,
            contentType: 'image/webp',
            knownLength: img.compressed_buffer.length
          });

          wpResponse = await fetch(`${wpConfig.url}/wp-json/wp/v2/media`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader
            },
            body: formData,
            timeout: 60000  // 60秒超时
            // 不使用代理agent - 直连WordPress更稳定
          });

          uploadSuccess = true;
        } catch (fetchError) {
          console.error(`上传失败 (尝试${retry + 1}/${maxRetries}):`, fetchError.message);
          if (retry === maxRetries - 1) {
            throw fetchError;
          }
        }
      }

      if (wpResponse.ok) {
        const wpData = await wpResponse.json();

        // 更新WordPress媒体的Alt标签和标题
        await fetch(`${wpConfig.url}/wp-json/wp/v2/media/${wpData.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: img.alt,
            alt_text: img.alt
          })
          // 不使用代理 - 直连WordPress
        });

        uploadedImages.push({
          ...img,
          url: wpData.source_url,
          wp_id: wpData.id,
          uploaded_to_wp: true
        });
        uploadedCount++;
        console.log(`✅ 上传成功: ${wpData.source_url}`);
      } else {
        const errorText = await wpResponse.text();
        console.error(`WordPress上传失败: ${wpResponse.status} - ${errorText}`);
        uploadedImages.push(img);
      }

    } catch (error) {
      console.error(`图片上传失败:`, error.message);
      uploadedImages.push(img);
    }
  }

  return {
    images: uploadedImages,
    uploaded_count: uploadedCount
  };
}

/**
 * 更新文章内容中的图片URL和Alt标签
 */
export function updateContentWithNewImages(content, oldImages, newImages) {
  let updatedContent = content;

  oldImages.forEach((oldImg, idx) => {
    if (newImages[idx]) {
      const newImg = newImages[idx];

      // 替换URL
      if (oldImg.url !== newImg.url) {
        updatedContent = updatedContent.replace(
          new RegExp(escapeRegExp(oldImg.url), 'g'),
          newImg.url
        );
      }

      // 添加或更新Alt标签
      if (newImg.alt) {
        const imgTagRegex = new RegExp(
          `<img([^>]*?)src="${escapeRegExp(newImg.url)}"([^>]*?)>`,
          'g'
        );
        updatedContent = updatedContent.replace(imgTagRegex, (match) => {
          // 移除旧的alt标签（如果有）
          let cleaned = match.replace(/\s+alt="[^"]*"/g, '');
          // 添加新的alt标签
          return cleaned.replace('<img', `<img alt="${newImg.alt}"`);
        });
      }
    }
  });

  return updatedContent;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
