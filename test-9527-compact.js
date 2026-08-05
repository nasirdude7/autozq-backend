import OpenAI from 'openai';
import fs from 'fs';
import sharp from 'sharp';

console.log('🧪 测试新配置: gpt-5.5-openai-compact @ 9527code.com (无代理)\n');

const client = new OpenAI({
  apiKey: 'sk-U9fc67kQBwEb8mh4KJx8BDfqxRLxXfXGkwX9QP4xe56cSDne',
  baseURL: 'https://9527code.com/v1'
});

// 测试1: 纯文本
console.log('📝 测试1: 纯文本请求');
try {
  const textResult = await client.chat.completions.create({
    model: 'gpt-5.5-openai-compact',
    messages: [{ role: 'user', content: '你好' }],
    max_tokens: 20
  });
  console.log('✅ 文本成功:', textResult.choices[0].message.content);
} catch (error) {
  console.log('❌ 文本失败:', error.status, error.message);
  process.exit(1);
}

// 测试2: 图片识别
console.log('\n📸 测试2: 车辆识别');
const imageBuffer = fs.readFileSync('C:\\Users\\admin\\Desktop\\1.png');

const compressed = await sharp(imageBuffer)
  .resize(800, 600, { fit: 'inside' })
  .jpeg({ quality: 75 })
  .toBuffer();

console.log('图片大小:', (compressed.length / 1024).toFixed(2), 'KB');

const base64 = compressed.toString('base64');

try {
  const result = await client.chat.completions.create({
    model: 'gpt-5.5-openai-compact',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '识别这张图片中的车辆品牌、型号、年份、颜色。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ]
    }],
    max_tokens: 300
  });

  console.log('✅ 识别成功!');
  console.log('结果:', result.choices[0].message.content);

} catch (error) {
  console.log('❌ 识别失败:', error.status, error.message);
}
