import pool, { query } from '../db/salesPool.js';

/**
 * 客户分配模型
 * 管理客户到坐席的分配关系
 */
class Assignment {
  /**
   * 分配客户给坐席
   */
  static async assignCustomer(customerId, assignedTo, assignedBy, notes = null) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 检查是否已有活跃分配
      const checkQuery = `
        SELECT * FROM customer_assignments
        WHERE customer_id = $1 AND status = 'active'
      `;
      const existing = await client.query(checkQuery, [customerId]);

      if (existing.rows.length > 0) {
        // 如果已分配给同一个人，直接返回
        if (existing.rows[0].assigned_to === assignedTo) {
          await client.query('COMMIT');
          return existing.rows[0];
        }

        // 否则先结束旧分配，记录到历史
        const oldAssignment = existing.rows[0];

        await client.query(
          `UPDATE customer_assignments SET status = 'transferred' WHERE id = $1`,
          [oldAssignment.id]
        );

        await client.query(
          `INSERT INTO assignment_history (customer_id, from_user, to_user, reason, transferred_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [customerId, oldAssignment.assigned_to, assignedTo, '重新分配', assignedBy]
        );
      }

      // 创建新分配
      const insertQuery = `
        INSERT INTO customer_assignments (customer_id, assigned_to, assigned_by, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [customerId, assignedTo, assignedBy, notes]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 转移客户
   */
  static async transferCustomer(customerId, fromUser, toUser, reason, transferredBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 结束旧分配
      await client.query(
        `UPDATE customer_assignments
         SET status = 'transferred'
         WHERE customer_id = $1 AND assigned_to = $2 AND status = 'active'`,
        [customerId, fromUser]
      );

      // 记录历史
      await client.query(
        `INSERT INTO assignment_history (customer_id, from_user, to_user, reason, transferred_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [customerId, fromUser, toUser, reason, transferredBy]
      );

      // 创建新分配
      const result = await client.query(
        `INSERT INTO customer_assignments (customer_id, assigned_to, assigned_by, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [customerId, toUser, transferredBy, reason]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 取消分配（释放客户到未分配池）
   */
  static async unassignCustomer(customerId) {
    const queryText = `
      UPDATE customer_assignments
      SET status = 'completed', completed_at = NOW()
      WHERE customer_id = $1 AND status = 'active'
      RETURNING *
    `;

    const result = await query(queryText, [customerId]);
    return result.rows[0];
  }

  /**
   * 获取客户的当前分配
   */
  static async getCurrentAssignment(customerId) {
    const queryText = `
      SELECT a.*, u.full_name AS agent_name, u.email AS agent_email
      FROM customer_assignments a
      LEFT JOIN staff_users u ON a.assigned_to = u.id
      WHERE a.customer_id = $1 AND a.status = 'active'
      LIMIT 1
    `;

    const result = await query(queryText, [customerId]);
    return result.rows[0];
  }

  /**
   * 获取坐席的客户列表
   */
  static async getAgentCustomers(agentId, filters = {}) {
    const { status = 'active', limit = 50, offset = 0 } = filters;

    const queryText = `
      SELECT
        c.*,
        a.assigned_at,
        a.notes AS assignment_notes,
        COALESCE(
          json_agg(
            json_build_object(
              'label_id', l.id,
              'label_name', l.name,
              'label_color', l.color,
              'label_icon', l.icon
            )
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) AS labels
      FROM customers c
      INNER JOIN customer_assignments a ON c.id = a.customer_id
      LEFT JOIN customer_labels cl ON c.id = cl.customer_id
      LEFT JOIN labels l ON cl.label_id = l.id
      WHERE a.assigned_to = $1 AND a.status = $2
      GROUP BY c.id, a.assigned_at, a.notes
      ORDER BY a.assigned_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await query(queryText, [agentId, status, limit, offset]);
    return result.rows;
  }

  /**
   * 统计坐席的客户数量
   */
  static async countAgentCustomers(agentId, status = 'active') {
    const queryText = `
      SELECT COUNT(*) FROM customer_assignments
      WHERE assigned_to = $1 AND status = $2
    `;

    const result = await query(queryText, [agentId, status]);
    return parseInt(result.rows[0].count);
  }

  /**
   * 获取未分配的客户列表
   */
  static async getUnassignedCustomers(filters = {}) {
    const { limit = 50, offset = 0 } = filters;

    const queryText = `
      SELECT
        c.*,
        COALESCE(
          json_agg(
            json_build_object(
              'label_id', l.id,
              'label_name', l.name,
              'label_color', l.color,
              'label_icon', l.icon
            )
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) AS labels
      FROM customers c
      LEFT JOIN customer_assignments a ON c.id = a.customer_id AND a.status = 'active'
      LEFT JOIN customer_labels cl ON c.id = cl.customer_id
      LEFT JOIN labels l ON cl.label_id = l.id
      WHERE a.id IS NULL
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await query(queryText, [limit, offset]);
    return result.rows;
  }

  /**
   * 统计未分配客户数量
   */
  static async countUnassignedCustomers() {
    const queryText = `
      SELECT COUNT(*) FROM customers c
      LEFT JOIN customer_assignments a ON c.id = a.customer_id AND a.status = 'active'
      WHERE a.id IS NULL
    `;

    const result = await query(queryText);
    return parseInt(result.rows[0].count);
  }

  /**
   * 获取分配历史
   */
  static async getHistory(customerId, limit = 20) {
    const queryText = `
      SELECT
        h.*,
        fu.full_name AS from_user_name,
        tu.full_name AS to_user_name,
        bu.full_name AS transferred_by_name
      FROM assignment_history h
      LEFT JOIN staff_users fu ON h.from_user = fu.id
      LEFT JOIN staff_users tu ON h.to_user = tu.id
      LEFT JOIN staff_users bu ON h.transferred_by = bu.id
      WHERE h.customer_id = $1
      ORDER BY h.transferred_at DESC
      LIMIT $2
    `;

    const result = await query(queryText, [customerId, limit]);
    return result.rows;
  }

  /**
   * 批量分配客户
   */
  static async batchAssign(customerIds, assignedTo, assignedBy, notes = null) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];
      for (const customerId of customerIds) {
        const result = await this.assignCustomer(customerId, assignedTo, assignedBy, notes);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取坐席工作负载统计
   */
  static async getAgentWorkload() {
    const queryText = `
      SELECT
        u.id AS agent_id,
        u.full_name AS agent_name,
        u.status AS agent_status,
        COUNT(a.id) AS active_customers,
        MAX(a.assigned_at) AS last_assignment
      FROM staff_users u
      LEFT JOIN customer_assignments a ON u.id = a.assigned_to AND a.status = 'active'
      WHERE u.role IN ('agent', 'manager') AND u.status = 'active'
      GROUP BY u.id, u.full_name, u.status
      ORDER BY active_customers ASC, u.full_name ASC
    `;

    const result = await query(queryText);
    return result.rows;
  }

  /**
   * 找出当前负载最低的可用坐席（负载均衡策略）
   * 返回 { agent_id, agent_name, active_customers } 或 null（无可用坐席）
   */
  static async findLeastLoadedAgent() {
    const workload = await Assignment.getAgentWorkload();
    if (workload.length === 0) return null;
    // getAgentWorkload 已按 active_customers ASC 排序，第一个即负载最低
    return workload[0];
  }

  /**
   * 自动分配单个客户给负载最低的坐席
   * @returns 分配记录，或 null（无可用坐席，客户保持未分配）
   */
  static async autoAssign(customerId, assignedBy = null) {
    const agent = await Assignment.findLeastLoadedAgent();
    if (!agent) return null;
    return Assignment.assignCustomer(customerId, agent.agent_id, assignedBy, '系统自动分配（负载均衡）');
  }

  /**
   * 批量自动分配所有未分配客户（贪心均衡：每次派给当前累计负载最低者）
   * @returns { assigned: 数量, agents: 参与坐席数, skipped: 无坐席时跳过的数量 }
   */
  static async autoAssignAllUnassigned(assignedBy = null) {
    // 1. 取所有未分配客户
    const unassignedResult = await query(`
      SELECT c.id FROM customers c
      LEFT JOIN customer_assignments a ON c.id = a.customer_id AND a.status = 'active'
      WHERE a.id IS NULL
      ORDER BY c.created_at ASC
    `);
    const unassigned = unassignedResult.rows;

    // 2. 取坐席及其当前负载（内存中累加，避免每次派单都查库）
    const workload = await Assignment.getAgentWorkload();
    if (workload.length === 0) {
      return { assigned: 0, agents: 0, skipped: unassigned.length };
    }
    const loads = workload.map(w => ({ id: w.agent_id, count: parseInt(w.active_customers) || 0 }));

    // 3. 贪心：每个客户派给当前 count 最低的坐席
    let assigned = 0;
    for (const customer of unassigned) {
      loads.sort((a, b) => a.count - b.count);
      const target = loads[0];
      await Assignment.assignCustomer(customer.id, target.id, assignedBy, '系统批量自动分配（负载均衡）');
      target.count += 1;
      assigned += 1;
    }

    return { assigned, agents: loads.length, skipped: 0 };
  }
}

export default Assignment;
