import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 下载优化后的图片到本地
 * @param {object} options - { images, articleTitle }
 */
export async function downloadOptimizedImages(options) {
  const { images, articleTitle } = options;

  // 创建下载目录
  const downloadDir = path.join(__dirname, '../../../downloads/images');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadedImages = [];

  for (const img of images) {
    try {
      // 如果图片已经优化过，使用压缩后的buffer
      if (img.compressed_buffer) {
        const filePath = path.join(downloadDir, img.filename);
        fs.writeFileSync(filePath, img.compressed_buffer);

        downloadedImages.push({
          ...img,
          local_path: filePath,
          relative_path: `downloads/images/${img.filename}`,
          downloaded: true
        });

        console.log(`✅ 已保存: ${img.filename}`);
      } else {
        console.warn(`⚠️ 图片未优化，跳过: ${img.filename || 'unknown'}`);
        downloadedImages.push({
          ...img,
          downloaded: false,
          error: 'not_optimized'
        });
      }

    } catch (error) {
      console.error(`下载失败:`, error.message);
      downloadedImages.push({
        ...img,
        downloaded: false,
        error: error.message
      });
    }
  }

  return {
    images: downloadedImages,
    download_dir: downloadDir,
    downloaded_count: downloadedImages.filter(img => img.downloaded).length
  };
}
