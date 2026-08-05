import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/sales';

const customers = [
  {
    name: "Иван Петров",
    phone: "+7-903-123-4567",
    country: "Russia",
    language: "ru",
    source: "WhatsApp",
    rating: "hot"
  },
  {
    name: "Алексей Смирнов",
    phone: "+7-905-987-6543",
    country: "Russia",
    language: "ru",
    source: "Telegram",
    rating: "warm"
  },
  {
    name: "李明",
    phone: "+86-138-0000-1234",
    country: "China",
    language: "zh",
    source: "WeChat",
    rating: "cold"
  },
  {
    name: "محمد أحمد",
    phone: "+971-50-123-4567",
    country: "UAE",
    language: "ar",
    source: "WhatsApp",
    rating: "warm"
  },
  {
    name: "Dmitry Volkov",
    phone: "+7-916-555-7788",
    country: "Russia",
    language: "ru",
    source: "Website",
    rating: "hot"
  }
];

async function createCustomers() {
  console.log('🔄 开始创建测试客户...\n');

  for (const customer of customers) {
    try {
      const response = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(customer)
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ 创建成功: ${customer.name} (${customer.country})`);
      } else {
        console.log(`❌ 创建失败: ${customer.name} - ${data.error}`);
      }
    } catch (error) {
      console.error(`❌ 请求失败: ${customer.name} - ${error.message}`);
    }
  }

  console.log('\n✅ 所有客户创建完成！');
}

createCustomers();
