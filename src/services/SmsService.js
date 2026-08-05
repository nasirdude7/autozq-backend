/**
 * 短信发送服务（可插拔）
 *
 * 设计目标：现在用桩(stub)就能跑通完整登录流程，以后接真实短信商只改一个分支。
 * 通过环境变量 SMS_PROVIDER 切换：
 *   - none   ：默认。不真正发短信，打印到日志；开发环境把验证码回传给前端方便测试。
 *   - smsru  ：sms.ru（俄罗斯常用，预留接口，填 API_ID 即可启用）
 *   - twilio ：Twilio（国际，预留接口）
 *
 * 接真实短信商时，只需实现对应分支里的 fetch 调用，其余流程无需改动。
 */

const PROVIDER = (process.env.SMS_PROVIDER || 'none').toLowerCase();
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * 发送验证码短信
 * @param {string} phone - 目标手机号（含国家码，如 +79991234567）
 * @param {string} code  - 验证码
 * @param {string} lang  - 客户语言（ru/en/zh），用于短信文案
 * @returns {Promise<{success:boolean, provider:string, devCode?:string, error?:string}>}
 */
export async function sendCode(phone, code, lang = 'ru') {
  const text = buildMessage(code, lang);

  try {
    switch (PROVIDER) {
      case 'smsru':
        return await sendViaSmsRu(phone, text, code);

      case 'twilio':
        return await sendViaTwilio(phone, text, code);

      case 'none':
      default:
        // 桩：不真正发送，仅记录日志。开发环境把验证码回传，方便本地/团队测试。
        console.log(`📱 [SMS-STUB] 向 ${phone} 发送验证码: ${code}（未接真实短信商，SMS_PROVIDER=none）`);
        return {
          success: true,
          provider: 'none',
          // 仅非生产环境暴露验证码；生产即使是桩也不回传，避免泄露
          devCode: IS_PROD ? undefined : code
        };
    }
  } catch (error) {
    console.error('❌ 短信发送失败:', error);
    return { success: false, provider: PROVIDER, error: error.message };
  }
}

/**
 * 构造验证码文案（多语言）
 */
function buildMessage(code, lang) {
  const templates = {
    zh: `【AutoZQ】您的验证码是 ${code}，5分钟内有效，请勿泄露。`,
    en: `[AutoZQ] Your verification code is ${code}. Valid for 5 minutes.`,
    ru: `[AutoZQ] Ваш код подтверждения: ${code}. Действителен 5 минут.`
  };
  return templates[lang] || templates.ru;
}

/**
 * sms.ru 实现（预留）：设置 SMS_PROVIDER=smsru 和 SMSRU_API_ID 后生效
 * 文档：https://sms.ru/api/send
 */
async function sendViaSmsRu(phone, text, code) {
  const apiId = process.env.SMSRU_API_ID;
  if (!apiId) throw new Error('SMSRU_API_ID 未配置');

  const url = new URL('https://sms.ru/sms/send');
  url.searchParams.set('api_id', apiId);
  url.searchParams.set('to', phone.replace(/[^\d]/g, ''));
  url.searchParams.set('msg', text);
  url.searchParams.set('json', '1');

  const resp = await fetch(url, { method: 'POST' });
  const data = await resp.json();

  if (data.status !== 'OK') {
    throw new Error(`sms.ru 错误: ${data.status_text || JSON.stringify(data)}`);
  }
  return { success: true, provider: 'smsru' };
}

/**
 * Twilio 实现（预留）：设置 SMS_PROVIDER=twilio 及 TWILIO_* 后生效
 */
async function sendViaTwilio(phone, text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error('TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM 未配置');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: from, Body: text });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Twilio 错误 ${resp.status}: ${errText}`);
  }
  return { success: true, provider: 'twilio' };
}

export default { sendCode };
