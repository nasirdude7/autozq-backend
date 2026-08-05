import express from 'express';
import { query } from '../db/salesPool.js';
import { translateText } from '../services/translator.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { sendToSalesMartly } from './webhook.js';
import { chatUpload } from '../middleware/upload.js';

const router = express.Router();

// 公网可访问的基础地址（图片/文件链接给 SalesMartly 用，localhost 不可用）
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

/**
 * 发送消息给客户（通过 SalesMartly）
 * POST /api/messages/send
 */
router.post('/send', async (req, res) => {
  try {
    const {
      customer_id,
      content = '',
      message_type = 'text',
      attachments = null,   // { url, filename, mime, size } — 图片/文件时必填
      auto_translate = false
    } = req.body;
    const staff_id = req.user.id;

    // 文本消息必须有内容；图片/文件必须有 attachments.url
    if (!customer_id) {
      return res.status(400).json({ success: false, error: '缺少 customer_id' });
    }
    if (message_type === 'text' && !content) {
      return res.status(400).json({ success: false, error: '文本消息内容不能为空' });
    }
    if ((message_type === 'image' || message_type === 'file') && !(attachments && attachments.url)) {
      return res.status(400).json({ success: false, error: '图片/文件消息缺少 attachments.url' });
    }

    // 获取客户信息
    const customerResult = await query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '客户不存在' });
    }
    const customer = customerResult.rows[0];

    // 解析平台并获取/创建会话（含 metadata 路由参数）
    const platform = customer.source === 'telegram' ? 'telegram'
      : customer.source === 'wechat' ? 'wechat'
      : customer.source === 'web' ? 'web' : 'whatsapp';
    // 注意：不要把 staff_id 传给 assigned_to —— conversations.assigned_to 外键指向旧的营销 users 表，
    // 而 staff_id 来自 staff_users 表，会违反外键约束。会话归属由 customer_assignments 表管理，
    // 发送者身份记录在 messages.sender_id（无外键约束，安全）。
    const conversation = await Conversation.getOrCreate(customer_id, platform, null);
    const routing = conversation.metadata || {};

    // 文本翻译（仅文本消息；图片/文件的 content 作为说明文字也可翻译）
    let finalContent = content;
    let translatedContent = null;
    let targetLanguage = null;
    if (auto_translate && content) {
      let targetLang = 'English';
      if (platform === 'whatsapp' || customer.language === 'ru') targetLang = 'Russian';
      else if (customer.language === 'ar') targetLang = 'Arabic';
      finalContent = await translateText(content, targetLang);
      translatedContent = finalContent;
      targetLanguage = customer.language || null;
    }

    // 存库（正确 schema：sender_type='agent'）
    const message = await Message.create({
      conversation_id: conversation.id,
      sender_type: 'agent',
      sender_id: staff_id,
      content: message_type === 'text' ? finalContent : (finalContent || attachments.filename || ''),
      translated_content: translatedContent,
      target_language: targetLanguage,
      message_type,
      attachments
    });
    await Conversation.updateLastMessageTime(conversation.id);

    // 真正发送到 SalesMartly（无路由参数或发送失败时，消息已存库，标记未送达）
    let delivered = false;
    let deliveryError = null;
    try {
      if (!routing.chat_user_id && !customer.whatsapp_id) {
        throw new Error('该客户无 SalesMartly 路由信息（可能尚未通过 webhook 进线），消息仅存档未发送');
      }
      const chatUserId = routing.chat_user_id || customer.whatsapp_id;
      const items = [];
      if (message_type === 'image') {
        items.push({ msg_type: 'image', url: attachments.url });
        if (finalContent) items.push({ msg_type: 'text', text: finalContent });
      } else if (message_type === 'file') {
        items.push({ msg_type: 'file', url: attachments.url, filename: attachments.filename });
        if (finalContent) items.push({ msg_type: 'text', text: finalContent });
      } else {
        items.push({ msg_type: 'text', text: finalContent });
      }
      await sendToSalesMartly({ project_id: routing.project_id, chat_user_id: chatUserId }, items);
      delivered = true;
    } catch (sendErr) {
      deliveryError = sendErr.message;
      console.error('⚠️ SalesMartly 发送失败（消息已存库）:', sendErr.message);
    }

    res.json({
      success: true,
      data: { message, delivered, delivery_error: deliveryError }
    });

  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 上传聊天附件（图片/文档），返回公网可访问的 URL
 * POST /api/messages/upload  (multipart/form-data, field: file)
 */
router.post('/upload', chatUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未收到文件' });
    }
    if (!PUBLIC_BASE_URL) {
      console.warn('⚠️ PUBLIC_BASE_URL 未配置，返回相对路径，SalesMartly 可能无法访问图片');
    }
    const relPath = `/uploads/${req.file.filename}`;
    const url = PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${relPath}` : relPath;
    const isImage = req.file.mimetype.startsWith('image/');

    res.json({
      success: true,
      data: {
        url,
        filename: req.file.originalname,
        mime: req.file.mimetype,
        size: req.file.size,
        message_type: isImage ? 'image' : 'file'
      }
    });
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 翻译消息
 * POST /api/messages/translate
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, target_lang = 'Chinese' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: '缺少待翻译文本'
      });
    }

    const translated = await translateText(text, target_lang);

    res.json({
      success: true,
      data: {
        original: text,
        translated: translated,
        target_lang
      }
    });

  } catch (error) {
    console.error('翻译失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量翻译会话消息
 * POST /api/messages/translate-conversation
 */
router.post('/translate-conversation', async (req, res) => {
  try {
    const { conversation_id, target_lang = 'Chinese' } = req.body;

    if (!conversation_id) {
      return res.status(400).json({
        success: false,
        error: '缺少会话ID'
      });
    }

    // 获取会话所有消息
    const messagesResult = await query(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversation_id]
    );

    const messages = messagesResult.rows;

    // 翻译所有入站消息（客户发来的消息）
    const translatedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (msg.direction === 'inbound' && msg.content) {
          const translated = await translateText(msg.content, target_lang);
          return {
            ...msg,
            translated_content: translated
          };
        }
        return msg;
      })
    );

    res.json({
      success: true,
      data: translatedMessages
    });

  } catch (error) {
    console.error('批量翻译失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
