import pool, { query } from '../db/salesPool.js';

/**
 * 标签模型
 * 用于客户分类、优先级标记等
 */
class Label {
  /**
   * 根据 ID 查找标签
   */
  static async findById(id) {
    const queryText = 'SELECT * FROM labels WHERE id = $1';
    const result = await query(queryText, [id]);
    return result.rows[0];
  }

  /**
   * 根据名称查找标签
   */
  static async findByName(name) {
    const queryText = 'SELECT * FROM labels WHERE name = $1';
    const result = await query(queryText, [name]);
    return result.rows[0];
  }

  /**
   * 获取所有标签（支持筛选和权限过滤）
   */
  static async findAll(filters = {}, userRole = 'agent') {
    const { category, visibility, limit = 100, offset = 0 } = filters;

    let sql = 'SELECT * FROM labels WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    // 权限过滤
    if (userRole !== 'super_admin') {
      sql += ` AND visibility != 'super_admin_only'`;
    }

    if (category) {
      sql += ` AND category = $${paramIndex++}`;
      values.push(category);
    }

    if (visibility) {
      sql += ` AND visibility = $${paramIndex++}`;
      values.push(visibility);
    }

    sql += ` ORDER BY sort_order ASC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * 创建标签
   */
  static async create(data) {
    const {
      name,
      color = '#3B82F6',
      icon,
      category = 'custom',
      is_system = false,
      visibility = 'all',
      sort_order = 0,
      created_by
    } = data;

    const queryText = `
      INSERT INTO labels (
        name, color, icon, category, is_system, visibility, sort_order, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [name, color, icon, category, is_system, visibility, sort_order, created_by];

    const result = await query(queryText, values);
    return result.rows[0];
  }

  /**
   * 更新标签
   */
  static async update(id, data) {
    const { name, color, icon, category, visibility, sort_order } = data;

    const queryText = `
      UPDATE labels
      SET
        name = COALESCE($2, name),
        color = COALESCE($3, color),
        icon = COALESCE($4, icon),
        category = COALESCE($5, category),
        visibility = COALESCE($6, visibility),
        sort_order = COALESCE($7, sort_order),
        updated_at = NOW()
      WHERE id = $1 AND is_system = FALSE
      RETURNING *
    `;

    const values = [id, name, color, icon, category, visibility, sort_order];

    const result = await query(queryText, values);
    return result.rows[0];
  }

  /**
   * 删除标签（仅非系统标签）
   */
  static async delete(id) {
    const queryText = 'DELETE FROM labels WHERE id = $1 AND is_system = FALSE RETURNING *';
    const result = await query(queryText, [id]);
    return result.rows[0];
  }

  /**
   * 为客户添加标签
   */
  static async assignToCustomer(customerId, labelId, assignedBy) {
    const queryText = `
      INSERT INTO customer_labels (customer_id, label_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (customer_id, label_id) DO NOTHING
      RETURNING *
    `;

    const result = await query(queryText, [customerId, labelId, assignedBy]);
    return result.rows[0];
  }

  /**
   * 从客户移除标签
   */
  static async removeFromCustomer(customerId, labelId) {
    const queryText = 'DELETE FROM customer_labels WHERE customer_id = $1 AND label_id = $2';
    await query(queryText, [customerId, labelId]);
  }

  /**
   * 获取客户的所有标签
   */
  static async getCustomerLabels(customerId, userRole = 'agent') {
    let queryText = `
      SELECT l.*
      FROM labels l
      INNER JOIN customer_labels cl ON l.id = cl.label_id
      WHERE cl.customer_id = $1
    `;

    const values = [customerId];

    // 权限过滤
    if (userRole !== 'super_admin') {
      queryText += ` AND l.visibility != 'super_admin_only'`;
    }

    queryText += ' ORDER BY l.sort_order ASC';

    const result = await query(queryText, values);
    return result.rows;
  }

  /**
   * 批量为客户设置标签（替换现有标签）
   */
  static async setCustomerLabels(customerId, labelIds, assignedBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 删除现有标签
      await client.query('DELETE FROM customer_labels WHERE customer_id = $1', [customerId]);

      // 添加新标签
      if (labelIds && labelIds.length > 0) {
        const insertQuery = `
          INSERT INTO customer_labels (customer_id, label_id, assigned_by)
          SELECT $1, unnest($2::uuid[]), $3
        `;
        await client.query(insertQuery, [customerId, labelIds, assignedBy]);
      }

      await client.query('COMMIT');

      return await this.getCustomerLabels(customerId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取拥有特定标签的客户列表
   */
  static async getCustomersByLabel(labelId, limit = 50, offset = 0) {
    const queryText = `
      SELECT c.*, cl.assigned_at
      FROM customers c
      INNER JOIN customer_labels cl ON c.id = cl.customer_id
      WHERE cl.label_id = $1
      ORDER BY cl.assigned_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(queryText, [labelId, limit, offset]);
    return result.rows;
  }

  /**
   * 统计各标签的客户数量
   */
  static async getStats(userRole = 'agent') {
    let sql = `
      SELECT
        l.id,
        l.name,
        l.color,
        l.icon,
        l.category,
        COUNT(cl.customer_id) AS customer_count
      FROM labels l
      LEFT JOIN customer_labels cl ON l.id = cl.label_id
      WHERE 1=1
    `;

    // 权限过滤
    if (userRole !== 'super_admin') {
      sql += ` AND l.visibility != 'super_admin_only'`;
    }

    sql += ' GROUP BY l.id, l.name, l.color, l.icon, l.category ORDER BY l.sort_order ASC';

    const result = await query(sql);
    return result.rows;
  }
}

export default Label;
