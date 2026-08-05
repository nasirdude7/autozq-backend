import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getLanguageConfig } from '../config/languages.js';
import { generateArticleImages, insertImagesIntoContent } from './imageGenerator.js';

/**
 * 生成SEO文章
 * @param {object} options - { topic, type, wordCount, includeFAQ, language, includeImages }
 */
export async function generateArticle(options) {
  const { topic, type, wordCount, includeFAQ, language, includeImages } = options;

  const langConfig = getLanguageConfig(language);
  const promptLang = langConfig.promptLang;

  // 根据文章类型构建prompt
  const typePrompts = {
    guide: `Write a comprehensive car buying guide about "${topic}". Structure:
- Introduction (why this car, who is it for)
- Key specifications and features
- Performance and driving experience
- Price and value analysis
- Pros and cons
- Final recommendation`,

    comparison: `Write a detailed comparison article between the two cars mentioned in "${topic}". Structure:
- Introduction (why compare these two)
- Design and exterior comparison
- Interior and comfort comparison
- Performance and specs comparison
- Price and value comparison
- Conclusion: which one to choose and why`,

    analysis: `Write an insightful market analysis article about "${topic}". Structure:
- Current market situation
- Key trends and data
- Expert analysis and predictions
- Recommendations for buyers/sellers
- Conclusion and outlook`,

    export: `Write a comprehensive guide about exporting cars from China to ${topic.includes('Russia') || topic.includes('俄罗斯') ? 'Russia' : topic.includes('Canada') || topic.includes('加拿大') ? 'Canada' : 'international markets'}. Structure:
- Why import from China (price advantage, selection, quality)
- Export process step by step (purchase, customs, logistics, delivery)
- Required documents and certifications
- Costs breakdown (car price, shipping, customs, taxes)
- Timeline from order to delivery
- Common questions and solutions
- How to work with export companies`,

    usedcar_benefits: `Write a persuasive article about the benefits of buying used cars from China for export. Structure:
- Introduction: Chinese used car market overview
- Price advantage compared to new cars and other markets
- Quality assurance (inspection systems, certification)
- Wide selection (brands, models, age ranges)
- Export advantages (compliance, paperwork support)
- Case studies or examples
- How to ensure quality when buying used
- Conclusion and call to action`,

    usedcar_tips: `Write a practical guide about how to choose and buy used cars in China for export. Structure:
- Introduction: Chinese used car market basics
- Where to find used cars (dealers, platforms, auctions)
- How to inspect vehicle condition (exterior, interior, mechanical, documents)
- Price negotiation strategies and fair market value
- Essential paperwork and legal requirements
- Red flags to avoid (flood damage, major accidents, odometer fraud)
- Working with export agents vs buying directly
- Final checklist before purchase
- Conclusion with actionable steps`
  };

  const typeInstruction = typePrompts[type] || typePrompts.guide;

  const prompt = `You are an expert automotive content writer specializing in SEO-optimized articles for the Russian export car market (车辆出口到俄罗斯).

Task: Generate a complete SEO article in ${promptLang}.

Topic: ${topic}
Article Type: ${type === 'guide' ? 'Buying Guide' : type === 'comparison' ? 'Comparison Review' : 'Market Analysis'}
Target Word Count: ${wordCount} words
Target Audience: Russian car buyers interested in importing vehicles from China

${typeInstruction}

SEO Requirements:
- Naturally include focus keywords 5-7 times throughout the article
- Use semantic variations and related keywords
- Write engaging, readable content (not keyword-stuffed)
- Include practical, actionable information
- Use short paragraphs (3-4 sentences max)

Return JSON:
{
  "seo_title": "50-60 characters, include main keyword",
  "meta_description": "150-160 characters, compelling with CTA",
  "slug": "url-friendly-version-of-title-in-russian",
  "title": "Main article H1 title",
  "keywords": ["focus_keyword", "related_keyword_1", "related_keyword_2", ...],
  "content": "<h1>Title</h1>\\n<p>Intro paragraph...</p>\\n\\n<h2>Section 1</h2>\\n<p>Content...</p>\\n\\n<h2>Section 2</h2>\\n<p>Content...</p>\\n\\n...",
  ${includeFAQ ? `"faq": [
    {"question": "Question with long-tail keyword?", "answer": "Detailed answer 40-60 words"},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],` : ''}
  "word_count": ${wordCount}
}

IMPORTANT:
- Content MUST be ${wordCount}±100 words (count carefully!)
- Write in natural, flowing ${promptLang}
- Use HTML tags: <h1>, <h2>, <h3>, <p>, <strong>, <em>
- Each <h2> section should be 150-200 words
- ${includeFAQ ? 'Include 5-7 FAQ questions at the end with <h3> for questions' : 'No FAQ needed'}
- Ensure all content is factual and helpful

Return ONLY valid JSON, no markdown code fences.`;

  const requestBody = {
    model: process.env.OPENAI_VISION_MODEL || 'gpt-5.5-openai-compact',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3000,  // 减少到3000，加快生成
    temperature: 0.7,
    stream: false  // 确保不使用流式输出
  };

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify(requestBody),
    timeout: 300000  // 增加到300秒（5分钟）
  };

  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
    console.log(`使用代理: ${proxyUrl}`);
  }

  const apiUrl = `${process.env.OPENAI_API_BASE || 'https://9527code.com/v1'}/chat/completions`;
  console.log(`API地址: ${apiUrl}`);
  console.log(`请求超时: 300秒`);

  // 添加重试逻辑
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {  // 改为3次重试
    try {
      console.log(`尝试第${attempt}次生成文章...`);
      const startTime = Date.now();

      const response = await fetch(apiUrl, fetchOptions);

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`API响应时间: ${elapsed}秒`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`API错误 ${response.status}: ${errorText.substring(0, 200)}`);
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.json();
      const responseText = result.choices[0].message.content;

      // 解析JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效JSON');
      }

      const articleData = JSON.parse(jsonMatch[0]);

      // 验证必填字段
      const required = ['seo_title', 'meta_description', 'title', 'content'];
      for (const field of required) {
        if (!articleData[field]) {
          throw new Error(`缺少必填字段: ${field}`);
        }
      }

      // 计算实际字数
      const textContent = articleData.content.replace(/<[^>]+>/g, ' ').trim();
      const actualWordCount = textContent.split(/\s+/).length;
      articleData.word_count = actualWordCount;

      // 附加语言信息
      articleData.language = language;
      articleData.type = type;
      articleData.generated_at = new Date().toISOString();

      console.log(`✅ 文章生成成功: ${articleData.word_count}词`);

      // 如果需要配图，生成图片
      if (includeImages) {
        try {
          console.log('🎨 开始生成配图...');

          // 提取H2标题作为章节
          const h2Matches = articleData.content.match(/<h2>(.*?)<\/h2>/g) || [];
          const sections = h2Matches.map(h2 => h2.replace(/<\/?h2>/g, '').trim()).slice(0, 3);

          const images = await generateArticleImages({
            topic: topic,
            sections: sections,
            language: language,
            count: 3
          });

          if (images && images.length > 0) {
            articleData.images = images;
            articleData.content = insertImagesIntoContent(articleData.content, images);
            console.log(`✅ 已生成 ${images.length} 张配图`);
          } else {
            console.log('⚠️ 未能生成配图，继续返回纯文本文章');
          }
        } catch (imageError) {
          console.error('配图生成失败:', imageError.message);
          console.log('⚠️ 配图失败，返回纯文本文章');
        }
      }

      return articleData;

    } catch (error) {
      lastError = error;
      console.error(`第${attempt}次尝试失败:`, error.message);

      // 记录详细错误信息
      if (error.type === 'request-timeout') {
        console.error('❌ 请求超时 - 可能是代理问题或API服务器慢');
      } else if (error.code === 'ECONNRESET') {
        console.error('❌ 连接重置 - 网络不稳定');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('❌ 连接超时 - 无法连接到API服务器');
      }

      if (attempt < 3) {  // 改为3次
        const waitTime = attempt * 10;  // 递增等待时间：10秒、20秒
        console.log(`等待${waitTime}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }

  // 所有重试都失败
  throw new Error(`文章生成失败（已重试3次）: ${lastError.message}`);
}
