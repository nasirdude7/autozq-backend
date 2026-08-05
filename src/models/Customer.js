import { query, transaction } from '../db/salesPool.js';

/**
 * 客户模型
 */
class Customer {
  /**
   * 创建客户
   */
  static async create(data) {
    const {
      name,
      phone,
      email,
      whatsapp_id,
      country,
      language = 'en',
      source = 'whatsapp',
      assigned_to = null,
      tags = []
    } = data;

    const text = `
      INSERT INTO customers (
        name, phone, email, whatsapp_id, country, language, source, assigned_to, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [name, phone, email, whatsapp_id, country, language, source, assigned_to, tags];
    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * 获取客户列表
   */
  static async findAll(filters = {}) {
    let text = `
      SELECT
        c.*,
        u.full_name as agent_name,
        cp.purchase_intent_score,
        cp.ai_summary,
        COUNT(DISTINCT conv.id) as conversation_count,
        MAX(conv.last_message_at) as last_conversation_at
      FROM customers c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN customer_profiles cp ON c.id = cp.customer_id
      LEFT JOIN conversations conv ON c.id = conv.customer_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    // 筛选条件
    if (filters.assigned_to) {
      text += ` AND c.assigned_to = $${paramCount}`;
      values.push(filters.assigned_to);
      paramCount++;
    }

    if (filters.rating) {
      text += ` AND c.rating = $${paramCount}`;
      values.push(filters.rating);
      paramCount++;
    }

    if (filters.status) {
      text += ` AND c.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.search) {
      text += ` AND (c.name ILIKE $${paramCount} OR c.phone ILIKE $${paramCount} OR c.email ILIKE $${paramCount})`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.country) {
      text += ` AND c.country = $${paramCount}`;
      values.push(filters.country);
      paramCount++;
    }

    text += ` GROUP BY c.id, u.full_name, cp.purchase_intent_score, cp.ai_summary`;
    text += ` ORDER BY c.created_at DESC`;

    // 分页
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    text += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(limit, offset);

    const result = await query(text, values);
    return result.rows;
  }

  /**
   * 根据 ID 获取客户详情
   */
  static async findById(id) {
    const text = `
      SELECT
        c.*,
        u.full_name as agent_name,
        u.email as agent_email,
        cp.purchase_intent_score,
        cp.budget_range,
        cp.preferred_brands,
        cp.behavior_tags,
        cp.ai_summary,
        cp.interaction_count,
        cp.avg_response_time,
        cp.last_analysis_at
      FROM customers c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN customer_profiles cp ON c.id = cp.customer_id
      WHERE c.id = $1
    `;

    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 根据电话号码查找客户
   */
  static async findByPhone(phone) {
    const text = 'SELECT * FROM customers WHERE phone = $1';
    const result = await query(text, [phone]);
    return result.rows[0];
  }

  /**
   * 根据 WhatsApp ID 查找客户
   */
  static async findByWhatsAppId(whatsapp_id) {
    const text = 'SELECT * FROM customers WHERE whatsapp_id = $1';
    const result = await query(text, [whatsapp_id]);
    return result.rows[0];
  }

  /**
   * 更新客户信息
   */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // 动态构建更新字段
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
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    values.push(id);

    const result = await query(text, values);
    return result.rows[0];
  }

  /**
   * 分配客户给客服
   */
  static async assign(customerId, agentId, reason = '手动分配') {
    return await transaction(async (client) => {
      // 更新客户分配
      const updateText = `
        UPDATE customers
        SET assigned_to = $1, last_contact_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateText, [agentId, customerId]);

      // 记录分配日志
      const logText = `
        INSERT INTO assignment_logs (customer_id, to_agent, reason, assignment_type)
        VALUES ($1, $2, $3, 'manual')
      `;
      await client.query(logText, [customerId, agentId, reason]);

      // 更新客服工作量
      const workloadText = `
        UPDATE users
        SET workload = workload + 1
        WHERE id = $1
      `;
      await client.query(workloadText, [agentId]);

      return updateResult.rows[0];
    });
  }

  /**
   * 添加标签
   */
  static async addTags(id, tags) {
    const text = `
      UPDATE customers
      SET tags = array_cat(tags, $1::text[])
      WHERE id = $2
      RETURNING *
    `;
    const result = await query(text, [tags, id]);
    return result.rows[0];
  }

  /**
   * 删除客户
   */
  static async delete(id) {
    const text = 'DELETE FROM customers WHERE id = $1 RETURNING *';
    const result = await query(text, [id]);
    return result.rows[0];
  }

  /**
   * 统计客户数量
   */
  static async count(filters = {}) {
    let text = 'SELECT COUNT(*) FROM customers WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.assigned_to) {
      text += ` AND assigned_to = $${paramCount}`;
      values.push(filters.assigned_to);
      paramCount++;
    }

    if (filters.rating) {
      text += ` AND rating = $${paramCount}`;
      values.push(filters.rating);
      paramCount++;
    }

    if (filters.status) {
      text += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    const result = await query(text, values);
    return parseInt(result.rows[0].count);
  }
}

export default Customer;
