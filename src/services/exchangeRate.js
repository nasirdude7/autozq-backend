import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 获取俄罗斯央行（ЦБ РФ）官方汇率
 * API: https://www.cbr-xml-daily.ru/daily_json.js
 * 返回人民币(CNY)对卢布(RUB)的汇率
 */
export async function getExchangeRate() {
  try {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const fetchOptions = {};
    if (proxyUrl) {
      fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    // 俄罗斯央行官方汇率API（JSON格式）
    const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', fetchOptions);

    if (!response.ok) {
      throw new Error(`汇率API请求失败: ${response.status}`);
    }

    const data = await response.json();

    // CNY: 人民币，Value是1单位外币对应的卢布
    // 注意：CBR返回的是 Nominal 个外币 = Value 卢布
    const cny = data.Valute.CNY;
    const cnyToRub = cny.Value / cny.Nominal; // 1人民币 = X卢布

    // 汇率日期
    const date = data.Date; // ISO格式

    return {
      success: true,
      cnyToRub: cnyToRub,
      date: date,
      source: 'ЦБ РФ (Центральный банк России)',
      raw: {
        nominal: cny.Nominal,
        value: cny.Value,
        name: cny.Name
      }
    };
  } catch (error) {
    console.error('获取汇率失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 将人民币价格转换为卢布
 * @param {number} cnyAmount - 人民币金额
 * @param {number} rate - 汇率（1人民币=X卢布）
 * @returns {number} 卢布金额
 */
export function convertToRub(cnyAmount, rate) {
  return Math.round(cnyAmount * rate);
}
