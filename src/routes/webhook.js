import express from 'express';
import crypto from 'crypto';
import AIAssistantService from '../services/AIAssistantService.js';
import Customer from '../models/Customer.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Assignment from '../models/Assignment.js';

const router = express.Router();

/**
 * SalesMartly Webhook 接收端点
 * 接收来自 SalesMartly 的消息推送
 */
router.post('/salesmartly/receive', async (req, res) => {
  try {
    console.log('📨 收到 SalesMartly Webhook 消息:', JSON.stringify(req.body, null, 2));

    // 1. 验证签名（如果 SalesMartly 提供签名验证）
    const signature = req.headers['x-salesmartly-signature'];
    if (signature && !verifySignature(req, signature)) {
      console.error('❌ 签名验证失败');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // 2. 解析 SalesMartly 真实数据格式
    const {
      event_type,           // 事件类型（new_message 等）
      project_id,           // 项目ID（回复时必须原样带回）
      chat_user_id,         // 客户唯一ID
      channel,              // 渠道编号（12 = WhatsApp）
      session_id,           // 会话ID
      chat_user_info,       // 客户详细信息
      msg_list              // 消息列表
    } = req.body;

    // 只处理新消息事件
    if (event_type && event_type !== 'new_message') {
      console.log(`ℹ️ 忽略非消息事件: ${event_type}`);
      return res.json({ success: true, message: `Ignored event: ${event_type}` });
    }

    // 校验必要字段
    if (!chat_user_id || !chat_user_info) {
      console.warn('⚠️ 缺少客户信息，忽略此消息');
      return res.json({ success: true, message: 'Missing customer info' });
    }

    // 渠道编号映射到平台名称
    const channelMap = { 12: 'whatsapp', 1: 'whatsapp', 2: 'telegram', 3: 'wechat' };
    const platform = channelMap[channel] || 'whatsapp';

    // 4. 创建或更新客户
    console.log('🔍 查找客户，chat_user_id:', chat_user_id);
    let dbCustomer = await Customer.findByWhatsAppId(chat_user_id);

    if (!dbCustomer) {
      console.log('📝 创建新客户...');
      dbCustomer = await Customer.create({
        name: chat_user_info.name || chat_user_info.phone || chat_user_id,
        phone: chat_user_info.phone || null,
        whatsapp_id: chat_user_id,
        country: chat_user_info.country || null,
        language: chat_user_info.translateLanguage || 'en',
        source: platform,
        status: 'active'
      });
      console.log('✅ 创建新客户成功，UUID:', dbCustomer.id, '姓名:', dbCustomer.name);

      // 自动分配：新客户实时派给负载最低的坐席（无可用坐席则保持未分配）
      try {
        const assignment = await Assignment.autoAssign(dbCustomer.id, null);
        if (assignment) {
          console.log('🤖 自动分配成功，坐席:', assignment.assigned_to);
        } else {
          console.log('⚠️ 无可用坐席，客户保持未分配');
        }
      } catch (assignErr) {
        console.error('⚠️ 自动分配失败（不影响客户创建）:', assignErr.message);
      }
    } else {
      console.log('✅ 找到已存在客户，UUID:', dbCustomer.id);
    }

    // 5. 创建或获取会话
    let dbConversation = await Conversation.findByCustomerId(dbCustomer.id, platform);

    if (!dbConversation || dbConversation.status === 'closed') {
      dbConversation = await Conversation.create({
        customer_id: dbCustomer.id,
        platform: platform,
        status: 'active'
      });
      console.log('✅ 创建新会话:', dbConversation.id);
    }

    // 5.1 持久化 SalesMartly 路由参数到会话 metadata（坐席事后手动发消息时需要，最新覆盖）
    try {
      await Conversation.updateMetadata(dbConversation.id, {
        project_id,
        channel,
        channel_id: chat_user_info.channelId,
        session_id
      });
    } catch (metaErr) {
      console.error('⚠️ 保存路由参数失败（不影响消息接收）:', metaErr.message);
    }

    // 6. 保存消息列表中的所有消息
    const savedMessages = [];
    const messages = Array.isArray(msg_list) ? msg_list : [];

    for (const item of messages) {
      // 提取消息文本内容
      const content = item.msg?.text || item.msg?.content || JSON.stringify(item.msg) || '';
      const msgType = item.msg_type || 'text';

      const dbMessage = await Message.create({
        conversation_id: dbConversation.id,
        content: content,
        sender_type: 'customer',
        sender_id: null,  // 客户消息不需要 sender_id
        platform: platform,
        metadata: {
          external_message_id: item.sequence_id,
          session_id: session_id,
          message_type: msgType,
          whatsapp_customer_id: chat_user_id
        }
      });
      savedMessages.push(dbMessage.id);
      console.log('✅ 保存客户消息:', dbMessage.id, '内容:', content.substring(0, 30));
    }

    // 7. 立即返回 200（AI 生成较慢，避免 SalesMartly Webhook 超时）
    res.json({
      success: true,
      customer_id: dbCustomer.id,
      conversation_id: dbConversation.id,
      saved_messages: savedMessages.length,
      message: '消息已接收'
    });

    // 8. AI 自动回复功能已关闭（需要时通过环境变量 ENABLE_AUTO_REPLY=true 启用）
    if (process.env.ENABLE_AUTO_REPLY === 'true') {
      handleAutoReply({
        conversation: dbConversation,
        customer: dbCustomer,
        chat_user_id,
        project_id,
        channel,
        session_id,
        channel_id: chat_user_info.channelId
      }).catch(err => console.error('❌ 自动回复流程出错:', err));
    }

  } catch (error) {
    console.error('❌ Webhook 处理失败:', error);
    console.error('完整错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 异步处理自动回复：读取会话历史 → 生成 AI 回复 → 存库 → 发送到 SalesMartly
 */
async function handleAutoReply({ conversation, customer, chat_user_id, project_id, channel, session_id, channel_id }) {
  try {
    // 1. 读取最近的会话历史（用于给 AI 上下文）
    const history = await Message.findByConversationId(conversation.id, { limit: 10 });
    // findByConversationId 默认按时间倒序，转成正序供 AI 阅读
    const orderedHistory = Array.isArray(history) ? [...history].reverse() : [];

    // 2. 生成 AI 回复
    console.log('🤖 生成 AI 回复中...');
    const result = await AIAssistantService.generateReply(orderedHistory, {
      name: customer.name,
      country: customer.country,
      language: customer.language
    });

    if (!result.success || !result.reply) {
      console.error('❌ AI 回复生成失败:', result.error);
      return;
    }

    console.log('✅ AI 回复已生成:', result.reply.substring(0, 60));

    // 3. 保存 AI 回复到数据库
    await Message.create({
      conversation_id: conversation.id,
      content: result.reply,
      sender_type: 'agent',
      sender_id: null,
      platform: conversation.platform,
      metadata: {
        ai_generated: true,
        model: result.model,
        session_id
      }
    });

    // 4. 发送到 SalesMartly
    await sendReplyToSalesMartly({
      project_id,
      chat_user_id,
      channel,
      channel_id,
      session_id,
      text: result.reply
    });

  } catch (error) {
    console.error('❌ handleAutoReply 出错:', error);
  }
}

/**
 * 发送消息到 SalesMartly Webhook AI 员工回复接口
 * 官方文档: Webhook AI 员工 — 消息推送与回写对接文档 v1 (2026-05-21)
 * 认证: Authorization: Bearer <AccessToken>
 *
 * 关键格式：Webhook AI 员工使用 msg_list 数组 + sys_user_id + request_id（幂等）
 */
/**
 * 把 msg_list 中每条消息转换成 SalesMartly 要求的 { msg_type, msg } 结构。
 *
 * ⚠️ 图片/文件的字段格式来自 SalesMartly Apifox 接口文档（需登录查看）。
 *    这里按最通用的格式实现：image 用 { url }，file 用 { url, filename }。
 *    若实测不符，只需改这一个函数即可。
 */
function buildSalesMartlyMsg(item) {
  const type = item.msg_type || 'text';
  switch (type) {
    case 'image':
      return { msg_type: 'image', msg: { url: item.url } };
    case 'file':
      return { msg_type: 'file', msg: { url: item.url, filename: item.filename || 'file' } };
    case 'text':
    default:
      return { msg_type: 'text', msg: { text: item.text } };
  }
}

/**
 * SalesMartly Webhook AI 员工回写核心发送函数
 * 官方文档: Webhook AI 员工 — 消息推送与回写对接文档 v1 (2026-05-21)
 * 认证: Authorization: Bearer <AccessToken>
 *
 * @param {object} routing - 路由参数 { project_id, chat_user_id }（来自 conversation.metadata 或 webhook）
 * @param {Array}  items   - 消息数组，每项 { msg_type, text|url|filename }
 */
export async function sendToSalesMartly(routing, items) {
  const SALESMARTLY_API_URL = process.env.SALESMARTLY_REPLY_URL ||
    'https://msg.salesmartly.com/ai-employee/send-message';

  const SALESMARTLY_ACCESS_TOKEN = process.env.SALESMARTLY_ACCESS_TOKEN;

  if (!SALESMARTLY_ACCESS_TOKEN) {
    throw new Error('SALESMARTLY_ACCESS_TOKEN 未配置');
  }
  if (!routing || !routing.chat_user_id) {
    throw new Error('缺少 chat_user_id（路由参数未持久化？该客户可能尚未通过 webhook 进线）');
  }

  // project_id 兜底：老客户会话没持久化 metadata（在 updateMetadata 上线前进线），
  // 但本账号只有一个项目，用 SALESMARTLY_PROJECT_ID 兜底，保证坐席能给老客户发消息。
  const projectId = routing.project_id || parseInt(process.env.SALESMARTLY_PROJECT_ID || '0') || undefined;

  const body = {
    sys_user_id: parseInt(process.env.SALESMARTLY_ROBOT_ID || '0'),
    project_id: projectId,
    chat_user_id: routing.chat_user_id,
    request_id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,  // 幂等ID（5分钟内去重）
    msg_list: items.map(buildSalesMartlyMsg)
  };

  console.log('📤 发送消息到 SalesMartly:', JSON.stringify(body));

  const response = await fetch(SALESMARTLY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SALESMARTLY_ACCESS_TOKEN}`
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  console.log(`📬 SalesMartly 回复接口响应 [${response.status}]:`, responseText);

  if (!response.ok) {
    throw new Error(`SalesMartly API 错误 ${response.status}: ${responseText}`);
  }

  // SalesMartly 即使 HTTP 200 也可能业务失败：body.code!==0 表示失败（如 code:3 参数错误）
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
  if (parsed && typeof parsed.code !== 'undefined' && parsed.code !== 0) {
    throw new Error(`SalesMartly 业务错误 code=${parsed.code}: ${parsed.msg || responseText}`);
  }
  return parsed;
}

/**
 * 兼容旧调用：发送纯文本回复（AI 自动回复使用）
 */
export async function sendReplyToSalesMartly(data) {
  return sendToSalesMartly(
    { project_id: data.project_id, chat_user_id: data.chat_user_id },
    [{ msg_type: 'text', text: data.text }]
  );
}

/**
 * 验证 SalesMartly 签名
 *
 * 关键：对“发送方实际签名的原始请求字节”(req.rawBody) 做 HMAC-SHA256，
 * 而不是对 JSON.parse→JSON.stringify 往返后的结果。因为：
 *   - 键顺序、空白、以及非 ASCII 字符的转义方式（如西里尔文可能被转成 \uXXXX）
 *     在往返后会与原始字节不一致，导致合法签名被误判为无效。
 *   - autozq.ru 面向俄语市场，客户消息几乎必然含西里尔文，这个坑必须避开。
 * 回退：若拿不到 rawBody（异常情况），才退回到 stringify（尽力而为）。
 * 使用 timingSafeEqual 做定时安全比较，避免时序侧信道。
 */
function verifySignature(req, signature) {
  const secret = process.env.SALESMARTLY_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('⚠️ SALESMARTLY_WEBHOOK_SECRET 未配置，跳过签名验证');
    return true;
  }

  const payload = (typeof req.rawBody === 'string' && req.rawBody.length)
    ? req.rawBody
    : JSON.stringify(req.body);

  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // 长度不等时 timingSafeEqual 会抛错，先做长度判断
  const a = Buffer.from(computedSignature, 'utf8');
  const b = Buffer.from(String(signature || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Webhook 健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AutoZQ Webhook Service',
    timestamp: new Date().toISOString()
  });
});

/**
 * 测试端点 - 用于本地测试
 */
router.post('/test', async (req, res) => {
  console.log('🧪 测试消息:', req.body);

  res.json({
    success: true,
    message: 'Test webhook received',
    received_data: req.body
  });
});

export default router;
