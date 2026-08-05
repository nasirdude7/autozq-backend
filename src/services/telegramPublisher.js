import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 发送纯文本消息到Telegram频道
 * @param {string} text - 消息文本（支持HTML格式）
 * @returns {Promise<object>} 发送结果
 */
export async function sendMessage(text) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error('Telegram配置未完成，请在.env中设置TELEGRAM_BOT_TOKEN和TELEGRAM_CHANNEL_ID');
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: CHANNEL_ID,
      text: text,
      parse_mode: 'HTML'
    }),
    timeout: 30000
  };

  if (PROXY_URL) {
    requestOptions.agent = new HttpsProxyAgent(PROXY_URL, {
      keepAlive: true,
      timeout: 30000
    });
  }

  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API错误: ${result.description || '未知错误'}`);
    }

    console.log('✅ 消息已发送到Telegram频道');
    return result;
  } catch (error) {
    console.error('❌ 发送Telegram消息失败:', error.message);
    throw error;
  }
}

/**
 * 发送图片消息到Telegram频道
 * @param {string} imagePath - 图片文件路径
 * @param {string} caption - 图片说明文字（可选，支持HTML格式）
 * @returns {Promise<object>} 发送结果
 */
export async function sendPhoto(imagePath, caption = '') {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error('Telegram配置未完成，请在.env中设置TELEGRAM_BOT_TOKEN和TELEGRAM_CHANNEL_ID');
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;

  const formData = new FormData();
  formData.append('chat_id', CHANNEL_ID);

  // 支持Buffer（base64图片）或文件路径
  if (Buffer.isBuffer(imagePath)) {
    formData.append('photo', imagePath, { filename: 'photo.jpg', contentType: 'image/jpeg' });
  } else {
    formData.append('photo', fs.createReadStream(imagePath));
  }

  if (caption) {
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
  }

  const requestOptions = {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
    timeout: 120000
  };

  if (PROXY_URL) {
    requestOptions.agent = new HttpsProxyAgent(PROXY_URL, {
      keepAlive: true,
      timeout: 120000
    });
  }

  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API错误: ${result.description || '未知错误'}`);
    }

    console.log('✅ 图片已发送到Telegram频道');
    return result;
  } catch (error) {
    console.error('❌ 发送Telegram图片失败:', error.message);
    throw error;
  }
}

/**
 * 发送图片组（媒体组）到Telegram频道
 * @param {Array<string>} imagePaths - 图片文件路径数组（最多10张）
 * @param {string} caption - 第一张图片的说明文字（可选）
 * @returns {Promise<object>} 发送结果
 */
export async function sendMediaGroup(imagePaths, caption = '') {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error('Telegram配置未完成，请在.env中设置TELEGRAM_BOT_TOKEN和TELEGRAM_CHANNEL_ID');
  }

  if (imagePaths.length > 10) {
    throw new Error('Telegram一次最多只能发送10张图片');
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`;

  const formData = new FormData();
  formData.append('chat_id', CHANNEL_ID);

  const media = imagePaths.map((imagePath, index) => {
    const attachName = `photo${index}`;

    // 支持Buffer（base64图片）或文件路径
    if (Buffer.isBuffer(imagePath)) {
      formData.append(attachName, imagePath, { filename: `photo${index}.jpg`, contentType: 'image/jpeg' });
    } else {
      formData.append(attachName, fs.createReadStream(imagePath));
    }

    const mediaItem = {
      type: 'photo',
      media: `attach://${attachName}`
    };

    // 第一张图片添加说明文字
    if (index === 0 && caption) {
      mediaItem.caption = caption;
      mediaItem.parse_mode = 'HTML';
    }

    return mediaItem;
  });

  formData.append('media', JSON.stringify(media));

  const requestOptions = {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
    timeout: 120000
  };

  if (PROXY_URL) {
    requestOptions.agent = new HttpsProxyAgent(PROXY_URL, {
      keepAlive: true,
      timeout: 120000
    });
  }

  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API错误: ${result.description || '未知错误'}`);
    }

    console.log(`✅ ${imagePaths.length}张图片已发送到Telegram频道`);
    return result;
  } catch (error) {
    console.error('❌ 发送Telegram媒体组失败:', error.message);
    throw error;
  }
}

/**
 * 格式化车辆信息为Telegram消息
 * @param {object} vehicleData - 车辆数据
 * @returns {string} 格式化后的HTML文本
 */
export function formatVehicleMessage(vehicleData) {
  const { brand, model, year, price, mileage, displacement, transmission, color, description } = vehicleData;

  let message = `<b>🚗 ${brand} ${model}</b>\n\n`;

  if (year) message += `📅 Год: ${year}\n`;
  if (price) message += `💰 Цена: ¥${price.toLocaleString()}\n`;
  if (mileage) message += `🛣 Пробег: ${mileage.toLocaleString()} км\n`;
  if (displacement) message += `⚙️ Объем: ${displacement}\n`;
  if (transmission) message += `🔧 КПП: ${transmission}\n`;
  if (color) message += `🎨 Цвет: ${color}\n`;

  // 添加卖家描述
  if (description && description.trim()) {
    message += `\n📝 Описание:\n${description.trim()}\n`;
  }

  message += `\n📞 Связаться: @autozqauto`;
  message += `\n🌐 Сайт: https://autozq.ru`;

  return message;
}

/**
 * 测试Telegram Bot连接
 * @returns {Promise<object>} Bot信息
 */
export async function testConnection() {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN未配置');
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;

  const requestOptions = {
    timeout: 30000
  };
  if (PROXY_URL) {
    requestOptions.agent = new HttpsProxyAgent(PROXY_URL, {
      keepAlive: true,
      timeout: 30000
    });
  }

  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(`Telegram API错误: ${result.description || '未知错误'}`);
    }

    console.log('✅ Telegram Bot连接成功:', result.result.username);
    return result.result;
  } catch (error) {
    console.error('❌ Telegram Bot连接失败:', error.message);
    throw error;
  }
}
