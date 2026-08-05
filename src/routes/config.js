import express from 'express';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const router = express.Router();

/**
 * POST /api/vehicle/search-config
 * 联网搜索车辆完整配置
 */
router.post('/search-config', async (req, res) => {
  try {
    const { brand, model, year, displacement } = req.body;

    if (!brand || !model) {
      return res.status(400).json({
        success: false,
        error: '品牌和车型为必填项'
      });
    }

    const searchInfo = `${brand} ${model} ${year || ''} ${displacement || ''}`.trim();
    console.log(`搜索车辆配置: ${searchInfo}`);

    // 构建搜索查询 - 让模型基于训练数据生成配置信息
    const prompt = `As a vehicle specification expert, provide COMPLETE and DETAILED specifications for ${searchInfo} in Russian (Cyrillic).

YOU MUST provide ALL of the following sections with specific details. Do NOT leave any section empty or say "Unknown". Use typical specifications for this vehicle if exact data is unavailable.

Return JSON format:

{
  "brand": "${brand}",
  "model": "${model}",
  "year": "${year || 'Latest'}",
  "powertrain": "Подробное описание двигателя: тип (бензин/дизель/гибрид), объем, количество цилиндров, мощность в л.с., крутящий момент в Н·м, технологии впрыска",
  "transmission": "Тип коробки передач: механическая/автоматическая/вариатор/робот, количество передач, особенности",
  "dimensions": "Габариты: длина X мм, ширина X мм, высота X мм, колесная база X мм, дорожный просвет X мм, объем багажника X литров",
  "safety": "Системы безопасности (перечислить через точку с запятой):\n• Количество подушек безопасности;\n• ABS (антиблокировочная система);\n• EBD (электронное распределение тормозных усилий);\n• ESP (система стабилизации);\n• Помощь при экстренном торможении;\n• Система контроля давления в шинах;\n• Камеры и датчики парковки;\n• Другие функции безопасности",
  "comfort": "Системы комфорта (перечислить через точку с запятой):\n• Климат-контроль (одно/двух/трехзонный);\n• Электрорегулировка сидений;\n• Подогрев и вентиляция сидений;\n• Электропривод багажника;\n• Бесключевой доступ;\n• Панорамная крыша;\n• Ambient освещение;\n• Другие функции комфорта",
  "entertainment": "Мультимедиа и связь (перечислить через точку с запятой):\n• Размер сенсорного экрана (дюймы);\n• Навигационная система;\n• Bluetooth и беспроводная зарядка;\n• Apple CarPlay / Android Auto;\n• Аудиосистема (количество динамиков, бренд);\n• USB-порты и розетки;\n• Голосовое управление;\n• Другие функции",
  "adas": "Системы помощи водителю (перечислить через точку с запятой):\n• Адаптивный круиз-контроль;\n• Автоматическое экстренное торможение;\n• Система удержания в полосе;\n• Мониторинг слепых зон;\n• Распознавание дорожных знаков;\n• Система помощи при парковке;\n• Камера 360 градусов;\n• Другие функции ADAS",
  "fuel": "Расход топлива и характеристики:\n• Городской цикл: X л/100км;\n• Загородный цикл: X л/100км;\n• Смешанный цикл: X л/100км;\n• Объем топливного бака: X литров;\n• Экологический класс: Euro X"
}

IMPORTANT: Provide realistic and detailed specifications. Each section MUST have multiple items. Return only valid JSON.`;

    const requestBody = {
      model: process.env.OPENAI_VISION_MODEL || 'gpt-5.5-openai-compact',
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 3000,
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

    // 如果配置了代理，使用代理
    if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    const apiUrl = `${process.env.OPENAI_API_BASE || 'https://9527code.com/v1'}/chat/completions`;

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const result = await response.json();
    const responseText = result.choices[0].message.content;

    console.log('🔍 搜索响应:', responseText.substring(0, 200));

    // 解析 JSON 响应
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('响应中未找到有效的 JSON 格式');
    }

    const configData = JSON.parse(jsonMatch[0]);

    return res.json({
      success: true,
      data: configData
    });

  } catch (error) {
    console.error('搜索配置失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
