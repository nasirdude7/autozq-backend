import OpenAI from 'openai';
import fs from 'fs';
import sharp from 'sharp';
import { HttpsProxyAgent } from 'https-proxy-agent';

console.log('🧪 测试新配置: gpt-5.5 @ 9527code.com (使用代理)\n');

const client = new OpenAI({
  apiKey: 'sk-uKLUb5maFk9oQlBEpu9zTzqQGDZWtgcta7DlZ5wX0ETJpO5o',
  baseURL: 'https://9527code.com/v1',
  httpAgent: new HttpsProxyAgent('http://127.0.0.1:10808')
});

// 先测试纯文本
console.log('📝 步骤1: 测试纯文本请求...');
try {
  const textResult = await client.chat.completions.create({
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: '请回复"测试成功"' }],
    max_tokens: 50
  });
  console.log('✅ 文本请求成功:', textResult.choices[0].message.content);
} catch (error) {
  console.log('❌ 文本请求失败:', error.status, error.message);
  process.exit(1);
}

// 再测试图片识别
console.log('\n📸 步骤2: 测试车辆图片识别...');
const imageBuffer = fs.readFileSync('C:\\Users\\admin\\Desktop\\1.png');
console.log('原始图片大小:', (imageBuffer.length / 1024).toFixed(2), 'KB');

// 压缩图片
const compressedBuffer = await sharp(imageBuffer)
  .resize(800, 600, { fit: 'inside' })
  .jpeg({ quality: 70 })
  .toBuffer();

console.log('压缩后大小:', (compressedBuffer.length / 1024).toFixed(2), 'KB');

const base64Image = compressedBuffer.toString('base64');

try {
  const visionResult = await client.chat.completions.create({
    model: 'gpt-5.5',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '请识别这张图片中的车辆品牌、型号、年份、颜色。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ]
    }],
    max_tokens: 500
  });

  console.log('✅ 识别成功!');
  console.log('📄 识别结果:', visionResult.choices[0].message.content);
  console.log('🔢 Token使用:', visionResult.usage);

} catch (error) {
  console.log('❌ 识别失败:', error.status, error.message);
}
