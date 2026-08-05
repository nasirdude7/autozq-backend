import OpenAI from 'openai';
import fs from 'fs';
import sharp from 'sharp';
import { HttpsProxyAgent } from 'https-proxy-agent';

console.log('🧪 最终测试: gpt-5.5 @ moai.wiki\n');

const client = new OpenAI({
  apiKey: 'sk-DrJyhO3IUf0FlaP8nLQ0oBhvAl7naPUW4u4TUU2LBD2niqMk',
  baseURL: 'https://moai.wiki/v1',
  httpAgent: new HttpsProxyAgent('http://127.0.0.1:10808')
});

// 测试1: 纯文本（验证 API Key 和模型可用性）
console.log('📝 测试1: 纯文本请求');
try {
  const textResult = await client.chat.completions.create({
    model: 'gpt-5.5',
    messages: [
      { role: 'user', content: '你好，请简短回复' }
    ],
    temperature: 0.7,
    max_tokens: 50
  });
  console.log('✅ 文本请求成功');
  console.log('回复:', textResult.choices[0].message.content);
} catch (error) {
  console.log('❌ 文本请求失败:', error.status, '-', error.message);
  console.log('详细错误:', error);
  process.exit(1);
}

// 测试2: 图片识别
console.log('\n📸 测试2: 图片识别');
const imageBuffer = fs.readFileSync('C:\\Users\\admin\\Desktop\\1.png');
console.log('原始大小:', (imageBuffer.length / 1024).toFixed(2), 'KB');

// 压缩图片
const compressed = await sharp(imageBuffer)
  .resize(800, 600, { fit: 'inside' })
  .jpeg({ quality: 75 })
  .toBuffer();

console.log('压缩后:', (compressed.length / 1024).toFixed(2), 'KB');

const base64 = compressed.toString('base64');

try {
  const visionResult = await client.chat.completions.create({
    model: 'gpt-5.5',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请识别这张图片中的车辆品牌和型号。'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`
            }
          }
        ]
      }
    ],
    temperature: 0.3,
    max_tokens: 300
  });

  console.log('✅ 识别成功!');
  console.log('结果:', visionResult.choices[0].message.content);
  console.log('Token:', visionResult.usage);

} catch (error) {
  console.log('❌ 识别失败:', error.status, '-', error.message);
}
