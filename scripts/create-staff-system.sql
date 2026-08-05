-- ================================================================
-- AutoZQ 销售工作台 - 员工账号与权限系统
-- 创建时间: 2026-08-03
-- 说明: 独立的员工账号体系，与客户账号完全分离
-- ================================================================

-- 1. 员工用户表（替代 users.json）
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(20),

  -- 角色：super_admin（超管）, manager（主管）, agent（坐席）
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'manager', 'agent')),

  -- 上级主管（用于团队层级）
  manager_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,

  avatar_url VARCHAR(500),

  -- 状态：active（活跃）, inactive（停用）, suspended（暂停）
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

  -- 首次登录标记（用于强制修改密码）
  is_first_login BOOLEAN DEFAULT TRUE,

  -- 最后登录时间
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(50),

  -- 元数据
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 员工权限表（细粒度权限控制）
CREATE TABLE IF NOT EXISTS staff_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,

  -- 权限标识符
  permission VARCHAR(50) NOT NULL,
  -- 可用权限:
  -- view_all_customers: 查看所有客户
  -- view_b2b_dealers: 查看B端经销商（超管专属）
  -- manage_users: 管理员工账号
  -- assign_customers: 分配客户
  -- manage_labels: 管理标签
  -- export_data: 导出数据
  -- view_analytics: 查看数据分析
  -- manage_knowledge: 管理知识库

  granted_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, permission)
);

-- 3. 标签表（客户分类标签）
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  icon VARCHAR(50),  -- emoji 或图标名称

  -- 分类：customer_type（客户类型）, priority（优先级）, source（来源）, custom（自定义）
  category VARCHAR(20) DEFAULT 'custom',

  -- 是否系统标签（不可删除）
  is_system BOOLEAN DEFAULT FALSE,

  -- 可见性：all（所有人）, super_admin_only（仅超管）, manager_up（主管及以上）
  visibility VARCHAR(20) DEFAULT 'all',

  -- 排序权重
  sort_order INTEGER DEFAULT 0,

  created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(name)
);

-- 4. 客户-标签关联表
CREATE TABLE IF NOT EXISTS customer_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_id, label_id)
);

-- 5. 客户分配表（坐席分配）
CREATE TABLE IF NOT EXISTS customer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),

  -- 状态：active（活跃）, transferred（已转移）, completed（已完成）
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'completed')),

  notes TEXT,

  -- 完成时间
  completed_at TIMESTAMP,

  UNIQUE(customer_id, status) -- 同一客户只能有一个活跃分配
);

-- 6. 分配历史表（追踪客户转接记录）
CREATE TABLE IF NOT EXISTS assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  from_user UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  to_user UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  reason TEXT,
  transferred_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  transferred_at TIMESTAMP DEFAULT NOW()
);

-- 7. 员工活动日志表（审计追踪）
CREATE TABLE IF NOT EXISTS staff_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,  -- login, logout, view_customer, assign_customer, create_user 等
  target_type VARCHAR(50),        -- customer, user, label 等
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- 索引优化
-- ================================================================

-- 员工用户索引
CREATE INDEX idx_staff_users_username ON staff_users(username);
CREATE INDEX idx_staff_users_role ON staff_users(role);
CREATE INDEX idx_staff_users_status ON staff_users(status);
CREATE INDEX idx_staff_users_manager ON staff_users(manager_id);

-- 权限索引
CREATE INDEX idx_staff_permissions_user ON staff_permissions(user_id);
CREATE INDEX idx_staff_permissions_permission ON staff_permissions(permission);

-- 标签索引
CREATE INDEX idx_labels_category ON labels(category);
CREATE INDEX idx_labels_visibility ON labels(visibility);
CREATE INDEX idx_customer_labels_customer ON customer_labels(customer_id);
CREATE INDEX idx_customer_labels_label ON customer_labels(label_id);

-- 分配索引
CREATE INDEX idx_customer_assignments_customer ON customer_assignments(customer_id);
CREATE INDEX idx_customer_assignments_assigned_to ON customer_assignments(assigned_to);
CREATE INDEX idx_customer_assignments_status ON customer_assignments(status);
CREATE INDEX idx_assignment_history_customer ON assignment_history(customer_id);

-- 活动日志索引
CREATE INDEX idx_staff_activity_logs_user ON staff_activity_logs(user_id);
CREATE INDEX idx_staff_activity_logs_action ON staff_activity_logs(action);
CREATE INDEX idx_staff_activity_logs_created ON staff_activity_logs(created_at);

-- ================================================================
-- 预置系统数据
-- ================================================================

