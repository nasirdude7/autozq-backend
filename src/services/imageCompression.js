import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * 压缩图片为WebP格式并重命名
 * @param {string} imagePath - 原始图片路径
 * @param {object} options - 重命名选项
 * @returns {Promise<Object>} 处理结果
 */
export async function compressToWebP(imagePath, options = {}) {
  const {
    brand = '',
    model = '',
    year = '',
    category = 'main',
    index = 1
  } = options;

  try {
    // 生成新文件名：品牌-车型-年款-类型-序号.webp
    const categoryMap = {
      main: 'main',
      exterior: 'exterior',
      interior: 'interior',
      detail: 'detail'
    };

    const categoryName = categoryMap[category] || category;
    const yearPart = year ? `-${year}` : '';
    const newFileName = `${brand}-${model}${yearPart}-${categoryName}-${index}.webp`;

    // 读取原始图片
    const imageBuffer = fs.readFileSync(imagePath);

    // 使用 sharp 压缩为 WebP
    const outputBuffer = await sharp(imageBuffer)
      .webp({
        quality: 85, // 高质量压缩
        effort: 6    // 压缩效率
      })
      .toBuffer();

    console.log(`✅ 压缩完成: ${newFileName}`);
    console.log(`原始大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`压缩后: ${(outputBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`压缩率: ${((1 - outputBuffer.length / imageBuffer.length) * 100).toFixed(1)}%`);

    return {
      buffer: outputBuffer,
      filename: newFileName,
      originalSize: imageBuffer.length,
      compressedSize: outputBuffer.length,
      compressionRatio: ((1 - outputBuffer.length / imageBuffer.length) * 100).toFixed(1)
    };

  } catch (error) {
    console.error('压缩失败:', error.message);
    throw error;
  }
}

/**
 * 批量压缩图片
 * @param {Array} imagePaths - 图片路径数组
 * @param {object} vehicleInfo - 车辆信息
 * @returns {Promise<Array>} 处理结果数组
 */
export async function batchCompressToWebP(imagePaths, vehicleInfo) {
  const results = [];

  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`处理第 ${i + 1}/${imagePaths.length} 张图片...`);
    try {
      const result = await compressToWebP(imagePaths[i], {
        ...vehicleInfo,
        index: i + 1
      });
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
