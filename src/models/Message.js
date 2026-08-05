import { query } from '../db/salesPool.js';

/**
 * 消息模型
 */
class Message {
  /**
   * 创建消息
   */
  static async create(data) {
    const {
      conversation_id,
      sender_type,
      sender_id = null,
      content,
      translated_content = null,
      original_language = null,
      target_language = null,
      message_type = 'text',
      attachments = null,
      metadata = null
    } = data;

    const text = `
      INSERT INTO messages (
        conversation_id,
        sender_type,
        sender_id,
        content,
        translated_content,
        original_language,
        target_language,
        message_type,
        attachments,
        metadata,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;

    const values = [
      conversation_id,
      sender_type,
      sender_id,
      content,
      translated_content,
      original_language,
      target_language,
      message_type,
      attachments ? JSON.stringify(attachments) : null,
      metadata ? JSON.stringify(metadata) : null
    ];

    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * 获取会话的所有消息
   */
  static async findByConversationId(conversation_id, options = {}) {
    let text = `
      SELECT
        m.*,
        CASE
          WHEN m.sender_type = 'agent' THEN u.full_name
          WHEN m.sender_type = 'customer' THEN c.name
          ELSE 'System'
        END as sender_name
      FROM messages m
      LEFT JOIN users u ON m.sender_type = 'agent' AND m.sender_id::text = u.id::text
      LEFT JOIN conversations conv ON m.conversation_id = conv.id
      LEFT JOIN customers c ON conv.customer_id = c.id
      WHERE m.conversation_id = $1
    `;

    const values = [conversation_id];
    let paramCount = 2;

    // 时间范围筛选
    if (options.since) {
      text += ` AND m.timestamp >= $${paramCount}`;
      values.push(options.since);
      paramCount++;
    }

    if (options.until) {
      text += ` AND m.timestamp <= $${paramCount}`;
      values.push(options.until);
      paramCount++;
    }

    // 排序
    text += ` ORDER BY m.timestamp ${options.order === 'desc' ? 'DESC' : 'ASC'}`;

    // 分页
    if (options.limit) {
      text += ` LIMIT $${paramCount}`;
      values.push(options.limit);
      paramCount++;

      if (options.offset) {
        text += ` OFFSET $${paramCount}`;
        values.push(options.offset);
      }
    }

    const result = await query(text, values);
    return result.rows;
  }

  /**
   * 获取单条消息
   */
  static async findById(id) {
    const text = 'SELECT * FROM messages WHERE id = $1';
    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 更新消息
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
      UPDATE messages
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * 标记消息为已读
   */
  static async markAsRead(id) {
    const text = `
      UPDATE messages
      SET read_status = TRUE, read_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 批量标记会话消息为已读
   */
  static async markConversationAsRead(conversation_id) {
    const text = `
      UPDATE messages
      SET read_status = TRUE, read_at = NOW()
      WHERE conversation_id = $1 AND read_status = FALSE
      RETURNING *
    `;

    const result = await query(text, [conversation_id]);
    return result.rows;
  }

  /**
   * 获取未读消息数量
   */
  static async countUnread(conversation_id) {
    const text = `
      SELECT COUNT(*) FROM messages
      WHERE conversation_id = $1 AND read_status = FALSE AND sender_type = 'customer'
    `;

    const result = await query(text, [conversation_id]);
    return parseInt(result.rows[0].count);
  }

  /**
   * 搜索消息
   */
  static async search(searchTerm, filters = {}) {
    let text = `
      SELECT
        m.*,
        conv.id as conversation_id,
        c.name as customer_name
      FROM messages m
      JOIN conversations conv ON m.conversation_id = conv.id
      JOIN customers c ON conv.customer_id = c.id
      WHERE (m.content ILIKE $1 OR m.translated_content ILIKE $1)
    `;

    const values = [`%${searchTerm}%`];
    let paramCount = 2;

    if (filters.customer_id) {
      text += ` AND conv.customer_id = $${paramCount}`;
      values.push(filters.customer_id);
      paramCount++;
    }

    if (filters.sender_type) {
      text += ` AND m.sender_type = $${paramCount}`;
      values.push(filters.sender_type);
      paramCount++;
    }

    if (filters.date_from) {
      text += ` AND m.timestamp >= $${paramCount}`;
      values.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      text += ` AND m.timestamp <= $${paramCount}`;
      values.push(filters.date_to);
      paramCount++;
    }

    text += ` ORDER BY m.timestamp DESC LIMIT 100`;

    const result = await query(text, values);
    return result.rows;
  }

  /**
   * 删除消息
   */
  static async delete(id) {
    const text = 'DELETE FROM messages WHERE id = $1 RETURNING *';
    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 删除会话的所有消息
   */
  static async deleteByConversationId(conversation_id) {
    const text = 'DELETE FROM messages WHERE conversation_id = $1';
    await query(text, [conversation_id]);
  }

  /**
   * 统计消息数量
   */
  static async count(filters = {}) {
    let text = 'SELECT COUNT(*) FROM messages WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.conversation_id) {
      text += ` AND conversation_id = $${paramCount}`;
      values.push(filters.conversation_id);
      paramCount++;
    }

    if (filters.sender_type) {
      text += ` AND sender_type = $${paramCount}`;
      values.push(filters.sender_type);
      paramCount++;
    }

    if (filters.read_status !== undefined) {
      text += ` AND read_status = $${paramCount}`;
      values.push(filters.read_status);
      paramCount++;
    }

    const result = await query(text, values);
    return parseInt(result.rows[0].count);
  }

  /**
   * 获取最新消息
   */
  static async getLatest(conversation_id) {
    const text = `
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const result = await query(text, [conversation_id]);
    return result.rows[0];
  }
}

export default Message;
