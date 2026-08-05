import { Server } from 'socket.io';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import AIAssistantService from '../services/AIAssistantService.js';

/**
 * Socket.IO 实时通信服务
 */
class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  /**
   * 初始化 Socket.IO
   * @param {Object} server - HTTP Server 实例
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.io.on('connection', (socket) => {
      console.log(`✅ Socket 连接: ${socket.id}`);

      // 用户认证并加入房间
      socket.on('authenticate', async (data) => {
        const { userId, role } = data;
        socket.userId = userId;
        socket.role = role;

        // 记录连接
        this.connectedUsers.set(userId, socket.id);

        // 加入用户专属房间
        socket.join(`user:${userId}`);

        console.log(`👤 用户认证成功: ${userId} (${role})`);

        // 发送在线状态
        this.broadcastUserStatus(userId, 'online');

        // 返回认证成功
        socket.emit('authenticated', {
          success: true,
          userId,
          socketId: socket.id
        });
      });

      // 加入会话房间
      socket.on('join_conversation', async (data) => {
        const { conversationId } = data;

        if (!conversationId) {
          socket.emit('error', { message: '会话ID不能为空' });
          return;
        }

        // 加入会话房间
        socket.join(`conversation:${conversationId}`);

        console.log(`💬 加入会话: ${conversationId}`);

        // 标记会话为已读
        try {
          await Message.markConversationAsRead(conversationId);
          await Conversation.markAsRead(conversationId);
        } catch (error) {
          console.error('标记已读失败:', error);
        }

        socket.emit('joined_conversation', {
          success: true,
          conversationId
        });
      });

      // 离开会话房间
      socket.on('leave_conversation', (data) => {
        const { conversationId } = data;

        if (conversationId) {
          socket.leave(`conversation:${conversationId}`);
          console.log(`👋 离开会话: ${conversationId}`);
        }
      });

      // 发送消息
      socket.on('send_message', async (data) => {
        try {
          const {
            conversationId,
            content,
            senderType = 'agent',
            senderId,
            messageType = 'text',
            attachments,
            autoTranslate = false
          } = data;

          if (!conversationId || !content) {
            socket.emit('error', { message: '会话ID和内容不能为空' });
            return;
          }

          // 获取会话信息
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: '会话不存在' });
            return;
          }

          let translatedContent = null;
          let targetLanguage = null;

          // 自动翻译
          if (autoTranslate && conversation.customer_language) {
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
            conversation_id: conversationId,
            sender_type: senderType,
            sender_id: senderId || socket.userId,
            content,
            translated_content: translatedContent,
            target_language: targetLanguage,
            message_type: messageType,
            attachments
          });

          // 更新会话最后消息时间
          await Conversation.updateLastMessageTime(conversationId);

          // 如果是客户消息，增加未读计数
          if (senderType === 'customer') {
            await Conversation.incrementUnread(conversationId);
          }

          // 广播消息到会话房间
          this.io.to(`conversation:${conversationId}`).emit('new_message', {
            message,
            conversationId
          });

          // 通知被分配的客服（如果不在会话中）
          if (conversation.assigned_to) {
            this.io.to(`user:${conversation.assigned_to}`).emit('message_notification', {
              conversationId,
              customerId: conversation.customer_id,
              customerName: conversation.customer_name,
              preview: content.substring(0, 50),
              unreadCount: conversation.unread_count + 1
            });
          }

          console.log(`📩 消息已发送: ${conversationId}`);
        } catch (error) {
          console.error('发送消息错误:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // 开始打字
      socket.on('typing_start', (data) => {
        const { conversationId, userId, userName } = data;

        if (conversationId) {
          socket.to(`conversation:${conversationId}`).emit('user_typing', {
            conversationId,
            userId,
            userName,
            isTyping: true
          });
        }
      });

      // 停止打字
      socket.on('typing_stop', (data) => {
        const { conversationId, userId } = data;

        if (conversationId) {
          socket.to(`conversation:${conversationId}`).emit('user_typing', {
            conversationId,
            userId,
            isTyping: false
          });
        }
      });

      // 标记消息为已读
      socket.on('mark_read', async (data) => {
        try {
          const { conversationId } = data;

          if (!conversationId) return;

          await Message.markConversationAsRead(conversationId);
          await Conversation.markAsRead(conversationId);

          // 通知其他用户
          socket.to(`conversation:${conversationId}`).emit('messages_read', {
            conversationId,
            readBy: socket.userId
          });
        } catch (error) {
          console.error('标记已读错误:', error);
        }
      });

      // 请求AI回复建议
      socket.on('request_ai_suggestions', async (data) => {
        try {
          const { conversationId, customerProfile, context } = data;

          if (!conversationId) {
            socket.emit('error', { message: '会话ID不能为空' });
            return;
          }

          // 获取会话历史
          const messages = await Message.findByConversationId(conversationId, {
            limit: 20,
            order: 'asc'
          });

          // 生成回复建议
          const result = await AIAssistantService.suggestReplies(
            messages,
            customerProfile || {},
            context || {}
          );

          socket.emit('ai_suggestions', {
            conversationId,
            ...result
          });
        } catch (error) {
          console.error('生成AI建议错误:', error);
          socket.emit('error', { message: error.message });
        }
      });

      // 断开连接
      socket.on('disconnect', () => {
        console.log(`❌ Socket 断开: ${socket.id}`);

        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          this.broadcastUserStatus(socket.userId, 'offline');
        }
      });

      // 错误处理
      socket.on('error', (error) => {
        console.error('Socket 错误:', error);
      });
    });

    console.log('🔌 Socket.IO 初始化完成');
  }

  /**
   * 广播用户在线状态
   */
  broadcastUserStatus(userId, status) {
    this.io.emit('user_status', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  /**
   * 发送消息通知给特定用户
   */
  notifyUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * 向会话房间广播消息
   */
  broadcastToConversation(conversationId, event, data) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  /**
   * 广播给所有连接的客户端
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  /**
   * 获取在线用户数量
   */
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * 检查用户是否在线
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * 获取所有在线用户
   */
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys());
  }
}

// 导出单例
const socketService = new SocketService();
export default socketService;
