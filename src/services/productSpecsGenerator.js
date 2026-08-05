import { callClaude, MODELS } from './aiProviders.js';

/**
 * AI 补全产品配置（产品规格生成）
 * 模型：Sonnet（中等复杂度，平衡质量与成本）
 * @param {Object} params - { brand, model, year, variant, category }
 * @returns {Promise<Object>} 配置参数 JSON
 */
export async function generateProductSpecs(params) {
  const { brand, model, year, variant, category } = params;

  const vehicleDesc = `${brand} ${model} ${year || ''} ${variant || ''}`.trim();
  const categoryHint = category ? `(category: ${category})` : '';

  const prompt = `You are an automotive specifications expert. Generate detailed technical specifications for this vehicle:

**Vehicle**: ${vehicleDesc} ${categoryHint}

Return ONLY a valid JSON object with these fields (use empty string if unknown, DO NOT fabricate data you're uncertain about):

{
  "engine": "Engine type and displacement (e.g., 2.5L Inline-4, 3.0L V6 Turbo, Dual Motor Electric)",
  "transmission": "Transmission type (e.g., 8-Speed Automatic, CVT, Single-Speed)",
  "horsepower": "Power output (e.g., 203 hp, 150 kW)",
  "torque": "Torque (e.g., 184 lb-ft, 250 Nm)",
  "fuel_type": "Fuel type (Gasoline, Diesel, Electric, Hybrid, Plug-in Hybrid)",
  "drive_type": "Drive configuration (FWD, RWD, AWD, 4WD)",
  "seats": "Number of seats (integer)",
  "fuel_economy": "Fuel economy or range (e.g., 28 city / 39 highway mpg, 650 km range)",
  "acceleration": "0-100 km/h time if performance vehicle (e.g., 6.5s)",
  "battery": "Battery capacity for EVs (e.g., 82.5 kWh)",
  "range_km": "Electric range in km for EVs/PHEVs (integer)",
  "towing_capacity": "Towing capacity for trucks/SUVs (e.g., 13,200 lbs)",
  "payload": "Payload capacity for trucks (e.g., 3,325 lbs)",
  "safety": "Key safety features (e.g., 8 airbags, Toyota Safety Sense)",
  "features": "Notable features (e.g., Panoramic Sunroof, 360 Camera, Adaptive Cruise)"
}

**IMPORTANT**:
- Return ONLY the JSON object, no markdown code fences, no extra text
- Use real specs from your knowledge of this vehicle model
- If you don't know a specific value, use empty string ""
- Do not fabricate specs you're uncertain about`;

  try {
    const responseText = await callClaude({
      model: MODELS.MID, // Sonnet（中等复杂度，平衡质量与成本）
      max_tokens: 2048,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    console.log('🤖 AI 生成配置原始响应:', responseText);

    // 提取 JSON（可能包裹在 markdown 代码块中）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 响应中未找到有效的 JSON 格式');
    }

    const specs = JSON.parse(jsonMatch[0]);

    // 清理空字符串字段（前端渲染时更干净）
    const cleanedSpecs = {};
    for (const [key, value] of Object.entries(specs)) {
      if (value && value !== '') {
        cleanedSpecs[key] = value;
      }
    }

    return cleanedSpecs;

  } catch (error) {
    console.error('AI 补全配置失败:', error);
    throw new Error(`AI 补全失败: ${error.message}`);
  }
}
