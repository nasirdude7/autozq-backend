import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';

console.log('🧪 测试背景替换功能\n');

const imagePath = 'C:\\Users\\admin\\Desktop\\1.png';

if (!fs.existsSync(imagePath)) {
  console.log('❌ 测试图片不存在:', imagePath);
  process.exit(1);
}

const formData = new FormData();
formData.append('image', fs.createReadStream(imagePath));
formData.append('vehicleInfo', JSON.stringify({
  brand: 'Volkswagen',
  model: 'Tharu'
}));

const agent = new HttpsProxyAgent('http://127.0.0.1:10808');

console.log('📤 发送背景替换请求...');

fetch('http://localhost:3001/api/image/replace-background', {
  method: 'POST',
  body: formData,
  agent: agent
})
.then(async response => {
  console.log('📥 收到响应，状态码:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ 请求失败');
    console.log('错误详情:', errorText);
    return;
  }

  const result = await response.json();

  if (result.success) {
    console.log('✅ 背景替换成功!');
    console.log('新图片URL:', result.data.url);
  } else {
    console.log('❌ 背景替换失败');
    console.log('错误:', result.error);
  }
})
.catch(error => {
  console.log('❌ 请求异常:', error.message);
});
