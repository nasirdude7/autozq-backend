import express from 'express';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { generateVehicleSEO } from '../services/seoManager.js';
import { getSEOConfig, getDefaultSite } from '../services/siteConfig.js';

const router = express.Router();

/**
 * POST /api/seo/generate
 * 为图片生成Yandex SEO信息（俄语ALT、文件名、Title）
 */
router.post('/generate', async (req, res) => {
  try {
    const { brand, model, year, category, index, color, language } = req.body;

    if (!brand || !model) {
      return res.status(400).json({
        success: false,
        error: '品牌和车型为必填项'
      });
    }

    const lang = language || 'ru';

    // 类型多语言映射
    const categoryMaps = {
      ru: { main: 'главное фото', exterior: 'экстерьер', interior: 'интерьер', detail: 'детали' },
      en: { main: 'main photo', exterior: 'exterior', interior: 'interior', detail: 'details' },
      fr: { main: 'photo principale', exterior: 'extérieur', interior: 'intérieur', detail: 'détails' },
      es: { main: 'foto principal', exterior: 'exterior', interior: 'interior', detail: 'detalles' },
      ar: { main: 'الصورة الرئيسية', exterior: 'الخارجية', interior: 'الداخلية', detail: 'التفاصيل' }
    };
    const categoryMap = categoryMaps[lang] || categoryMaps.ru;
    const categoryText = categoryMap[category] || category;

    const langNames = { ru: 'русском', en: 'English', fr: 'français', es: 'español', ar: 'العربية' };
    const promptLang = langNames[lang] || 'русском';

    console.log(`生成图片SEO: ${brand} ${model} ${category} #${index} | 语言:${lang}`);

    // 构建多语言Prompt - 基于Yandex/Google图片SEO规范
    const prompt = `You are an SEO expert for Yandex and Google. Generate image SEO data for a car sales photo.

ALL TEXT must be in ${promptLang} (except filename which is Latin only).

Car: ${brand} ${model} ${year || ''} ${color || ''}
Photo type: ${categoryText}
Sequence number: ${index}

Generate JSON (alt/title/caption in ${promptLang}, filename in Latin):
{
  "alt": "ALT text in ${promptLang}, 80-125 chars, with keywords (brand, model, year, photo type, 'buy', 'export from China')",
  "title": "Title attribute in ${promptLang}, 40-70 chars",
  "filename": "filename-in-latin-only (brand-model-year-type-number, lowercase, no extension)",
  "caption": "Caption in ${promptLang}, 1 sentence"
}

Requirements:
- ALT must describe image with keywords, natural ${promptLang}, no keyword stuffing
- filename: Latin letters, digits, hyphens only

Return only JSON.`;

    const requestBody = {
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5.5-openai-compact',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.5
    };

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(requestBody)
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

    // 解析JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('响应中未找到有效JSON');
    }

    const seoData = JSON.parse(jsonMatch[0]);

    // 确保filename有.webp扩展名
    if (seoData.filename && !seoData.filename.endsWith('.webp')) {
      seoData.filename = seoData.filename + '.webp';
    }

    return res.json({
      success: true,
      data: seoData
    });

  } catch (error) {
    console.error('SEO生成失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/seo/vehicle
 * 生成车辆页面完整SEO包（多语言，Rank Math 90+）
 */
router.post('/vehicle', async (req, res) => {
  try {
    const vehicleData = req.body;

    if (!vehicleData.brand || !vehicleData.model) {
      return res.status(400).json({
        success: false,
        error: '品牌和车型为必填项'
      });
    }

    // 多语言和车辆类型参数
    const options = {
      language: req.body.language || 'ru',
      vehicleType: req.body.vehicle_type || 'new',
      conditionDescription: req.body.condition_description || '',
      includeFAQ: req.body.include_faq || false
    };

    console.log(`生成车辆SEO: ${vehicleData.brand} ${vehicleData.model} | 语言:${options.language} | 类型:${options.vehicleType} | FAQ:${options.includeFAQ?'是':'否'}`);

    const seoData = await generateVehicleSEO(vehicleData, options);

    return res.json({
      success: true,
      data: seoData
    });

  } catch (error) {
    console.error('车辆SEO生成失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
