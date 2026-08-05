import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 测试配置搜索完整性\n');

const response = await fetch('http://localhost:3001/api/vehicle/search-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand: 'Volkswagen',
    model: 'Tharu',
    year: '2022',
    displacement: '1.4T'
  })
});

const result = await response.json();

if (result.success) {
  console.log('✅ 搜索成功\n');
  console.log('返回的配置项:');
  Object.keys(result.data).forEach(key => {
    const value = result.data[key];
    const length = typeof value === 'string' ? value.length : 0;
    console.log(`\n【${key}】(${length}字符):`);
    console.log(value);
  });
} else {
  console.log('❌ 搜索失败:', result.error);
}
