import OpenAI from 'openai';
import fs from 'fs';
import sharp from 'sharp';

console.log('🧪 测试方案 1: 使用识图 Key (api.9527code.com) - 无代理');

const client1 = new OpenAI({
  apiKey: 'sk-U9fc67kQBwEb8mh4KJx8BDfqxRLxXfXGkwX9QP4xe56cSDne',
  baseURL: 'https://api.9527code.com/v1'
});

const imageBuffer = fs.readFileSync('C:\\Users\\admin\\Desktop\\1.png');
console.log('📸 原始图片大小:', (imageBuffer.length / 1024).toFixed(2), 'KB');

// 压缩图片到 200KB 以下
const compressedBuffer = await sharp(imageBuffer)
  .resize(800, 600, { fit: 'inside' })
  .jpeg({ quality: 70 })
  .toBuffer();

console.log('📸 压缩后大小:', (compressedBuffer.length / 1024).toFixed(2), 'KB');

const base64Image = compressedBuffer.toString('base64');

// 测试方案 1 - 只测试第一个
console.log('\n=== 测试: api.9527code.com + gpt-5.4-openai-compact (压缩图片) ===');
try {
  const result1 = await client1.chat.completions.create({
    model: 'gpt-5.4-openai-compact',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '请识别这张图片中的车辆品牌、型号。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ]
    }],
    max_tokens: 300
  });
  console.log('✅ 识别成功:', result1.choices[0].message.content);
  console.log('🔢 Tokens:', result1.usage);
} catch (error) {
  console.log('❌ 识别失败:', error.status, error.message);
}
