import OpenAI from 'openai';

console.log('🧪 测试 API Key 是否可用（纯文本请求）\n');

const client = new OpenAI({
  apiKey: 'sk-U9fc67kQBwEb8mh4KJx8BDfqxRLxXfXGkwX9QP4xe56cSDne',
  baseURL: 'https://api.9527code.com/v1'
});

try {
  console.log('📝 发送纯文本请求...');
  const result = await client.chat.completions.create({
    model: 'gpt-5.4-openai-compact',
    messages: [{
      role: 'user',
      content: '你好，请回复"测试成功"'
    }],
    max_tokens: 50
  });

  console.log('✅ API Key 有效');
  console.log('📄 响应:', result.choices[0].message.content);
  console.log('🔢 Tokens:', result.usage);

} catch (error) {
  console.log('❌ API Key 无效或模型不可用');
  console.log('状态码:', error.status);
  console.log('错误:', error.message);
}
