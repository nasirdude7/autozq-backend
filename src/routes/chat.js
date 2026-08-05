import express from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Customer from '../models/Customer.js';
import AIAssistantService from '../services/AIAssistantService.js';

const router = express.Router();

/**
 * 获取会话列表
 * GET /api/sales/chat/conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const {
      assigned_to,
      status,
      platform,
      unread_only,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      assigned_to,
      status,
      platform,
      unread_only: unread_only === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const conversations = await Conversation.findAll(filters);
    const total = await Conversation.count(filters);

    res.json({
      success: true,
      data: conversations,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + conversations.length < total
      }
    });
  } catch (error) {
    console.error('获取会话列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建或获取会话
 * POST /api/sales/chat/conversations
 */
router.post('/conversations', async (req, res) => {
  try {
    const { customer_id, platform = 'whatsapp', assigned_to } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: '客户ID是必填项'
      });
    }

    // 检查客户是否存在
    const customer = await Customer.findById(customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: '客户不存在'
      });
    }

    // 获取或创建会话
    const conversation = await Conversation.getOrCreate(
      customer_id,
      platform,
      assigned_to || customer.assigned_to
    );

    res.json({
      success: true,
      data: conversation,
      message: '会话创建成功'
    });
  } catch (error) {
    console.error('创建会话错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取会话详情
 * GET /api/sales/chat/conversations/:id
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('获取会话详情错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取会话消息
 * GET /api/sales/chat/conversations/:id/messages
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, since, until } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      since,
      until,
      order: 'asc'
    };

    const messages = await Message.findByConversationId(id, options);
    const total = await Message.count({ conversation_id: id });

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + messages.length < total
      }
    });
  } catch (error) {
    console.error('获取消息列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送消息
 * POST /api/sales/chat/conversations/:id/messages
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      content,
      sender_type = 'agent',
      sender_id,
      message_type = 'text',
      attachments,
      auto_translate = false
    } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
    }

    // 检查会话是否存在
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }

    let translatedContent = null;
    let targetLanguage = null;

    // 如果需要自动翻译
    if (auto_translate && conversation.customer_language) {
      const translateResult = await AIAssistantService.translate(
        content,
        conversation.customer_language
      );

      if (translateResult.success) {
        translatedContent = translateResult.translated;
        targetLanguage = conversation.customer_language;
      }
    }

    // 创建消息
    const message = await Message.create({
      conversation_id: id,
      sender_type,
      sender_id,
      content,
      translated_content: translatedContent,
      target_language: targetLanguage,
      message_type,
      attachments
    });

    // 更新会话最后消息时间
    await Conversation.updateLastMessageTime(id);

    // 如果是客户消息，增加未读计数
    if (sender_type === 'customer') {
      await Conversation.incrementUnread(id);
    }

    res.status(201).json({
      success: true,
      data: message,
      message: '消息发送成功'
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 标记会话为已读
 * POST /api/sales/chat/conversations/:id/read
 */
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    // 标记会话消息为已读
    await Message.markConversationAsRead(id);

    // 重置会话未读计数
    const conversation = await Conversation.markAsRead(id);

    res.json({
      success: true,
      data: conversation,
      message: '已标记为已读'
    });
  } catch (error) {
    console.error('标记已读错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 关闭会话
 * POST /api/sales/chat/conversations/:id/close
 */
router.post('/conversations/:id/close', async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.close(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }

    res.json({
      success: true,
      data: conversation,
      message: '会话已关闭'
    });
  } catch (error) {
    console.error('关闭会话错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 翻译消息
 * POST /api/sales/chat/translate
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, target_language, source_language = 'auto' } = req.body;

    if (!text || !target_language) {
      return res.status(400).json({
        success: false,
        error: '文本和目标语言是必填项'
      });
    }

    const result = await AIAssistantService.translate(
      text,
      target_language,
      source_language
    );

    res.json(result);
  } catch (error) {
    console.error('翻译错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取AI回复建议
 * POST /api/sales/chat/suggest-replies
 */
router.post('/suggest-replies', async (req, res) => {
  try {
    const { conversation_id, customer_profile, context } = req.body;

    if (!conversation_id) {
      return res.status(400).json({
        success: false,
        error: '会话ID是必填项'
      });
    }

    // 获取会话历史
    const messages = await Message.findByConversationId(conversation_id, {
      limit: 20,
      order: 'asc'
    });

    // 生成回复建议
    const result = await AIAssistantService.suggestReplies(
      messages,
      customer_profile || {},
      context || {}
    );

    res.json(result);
  } catch (error) {
    console.error('生成回复建议错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 分析客户意图
 * POST /api/sales/chat/analyze-intent
 */
router.post('/analyze-intent', async (req, res) => {
  try {
    const { message, conversation_id } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息内容是必填项'
      });
    }

    let conversationHistory = [];
    if (conversation_id) {
      conversationHistory = await Message.findByConversationId(conversation_id, {
        limit: 10,
        order: 'desc'
      });
    }

    const result = await AIAssistantService.analyzeIntent(
      message,
      conversationHistory
    );

    res.json(result);
  } catch (error) {
    console.error('意图分析错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 搜索消息
 * GET /api/sales/chat/search
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      customer_id,
      sender_type,
      date_from,
      date_to
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: '请提供搜索关键词'
      });
    }

    const messages = await Message.search(q, {
      customer_id,
      sender_type,
      date_from,
      date_to
    });

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('搜索消息错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
