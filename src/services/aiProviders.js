import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 统一 AI Provider 层
 * - Claude（Anthropic SDK，走第三方 9527code.com）：中间档 / 高端档
 * - DeepSeek（官方 OpenAI 兼容接口）：翻译等高频便宜档
 *
 * 模型分级由 .env 控制，改档位只改环境变量、不动业务代码。
 */

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const claudeAgent = proxyUrl && proxyUrl.trim() !== '' ? new HttpsProxyAgent(proxyUrl) : undefined;

// ---- Claude 客户端（复用现有稳定配置）----
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
  ...(claudeAgent ? { httpAgent: claudeAgent } : {}),
  defaultHeaders: { 'anthropic-version': '2023-06-01' },
});

// ---- 模型分级常量 ----
export const MODELS = {
  MID: process.env.AI_MODEL_MID || 'claude-sonnet-5',
  PREMIUM: process.env.AI_MODEL_PREMIUM || 'claude-opus-4-8',
  CHEAP: process.env.AI_MODEL_CHEAP || 'claude-haiku-4-5',
};

/**
 * 调用 Claude（Anthropic messages 接口）
 * @param {Object} opts - { model, system, messages, max_tokens, temperature }
 * @returns {Promise<string>} 文本内容
 */
export async function callClaude({ model, system, messages, max_tokens = 1024, temperature }) {
  const resp = await anthropic.messages.create({
    model,
    max_tokens,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(system ? { system } : {}),
    messages,
  });
  const text = resp.content?.[0]?.text?.trim();
  if (!text) throw new Error('Claude 返回空内容');
  return text;
}

/**
 * 调用 DeepSeek（官方 OpenAI 兼容 /chat/completions）
 * 独立 key / base_url / 代理开关，与 9527code.com 完全解耦。
 * @param {Object} opts - { system, prompt, max_tokens, temperature }
 * @returns {Promise<string>} 文本内容
 */
export async function callDeepSeek({ system, prompt, max_tokens = 1024, temperature = 0.3 }) {
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages,
      max_tokens,
      temperature,
      stream: false,
    }),
  };

  // DeepSeek 官方接口国内通常可直连；仅当显式开启时才走代理
  if (String(process.env.DEEPSEEK_USE_PROXY).toLowerCase() === 'true' && proxyUrl) {
    fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
  }

  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DeepSeek 请求失败: ${res.status} ${res.statusText} ${errText.slice(0, 200)}`);
  }
  const result = await res.json();
  const content = result.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('DeepSeek 返回空内容');
  return content;
}
