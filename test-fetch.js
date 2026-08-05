import fetch from 'node-fetch';
import fs from 'fs';
import sharp from 'sharp';
import { HttpsProxyAgent } from 'https-proxy-agent';

console.log('🧪 直接使用 fetch 测试（绕过 OpenAI SDK）\n');

// 压缩图片
const imageBuffer = fs.readFileSync('C:\\Users\\admin\\Desktop\\1.png');
const compressed = await sharp(imageBuffer)
  .resize(800, 600, { fit: 'inside' })
  .jpeg({ quality: 75 })
  .toBuffer();

const base64 = compressed.toString('base64');

console.log('图片大小:', (compressed.length / 1024).toFixed(2), 'KB');

const agent = new HttpsProxyAgent('http://127.0.0.1:10808');

const requestBody = {
  model: 'gpt-5.5-openai-compact',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '识别这张图片中的车辆品牌和型号' },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
    ]
  }],
  max_tokens: 300
};

console.log('📡 发送请求到 9527code.com...\n');

try {
  const response = await fetch('https://9527code.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-U9fc67kQBwEb8mh4KJx8BDfqxRLxXfXGkwX9QP4xe56cSDne',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify(requestBody),
    agent: agent
  });

  console.log('状态码:', response.status);
  console.log('响应头:', Object.fromEntries(response.headers));

  const data = await response.json();

  if (response.ok) {
    console.log('\n✅ 识别成功!');
    console.log('结果:', data.choices[0].message.content);
  } else {
    console.log('\n❌ 请求失败');
    console.log('错误:', data);
  }

} catch (error) {
  console.log('❌ 请求异常:', error.message);
}
