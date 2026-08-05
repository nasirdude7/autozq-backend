import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 使用 OpenAI API 将文本翻译为目标语言
 * 复用车辆识别相同的 API 配置（key、代理、base URL）
 * @param {string} text - 待翻译文本
 * @param {string} targetLang - 目标语言，默认俄语
 * @returns {Promise<string>} 翻译后的文本，失败时返回原文
 */
export async function translateText(text, targetLang = 'Russian') {
  // 空文本直接返回
  if (!text || !text.trim()) {
    return text;
  }

  try {
    const prompt = `You are a professional automotive translator. Translate the following car listing description into ${targetLang}.

Rules:
- Output ONLY the translated text, no explanations, no quotes.
- Keep the tone natural and suitable for a car sales listing.
- Preserve line breaks and bullet points.
- Keep numbers, units, brand names and model names unchanged.

Text to translate:
${text}`;

    const requestBody = {
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5.5-openai-compact',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.3
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const fetchOptions = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    };

    // 复用代理配置
    if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    const apiUrl = `${process.env.OPENAI_API_BASE || 'https://9527code.com/v1'}/chat/completions`;

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`翻译 API 请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const translated = result.choices?.[0]?.message?.content?.trim();

    if (!translated) {
      throw new Error('翻译 API 返回空内容');
    }

    console.log('🌍 翻译成功:', text.slice(0, 30), '→', translated.slice(0, 30));
    return translated;
  } catch (error) {
    console.error('翻译失败，使用原文:', error.message);
    return text;
  }
}
