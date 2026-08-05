import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getLanguageConfig } from '../config/languages.js';

/**
 * 为车辆生成完整的SEO包（多语言，Rank Math 90+）
 * @param {object} vehicleData - 车辆信息
 * @param {object} options - { language, vehicleType, conditionDescription }
 */
export async function generateVehicleSEO(vehicleData, options = {}) {
  const {
    brand,
    model,
    year,
    color,
    mileage,
    price,
    displacement,
    horsepower,
    transmission,
    drive_type
  } = vehicleData;

  const language = options.language || 'ru';
  const vehicleType = options.vehicleType || 'new';
  const conditionDescription = options.conditionDescription || '';
  const includeFAQ = options.includeFAQ || false;

  const langConfig = getLanguageConfig(language);
  const promptLang = langConfig.promptLang;
  const vehicleTypeText = vehicleType === 'used'
    ? (language === 'ru' ? 'подержанный автомобиль (с пробегом)'
       : language === 'en' ? 'used car'
       : language === 'fr' ? 'voiture d\'occasion'
       : language === 'es' ? 'coche usado'
       : 'سيارة مستعملة')
    : (language === 'ru' ? 'новый автомобиль'
       : language === 'en' ? 'new car'
       : language === 'fr' ? 'voiture neuve'
       : language === 'es' ? 'coche nuevo'
       : 'سيارة جديدة');

  // 车况信息（仅二手车）
  const conditionBlock = (vehicleType === 'used' && conditionDescription)
    ? `\n\nСостояние автомобиля (车况，需翻译并融入卖家描述):\n${conditionDescription}`
    : '';

  // 构建多语言Prompt
  const prompt = `${langConfig.seoExpert}. Create a PERFECT SEO package for a car sales page (${vehicleTypeText}), ${langConfig.market}.

ALL TEXT CONTENT MUST BE ${promptLang.toUpperCase()} (except url_slug which must be Latin/English only).

Vehicle:
- Brand & Model: ${brand} ${model}
- Year: ${year || 'N/A'}
- Color: ${color || 'N/A'}
- Mileage: ${mileage || 'new'}
- Price: ${price ? price + ' ¥' : 'on request'}
- Engine: ${displacement || ''} ${horsepower || ''}
- Transmission: ${transmission || ''}
- Drivetrain: ${drive_type || ''}
- Type: ${vehicleTypeText}${conditionBlock}

CRITICAL REQUIREMENTS for Rank Math SEO 90+:

1. **SEO Title (50-60 chars)** - Start with main keyword "Buy/Купить [Brand] [Model]", include year, add USP. Focus keyword MUST appear at the beginning.
2. **Meta Description (150-160 chars)** - Hook/benefit + brand/model/year + region + CTA. MUST contain focus keyword.
3. **H1 (different from Title!)** - More detailed with emotional trigger, 50-70 chars. MUST contain focus keyword.
4. **URL Slug** - LATIN ONLY: brand-model-year-keyword (lowercase, digits, hyphens)
5. **Page Description (350-450 words, 4-5 paragraphs in ${promptLang})** - This is CRITICAL for Rank Math score:
   - Paragraph 1 (80-100 words): Hook + focus keyword in first sentence + key selling points
   - Paragraph 2 (90-110 words): Technical specs, engine, transmission, performance details
   - Paragraph 3 (90-110 words): Comfort, safety, features + competitive advantages
   - Paragraph 4 (80-100 words): Export from China benefits, logistics, region (${langConfig.market}), guarantees
   - Paragraph 5 (50-70 words): Strong call-to-action + contact invitation
   - Focus keyword density 1-1.5% (appears 4-6 times naturally)
   - Include related keywords naturally throughout
   - Each paragraph must be a complete, informative thought
6. **Focus Keyword** - main commercial search query (2-4 words in ${promptLang}), e.g. "купить [brand] [model]"
7. **Related Keywords** - 6-8 LSI keywords in ${promptLang} (synonyms, related searches)
8. **H2 suggestions** - 4 section headings in ${promptLang} (Характеристики/Specs, Преимущества/Advantages, Комплектация/Features, Условия/Terms)
${vehicleType === 'used' ? `9. **Seller Description (150-200 words in ${promptLang})** - детальное honest описание состояния на основе предоставленного车况. Опиши: внешний вид, салон, техническое состояние, историю обслуживания, любые особенности. Это блок "описание от продавца" для PDF и страницы.` : ''}

RANK MATH SCORING RULES (achieve 90+):
- Focus keyword in: SEO Title (start), Meta Description, H1, URL, first paragraph, content (density 1-1.5%)
- Content length 350-450 words (2500+ characters) = full content score
- H2/H3 subheadings contain focus keyword or related keywords
- Meta Description has positive/power words and CTA
- Title has number (year) and power word
- Avoid keyword stuffing (Baden-Baden penalty)
- Natural, useful, human-readable text

Return JSON (all values in ${promptLang}, url_slug in Latin only):
{
  "seo_title": "...",
  "meta_description": "...",
  "h1": "...",
  "h2_suggestions": ["...", "...", "...", "..."],
  "url_slug": "latin-only-slug",
  "focus_keyword": "...",
  "related_keywords": ["...", "...", "...", "...", "...", "...", "...", "..."],
  "page_description": "Вступительный абзац текста.\n\n[H2]Технические характеристики Honda CR-V 2023[/H2]\nАбзац с описанием характеристик.\n\n[H2]Преимущества покупки через экспорт[/H2]\nАбзац о преимуществах.\n\n[H2]Условия поставки и гарантии[/H2]\nАбзац про логистику.\n\nЗаключительный абзац с призывом к действию.",
  ${includeFAQ ? `"faq": [
    {"question": "Вопрос 1 с ключевым словом?", "answer": "Краткий ответ 30-50 слов"},
    {"question": "Вопрос 2 про гарантию?", "answer": "Краткий ответ"},
    {"question": "Вопрос 3 про доставку?", "answer": "Краткий ответ"},
    {"question": "Вопрос 4 про цену?", "answer": "Краткий ответ"}
  ],` : ''}
  ${vehicleType === 'used' ? '"seller_description": "детальное описание состояния автомобиля 150-200 слов на основе车况",' : ''}
  "rank_math_score_estimate": 92
}

IMPORTANT:
- page_description MUST be 350-450 words total (count carefully!)
- STRUCTURE: opening paragraph + 3 H2 sections + closing paragraph
- Mark H2 headings with [H2]heading text[/H2] tags - user will copy-paste as-is into WordPress
- Each H2 heading MUST contain focus keyword or a related keyword
- Use \\n\\n between paragraphs, \\n before and after each [H2]...[/H2]
- Content should be natural, readable Russian text that can be directly copy-pasted
${includeFAQ ? `- FAQ: Generate 4-5 questions with long-tail keywords (срок поставки, гарантия, комплектация, цена)
- Each FAQ answer should be 30-50 words, practical and specific
- FAQ questions must use natural phrasing (Какой..., Можно ли..., Предоставляется ли...)` : ''}
- This is the most important factor for Rank Math 90+ score

Return ONLY valid JSON, no markdown code fences.`;

  const requestBody = {
    model: process.env.OPENAI_VISION_MODEL || 'gpt-5.5-openai-compact',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3500,
    temperature: 0.7
  };

  // 校验函数：双档标准
  // ideal=理想区间（触发重试优化），acceptable=Rank Math绿色区间（判定通过）
  function validateSEO(data) {
    const titleLen = (data.seo_title || '').length;
    const descLen = (data.meta_description || '').length;
    // 统计正文词数时去掉 [H2]...[/H2] 和 [H3]...[/H3] 标记
    const cleanText = (data.page_description || '').replace(/\[H[23]\]|\[\/H[23]\]/g, '');
    const wordCount = cleanText.trim().split(/\s+/).length;

    // Rank Math 实际绿色区间（可接受）
    const acceptable = {
      title: titleLen >= 45 && titleLen <= 65,
      desc: descLen >= 140 && descLen <= 165,
      words: wordCount >= 320  // 320词以上即满分区
    };
    // 理想区间（用于优化提示）
    const ideal = {
      title: titleLen >= 50 && titleLen <= 60,
      desc: descLen >= 150 && descLen <= 160,
      words: wordCount >= 350 && wordCount <= 450
    };

    const issues = [];
    if (!ideal.title) issues.push(`Title长度${titleLen}字符（理想50-60）`);
    if (!ideal.desc) issues.push(`Description长度${descLen}字符（理想150-160）`);
    if (!ideal.words) issues.push(`正文${wordCount}词（理想350-450）`);

    return {
      valid: ideal.title && ideal.desc && ideal.words,        // 完美达标
      acceptable: acceptable.title && acceptable.desc && acceptable.words,  // 可接受（绿色）
      issues
    };
  }

  // 单次API调用
  async function callAPI(extraInstruction = '') {
    const body = { ...requestBody };
    if (extraInstruction) {
      body.messages = [{ role: 'user', content: prompt + '\n\n' + extraInstruction }];
    }

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(body)
    };

    if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    const apiUrl = `${process.env.OPENAI_API_BASE || 'https://9527code.com/v1'}/chat/completions`;
    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const result = await response.json();
    const responseText = result.choices[0].message.content;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('响应中未找到有效JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }

  // 带校验的重试逻辑（最多3次）
  let seoData = null;
  let lastValidation = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let extraInstruction = '';

    // 第2次起，根据上次问题给出明确修正指令
    if (attempt > 1 && lastValidation) {
      const fixes = lastValidation.issues.map(issue => {
        if (issue.includes('Title')) return `- SEO Title必须严格控制在50-60个字符之间`;
        if (issue.includes('Description')) return `- Meta Description必须严格控制在150-160个字符之间`;
        if (issue.includes('正文')) return `- page_description正文必须严格在350-450词之间，分5段`;
        return '';
      }).filter(Boolean).join('\n');

      extraInstruction = `CRITICAL FIX REQUIRED - previous attempt failed validation:\n${fixes}\n\nPlease regenerate with EXACT length requirements. Count characters/words carefully.`;
      console.log(`SEO第${attempt}次重试，修正: ${lastValidation.issues.join('; ')}`);
    }

    seoData = await callAPI(extraInstruction);

    // 校验必填字段
    const required = ['seo_title', 'meta_description', 'h1', 'url_slug', 'focus_keyword', 'page_description'];
    const missing = required.filter(f => !seoData[f]);
    if (missing.length > 0) {
      lastValidation = { valid: false, issues: [`缺少字段: ${missing.join(',')}`] };
      continue;
    }

    // 校验长度标准
    lastValidation = validateSEO(seoData);

    if (lastValidation.valid) {
      console.log(`✅ SEO第${attempt}次生成完美达标`);
      break;
    }

    if (lastValidation.acceptable) {
      console.log(`✅ SEO第${attempt}次达到Rank Math绿色区间（可接受）`);
      break;
    }

    console.log(`⚠️ SEO第${attempt}次未达标: ${lastValidation.issues.join('; ')}`);
  }

  // 如果重试后仍不完美，记录但仍返回（避免完全失败）
  if (lastValidation && !lastValidation.acceptable) {
    console.log(`⚠️ SEO经${maxAttempts}次重试仍有偏差，返回最佳结果`);
    seoData._validation_note = lastValidation.issues.join('; ');
  }

  // 验证URL只包含拉丁字母
  if (!/^[a-z0-9-]+$/.test(seoData.url_slug)) {
    seoData.url_slug = `${brand.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}-${year || 'new'}-export`
      .replace(/[^a-z0-9-]/g, '');
  }

  // 附加语言信息
  seoData.language = language;
  seoData.vehicle_type = vehicleType;

  return seoData;
}
