import { query } from '../db/salesPool.js';
import bcryptjs from 'bcryptjs';

/**
 * 员工用户模型
 * 独立的员工账号体系，用于坐席、主管、管理员登录
 */
class StaffUser {
  /**
   * 根据用户名查找员工
   */
  static async findByUsername(username) {
    const queryText = 'SELECT * FROM staff_users WHERE username = $1';
    const result = await query(queryText, [username]);
    return result.rows[0];
  }

  /**
   * 根据 ID 查找员工
   */
  static async findById(id) {
    const queryText = 'SELECT * FROM staff_users WHERE id = $1';
    const result = await query(queryText, [id]);
    return result.rows[0];
  }

  /**
   * 获取员工详细信息（包含权限）
   */
  static async findByIdWithPermissions(id) {
    const queryText = 'SELECT * FROM v_staff_users_detail WHERE id = $1';
    const result = await query(queryText, [id]);
    return result.rows[0];
  }

  /**
   * 验证密码
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcryptjs.compareSync(plainPassword, hashedPassword);
  }

  /**
   * 创建员工账号
   */
  static async create(data) {
    const {
      username,
      password,
      full_name,
      email,
      phone,
      role = 'agent',
      manager_id,
      avatar_url
    } = data;

    // 生成密码 hash
    const password_hash = bcryptjs.hashSync(password, 10);

    const queryText = `
      INSERT INTO staff_users (
        username, password_hash, full_name, email, phone,
        role, manager_id, avatar_url, is_first_login
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING *
    `;

    const values = [
      username,
      password_hash,
      full_name,
      email || null,
      phone || null,
      role,
      manager_id || null,
      avatar_url || null
    ];

    const result = await query(queryText, values);
    return result.rows[0];
  }

  /**
   * 获取所有员工（支持筛选）
   */
  static async findAll(filters = {}) {
    const { role, status, manager_id, limit = 50, offset = 0 } = filters;

    let sql = 'SELECT * FROM v_staff_users_detail WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (role) {
      sql += ` AND role = $${paramIndex++}`;
      values.push(role);
    }

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (manager_id) {
      sql += ` AND manager_id = $${paramIndex++}`;
      values.push(manager_id);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    const result = await query(sql, values);
    return result.rows;
  }

  /**
   * 统计员工数量
   */
  static async count(filters = {}) {
    const { role, status } = filters;

    let sql = 'SELECT COUNT(*) FROM staff_users WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (role) {
      sql += ` AND role = $${paramIndex++}`;
      values.push(role);
    }

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    const result = await query(sql, values);
    return parseInt(result.rows[0].count);
  }

  /**
   * 更新员工信息
   */
  static async update(id, data) {
    const {
      full_name,
      email,
      phone,
      role,
      manager_id,
      avatar_url,
      status
    } = data;

    const queryText = `
      UPDATE staff_users
      SET
        full_name = COALESCE($2, full_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        role = COALESCE($5, role),
        manager_id = COALESCE($6, manager_id),
        avatar_url = COALESCE($7, avatar_url),
        status = COALESCE($8, status),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      full_name,
      email,
      phone,
      role,
      manager_id,
      avatar_url,
      status
    ];

    const result = await query(queryText, values);
    return result.rows[0];
  }

  /**
   * 修改密码
   */
  static async changePassword(id, newPassword) {
    const password_hash = bcryptjs.hashSync(newPassword, 10);

    const queryText = `
      UPDATE staff_users
      SET password_hash = $2, is_first_login = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING id, username
    `;

    const result = await query(queryText, [id, password_hash]);
    return result.rows[0];
  }

  /**
   * 更新最后登录时间
   */
  static async updateLastLogin(id, ip) {
    const queryText = `
      UPDATE staff_users
      SET last_login_at = NOW(), last_login_ip = $2
      WHERE id = $1
    `;

    await query(queryText, [id, ip]);
  }

  /**
   * 删除员工（软删除：设为 inactive）
   */
  static async softDelete(id) {
    const queryText = `
      UPDATE staff_users
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, status
    `;

    const result = await query(queryText, [id]);
    return result.rows[0];
  }

  /**
   * 获取员工的权限列表
   */
  static async getPermissions(userId) {
    const queryText = 'SELECT permission FROM staff_permissions WHERE user_id = $1';
    const result = await query(queryText, [userId]);
    return result.rows.map(row => row.permission);
  }

  /**
   * 授予权限
   */
  static async grantPermission(userId, permission, grantedBy) {
    const queryText = `
      INSERT INTO staff_permissions (user_id, permission, granted_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, permission) DO NOTHING
      RETURNING *
    `;

    const result = await query(queryText, [userId, permission, grantedBy]);
    return result.rows[0];
  }

  /**
   * 撤销权限
   */
  static async revokePermission(userId, permission) {
    const queryText = 'DELETE FROM staff_permissions WHERE user_id = $1 AND permission = $2';
    await query(queryText, [userId, permission]);
  }

  /**
   * 检查是否有特定权限
   */
  static async hasPermission(userId, permission) {
    // 超级管理员拥有所有权限
    const user = await this.findById(userId);
    if (user && user.role === 'super_admin') {
      return true;
    }

    const queryText = 'SELECT 1 FROM staff_permissions WHERE user_id = $1 AND permission = $2';
    const result = await query(queryText, [userId, permission]);
    return result.rows.length > 0;
  }

  /**
   * 记录员工活动日志
   */
  static async logActivity(userId, action, targetType, targetId, details, ip, userAgent) {
    const queryText = `
      INSERT INTO staff_activity_logs (
        user_id, action, target_type, target_id, details, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query(queryText, [
      userId,
      action,
      targetType || null,
      targetId || null,
      JSON.stringify(details || {}),
      ip || null,
      userAgent || null
    ]);

    return result.rows[0];
  }
}

export default StaffUser;
