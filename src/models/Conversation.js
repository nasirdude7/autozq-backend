import { query, transaction } from '../db/salesPool.js';

/**
 * 会话模型
 */
class Conversation {
  /**
   * 创建会话
   */
  static async create(data) {
    const {
      customer_id,
      platform = 'whatsapp',
      assigned_to = null,
      status = 'active'
    } = data;

    const text = `
      INSERT INTO conversations (customer_id, platform, assigned_to, status, last_message_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    const values = [customer_id, platform, assigned_to, status];
    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * 获取会话列表
   */
  static async findAll(filters = {}) {
    let text = `
      SELECT
        conv.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.rating as customer_rating,
        c.country as customer_country,
        c.language as customer_language,
        u.full_name as agent_name,
        (
          SELECT content
          FROM messages
          WHERE conversation_id = conv.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) as last_message
      FROM conversations conv
      LEFT JOIN customers c ON conv.customer_id = c.id
      LEFT JOIN users u ON conv.assigned_to = u.id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    // 筛选条件
    if (filters.assigned_to) {
      text += ` AND conv.assigned_to = $${paramCount}`;
      values.push(filters.assigned_to);
      paramCount++;
    }

    if (filters.status) {
      text += ` AND conv.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.platform) {
      text += ` AND conv.platform = $${paramCount}`;
      values.push(filters.platform);
      paramCount++;
    }

    if (filters.unread_only) {
      text += ` AND conv.unread_count > 0`;
    }

    text += ` ORDER BY conv.last_message_at DESC NULLS LAST`;

    // 分页
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    text += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await query(text, values);
    return result.rows;
  }

  /**
   * 根据 ID 获取会话详情
   */
  static async findById(id) {
    const text = `
      SELECT
        conv.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        c.country as customer_country,
        c.language as customer_language,
        c.rating as customer_rating,
        u.full_name as agent_name
      FROM conversations conv
      LEFT JOIN customers c ON conv.customer_id = c.id
      LEFT JOIN users u ON conv.assigned_to = u.id
      WHERE conv.id = $1
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 根据客户 ID 获取会话
   */
  static async findByCustomerId(customer_id, platform = 'whatsapp') {
    const text = `
      SELECT * FROM conversations
      WHERE customer_id = $1 AND platform = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await query(text, [customer_id, platform]);
    return result.rows[0];
  }

  /**
   * 获取或创建会话
   */
  static async getOrCreate(customer_id, platform = 'whatsapp', assigned_to = null) {
    // 先查找是否存在活跃会话
    let conversation = await this.findByCustomerId(customer_id, platform);

    // 如果没有找到或已关闭，创建新会话
    if (!conversation || conversation.status === 'closed') {
      conversation = await this.create({
        customer_id,
        platform,
        assigned_to,
        status: 'active'
      });
    }

    return conversation;
  }

  /**
   * 更新会话
   */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    const text = `
      UPDATE conversations
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * 更新最后消息时间
   */
  /**
   * 合并更新会话 metadata（保留已有键，新键覆盖）
   * 用于持久化 SalesMartly 路由参数 project_id/channel/channel_id/session_id
   */
  static async updateMetadata(id, patch) {
    const text = `
      UPDATE conversations
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING metadata
    `;
    const result = await query(text, [id, JSON.stringify(patch)]);
    return result.rows[0]?.metadata;
  }

  static async updateLastMessageTime(id) {
    const text = `
      UPDATE conversations
      SET last_message_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 增加未读计数
   */
  static async incrementUnread(id) {
    const text = `
      UPDATE conversations
      SET unread_count = unread_count + 1
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 标记为已读
   */
  static async markAsRead(id) {
    const text = `
      UPDATE conversations
      SET unread_count = 0
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 关闭会话
   */
  static async close(id) {
    const text = `
      UPDATE conversations
      SET status = 'closed'
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 删除会话
   */
  static async delete(id) {
    const text = 'DELETE FROM conversations WHERE id = $1 RETURNING *';
    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 统计会话数量
   */
  static async count(filters = {}) {
    let text = 'SELECT COUNT(*) FROM conversations WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.assigned_to) {
      text += ` AND assigned_to = $${paramCount}`;
      values.push(filters.assigned_to);
      paramCount++;
    }

    if (filters.status) {
      text += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.unread_only) {
      text += ` AND unread_count > 0`;
    }

    const result = await query(text, values);
    return parseInt(result.rows[0].count);
  }
}

export default Conversation;
