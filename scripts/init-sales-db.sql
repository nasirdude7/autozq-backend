-- ================================================
-- 销售工作台数据库初始化脚本
-- ================================================

-- 1. 用户表（扩展）
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent', 'viewer')),
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'busy')),
  workload INTEGER DEFAULT 0,
  max_workload INTEGER DEFAULT 50,
  languages TEXT[] DEFAULT ARRAY['zh', 'en'],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 客户表
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255),
  whatsapp_id VARCHAR(100) UNIQUE,
  country VARCHAR(100),
  language VARCHAR(10) DEFAULT 'en',
  source VARCHAR(50) DEFAULT 'whatsapp',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  rating VARCHAR(10) CHECK (rating IN ('A', 'B', 'C', 'D')),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklist')),
  last_contact_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 会话表
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  platform VARCHAR(50) DEFAULT 'whatsapp' CHECK (platform IN ('whatsapp', 'wechat', 'telegram', 'web')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 消息表
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
  sender_id UUID,
  content TEXT NOT NULL,
  translated_content TEXT,
  original_language VARCHAR(10),
  target_language VARCHAR(10),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  attachments JSONB,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  read_status BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 客户画像表
CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  purchase_intent_score INTEGER CHECK (purchase_intent_score BETWEEN 0 AND 100),
  budget_range VARCHAR(100),
  preferred_brands TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_vehicle_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  behavior_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  communication_style VARCHAR(100),
  ai_summary TEXT,
  interaction_count INTEGER DEFAULT 0,
  avg_response_time INTEGER,
  response_rate DECIMAL(5, 2),
  last_analysis_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. 客户评级记录表
CREATE TABLE customer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  rating VARCHAR(10) NOT NULL CHECK (rating IN ('A', 'B', 'C', 'D')),
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  factors JSONB,
  rated_by VARCHAR(50) DEFAULT 'ai' CHECK (rated_by IN ('ai', 'manual')),
  rated_by_user UUID REFERENCES users(id),
  notes TEXT,
  rated_at TIMESTAMP DEFAULT NOW()
);

-- 7. 快捷回复模板表
CREATE TABLE quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  category VARCHAR(100),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  usage_count INTEGER DEFAULT 0,
  is_global BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. 客户意向车型表
CREATE TABLE customer_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_brand VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  interest_level VARCHAR(50) CHECK (interest_level IN ('high', 'medium', 'low')),
  quoted_price DECIMAL(12, 2),
  currency VARCHAR(10) DEFAULT 'USD',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'quoted', 'closed', 'lost')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. 跟进记录表
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) CHECK (type IN ('call', 'email', 'whatsapp', 'meeting', 'other')),
  subject VARCHAR(255),
  content TEXT,
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. 客户分配记录表
CREATE TABLE assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  from_agent UUID REFERENCES users(id),
  to_agent UUID REFERENCES users(id),
  reason VARCHAR(255),
  assignment_type VARCHAR(50) CHECK (assignment_type IN ('auto', 'manual', 'transfer')),
  assigned_at TIMESTAMP DEFAULT NOW()
);

-- 11. 客服统计表（每日汇总）
CREATE TABLE agent_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  conversations_handled INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  avg_response_time INTEGER,
  customer_satisfaction_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- 12. WhatsApp 账号表
CREATE TABLE whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) UNIQUE NOT NULL,
  whatsapp_business_id VARCHAR(255),
  access_token TEXT,
  webhook_verify_token VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  assigned_agents UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- 索引优化
-- ================================================

-- 客户表索引
CREATE INDEX idx_customers_assigned_to ON customers(assigned_to);
CREATE INDEX idx_customers_rating ON customers(rating);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_whatsapp_id ON customers(whatsapp_id);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- 会话表索引
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- 消息表索引
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_read_status ON messages(read_status);
CREATE INDEX idx_messages_sender_type ON messages(sender_type);

-- 客户画像表索引
CREATE INDEX idx_customer_profiles_customer_id ON customer_profiles(customer_id);
CREATE INDEX idx_customer_profiles_score ON customer_profiles(purchase_intent_score DESC);

-- 跟进记录表索引
CREATE INDEX idx_follow_ups_customer_id ON follow_ups(customer_id);
CREATE INDEX idx_follow_ups_assigned_to ON follow_ups(assigned_to);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_at);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);

-- ================================================
-- 触发器：自动更新时间戳
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有需要的表创建触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quick_replies_updated_at BEFORE UPDATE ON quick_replies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 初始化数据
-- ================================================

-- 创建默认管理员用户（密码: admin123 - 请在生产环境修改）
INSERT INTO users (username, password_hash, email, role, full_name, status)
VALUES (
  'admin',
  '$2a$10$YourHashedPasswordHere', -- 需要使用 bcrypt 生成
  'admin@autozq.com',
  'admin',
  'System Administrator',
  'active'
) ON CONFLICT (username) DO NOTHING;

-- 创建一些默认快捷回复
INSERT INTO quick_replies (title, content, language, category, is_global) VALUES
  ('打招呼', '您好！我是AutoZQ的销售顾问，很高兴为您服务。请问您对什么车型感兴趣？', 'zh', 'greeting', TRUE),
  ('询问预算', '为了更好地为您推荐合适的车型，请问您的预算大概是多少？', 'zh', 'qualification', TRUE),
  ('询问用途', '请问您主要用于什么用途？家用、商用还是其他？', 'zh', 'qualification', TRUE),
  ('报价确认', '好的，我这边给您查询一下最新的价格和库存信息，稍等片刻。', 'zh', 'pricing', TRUE),
  ('感谢', '非常感谢您的咨询！如果有任何问题，随时联系我。', 'zh', 'closing', TRUE),
  ('Greeting', 'Hello! I am a sales consultant from AutoZQ. How can I help you today?', 'en', 'greeting', TRUE),
  ('Budget Question', 'To better recommend suitable vehicles, may I know your budget range?', 'en', 'qualification', TRUE),
  ('Thank You', 'Thank you for your inquiry! Feel free to contact me anytime.', 'en', 'closing', TRUE)
ON CONFLICT DO NOTHING;

-- ================================================
-- 视图：客服工作台统计
-- ================================================

CREATE OR REPLACE VIEW agent_workbench_stats AS
SELECT
  u.id as agent_id,
  u.full_name,
  u.status,
  u.workload,
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT CASE WHEN conv.status = 'active' THEN conv.id END) as active_conversations,
  COUNT(DISTINCT CASE WHEN conv.unread_count > 0 THEN conv.id END) as unread_conversations,
  COUNT(DISTINCT CASE WHEN c.created_at >= NOW() - INTERVAL '24 hours' THEN c.id END) as new_customers_today
FROM users u
LEFT JOIN customers c ON c.assigned_to = u.id
LEFT JOIN conversations conv ON conv.assigned_to = u.id
WHERE u.role IN ('agent', 'manager')
GROUP BY u.id, u.full_name, u.status, u.workload;

-- ================================================
-- 完成
-- ================================================

COMMENT ON TABLE customers IS '客户信息表';
COMMENT ON TABLE conversations IS '会话表';
COMMENT ON TABLE messages IS '消息记录表';
COMMENT ON TABLE customer_profiles IS '客户AI画像表';
COMMENT ON TABLE customer_ratings IS '客户评级记录表';
COMMENT ON TABLE quick_replies IS '快捷回复模板表';
COMMENT ON TABLE follow_ups IS '客户跟进记录表';
COMMENT ON TABLE agent_stats IS '客服每日统计表';

SELECT 'Sales Workbench Database Initialized Successfully!' as status;