-- 预置系统标签（使用 ON CONFLICT DO NOTHING 避免重复插入）
INSERT INTO labels (name, color, icon, category, is_system, visibility, sort_order) VALUES
('🏢 B端经销商', '#DC2626', '🏢', 'customer_type', TRUE, 'super_admin_only', 1),
('⭐ VIP客户', '#F59E0B', '⭐', 'priority', TRUE, 'all', 2),
('🔥 高意向', '#10B981', '🔥', 'priority', TRUE, 'all', 3),
('💰 询价中', '#3B82F6', '💰', 'priority', TRUE, 'all', 4),
('📋 待跟进', '#8B5CF6', '📋', 'priority', TRUE, 'all', 5),
('❄️  冷淡客户', '#6B7280', '❄️', 'priority', TRUE, 'all', 6),
('🚫 黑名单', '#EF4444', '🚫', 'customer_type', TRUE, 'manager_up', 7)
ON CONFLICT (name) DO NOTHING;

-- 创建超级管理员账号（密码: Admin@123）
-- 密码 hash 使用 bcrypt，rounds=10
INSERT INTO staff_users (
  username,
  password_hash,
  full_name,
  email,
  role,
  status,
  is_first_login
) VALUES (
  'admin',
  '$2b$10$YourBcryptHashHere',  -- 需要用真实 bcrypt hash 替换
  '超级管理员',
  'admin@autozq.ru',
  'super_admin',
  'active',
  TRUE
) ON CONFLICT (username) DO NOTHING;

-- 为超级管理员授予所有权限
INSERT INTO staff_permissions (user_id, permission)
SELECT id, unnest(ARRAY[
  'view_all_customers',
  'view_b2b_dealers',
  'manage_users',
  'assign_customers',
  'manage_labels',
  'export_data',
  'view_analytics',
  'manage_knowledge'
]) AS permission
FROM staff_users WHERE username = 'admin'
ON CONFLICT (user_id, permission) DO NOTHING;

-- ================================================================
-- 自动更新 updated_at 触发器
-- ================================================================

-- 员工用户表触发器
CREATE OR REPLACE FUNCTION update_staff_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_staff_users_updated_at
BEFORE UPDATE ON staff_users
FOR EACH ROW
EXECUTE FUNCTION update_staff_users_updated_at();

-- 标签表触发器
CREATE OR REPLACE FUNCTION update_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_labels_updated_at
BEFORE UPDATE ON labels
FOR EACH ROW
EXECUTE FUNCTION update_labels_updated_at();

-- ================================================================
-- 数据完整性视图（便于查询）
-- ================================================================

-- 员工信息视图（包含权限和团队信息）
CREATE OR REPLACE VIEW v_staff_users_detail AS
SELECT
  u.id,
  u.username,
  u.full_name,
  u.email,
  u.phone,
  u.role,
  u.status,
  u.last_login_at,
  m.full_name AS manager_name,
  COALESCE(
    json_agg(
      DISTINCT p.permission
    ) FILTER (WHERE p.permission IS NOT NULL),
    '[]'::json
  ) AS permissions,
  u.created_at
FROM staff_users u
LEFT JOIN staff_users m ON u.manager_id = m.id
LEFT JOIN staff_permissions p ON u.id = p.user_id
GROUP BY u.id, m.full_name;

-- 客户分配视图（便于查询当前分配情况）
CREATE OR REPLACE VIEW v_customer_assignments AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.country,
  c.whatsapp_id,
  a.assigned_to AS agent_id,
  u.full_name AS agent_name,
  u.email AS agent_email,
  a.assigned_at,
  a.status AS assignment_status,
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
LEFT JOIN staff_users u ON a.assigned_to = u.id
LEFT JOIN customer_labels cl ON c.id = cl.customer_id
LEFT JOIN labels l ON cl.label_id = l.id
GROUP BY c.id, c.name, c.phone, c.country, c.whatsapp_id, a.assigned_to, u.full_name, u.email, a.assigned_at, a.status;

-- ================================================================
-- 完成提示
-- ================================================================

COMMENT ON TABLE staff_users IS '员工用户表 - 独立于客户的员工账号体系';
COMMENT ON TABLE staff_permissions IS '员工权限表 - 细粒度权限控制';
COMMENT ON TABLE labels IS '标签表 - 客户分类标签，支持可见性控制';
COMMENT ON TABLE customer_labels IS '客户-标签关联表';
COMMENT ON TABLE customer_assignments IS '客户分配表 - 坐席分配记录';
COMMENT ON TABLE assignment_history IS '分配历史表 - 客户转接追踪';
COMMENT ON TABLE staff_activity_logs IS '员工活动日志 - 审计追踪';

SELECT '✅ AutoZQ 员工权限体系数据库表创建完成！' AS status;
