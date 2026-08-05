-- ================================================
-- 销售工作台数据库扩展 - 知识库和单据管理
-- ================================================

-- 1. 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  category VARCHAR(100) DEFAULT 'general',
  source VARCHAR(100) DEFAULT 'manual', -- manual/auto_extracted/ai_generated
  confidence DECIMAL(3, 2) DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 报价单表
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicles JSONB NOT NULL, -- [{brand, model, year, price, quantity, specs}]
  subtotal DECIMAL(12, 2) NOT NULL,
  tax DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  valid_until TIMESTAMP NOT NULL,
  terms TEXT,
  html_content TEXT,
  pdf_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMP,
  sent_method VARCHAR(50),
  accepted_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  vehicles JSONB NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  payment_method VARCHAR(100),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  delivery_address TEXT,
  delivery_status VARCHAR(50) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  tracking_no VARCHAR(100),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
  confirmed_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 合同表
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contract_type VARCHAR(50) DEFAULT 'sales' CHECK (contract_type IN ('sales', 'service', 'partnership')),
  terms TEXT,
  content TEXT NOT NULL,
  pdf_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'signed', 'executed', 'terminated')),
  signed_at TIMESTAMP,
  signed_by_customer VARCHAR(255),
  customer_signature_url VARCHAR(500),
  signed_by_company VARCHAR(255),
  company_signature_url VARCHAR(500),
  effective_date DATE,
  expiry_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. 知识库访问日志表
CREATE TABLE IF NOT EXISTS knowledge_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  query_text TEXT,
  was_helpful BOOLEAN,
  feedback TEXT,
  accessed_at TIMESTAMP DEFAULT NOW()
);

-- 6. 单据操作日志表
CREATE TABLE IF NOT EXISTS document_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('quotation', 'order', 'contract')),
  document_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'sent', 'accepted', 'rejected', 'cancelled', 'signed')),
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB,
  performed_at TIMESTAMP DEFAULT NOW()
);

-- 7. 自动学习配置表
CREATE TABLE IF NOT EXISTS learning_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================
-- 索引优化
-- ================================================

-- 知识库索引
CREATE INDEX idx_knowledge_base_keywords ON knowledge_base USING GIN (keywords);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_confidence ON knowledge_base(confidence DESC);
CREATE INDEX idx_knowledge_base_usage ON knowledge_base(usage_count DESC);
CREATE INDEX idx_knowledge_base_active ON knowledge_base(is_active) WHERE is_active = TRUE;

-- 报价单索引
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX idx_quotations_valid_until ON quotations(valid_until);

-- 订单索引
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_quotation_id ON orders(quotation_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- 合同索引
CREATE INDEX idx_contracts_order_id ON contracts(order_id);
CREATE INDEX idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_effective_date ON contracts(effective_date);

-- ================================================
-- 触发器
-- ================================================

-- 知识库更新时间触发器
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 报价单更新时间触发器
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 订单更新时间触发器
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 合同更新时间触发器
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 自动更新知识库使用时间
CREATE OR REPLACE FUNCTION update_knowledge_last_used()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE knowledge_base
    SET last_used_at = NOW()
    WHERE id = NEW.knowledge_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_access_update_last_used
    AFTER INSERT ON knowledge_access_logs
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_last_used();

-- ================================================
-- 视图
-- ================================================

-- 单据统计视图
CREATE OR REPLACE VIEW document_stats AS
SELECT
  'quotation' as doc_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  SUM(total) as total_amount
FROM quotations
UNION ALL
SELECT
  'order' as doc_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
  SUM(total_amount) as total_amount
FROM orders
UNION ALL
SELECT
  'contract' as doc_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'signed' THEN 1 END) as signed,
  COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed,
  COUNT(CASE WHEN status = 'terminated' THEN 1 END) as terminated,
  0 as total_amount
FROM contracts;

-- 知识库效果统计视图
CREATE OR REPLACE VIEW knowledge_effectiveness AS
SELECT
  kb.id,
  kb.question,
  kb.category,
  kb.usage_count,
  COUNT(kal.id) as total_accesses,
  COUNT(CASE WHEN kal.was_helpful = TRUE THEN 1 END) as helpful_count,
  ROUND(
    COUNT(CASE WHEN kal.was_helpful = TRUE THEN 1 END)::DECIMAL /
    NULLIF(COUNT(kal.id), 0) * 100,
    2
  ) as helpfulness_rate
FROM knowledge_base kb
LEFT JOIN knowledge_access_logs kal ON kal.knowledge_id = kb.id
WHERE kb.is_active = TRUE
GROUP BY kb.id, kb.question, kb.category, kb.usage_count
ORDER BY kb.usage_count DESC;

-- 客户交易统计视图
CREATE OR REPLACE VIEW customer_transaction_stats AS
SELECT
  c.id as customer_id,
  c.name,
  c.rating,
  COUNT(DISTINCT q.id) as quotation_count,
  COUNT(DISTINCT o.id) as order_count,
  COALESCE(SUM(o.total_amount), 0) as total_spent,
  MAX(o.created_at) as last_order_date
FROM customers c
LEFT JOIN quotations q ON q.customer_id = c.id
LEFT JOIN orders o ON o.customer_id = c.id AND o.status IN ('confirmed', 'completed')
GROUP BY c.id, c.name, c.rating;

-- ================================================
-- 初始化配置数据
-- ================================================

-- 自动学习配置
INSERT INTO learning_config (config_key, config_value, description, is_active) VALUES
(
  'auto_learn_schedule',
  '{"frequency": "daily", "time": "02:00", "min_rating": 4}',
  '自动学习计划：每天凌晨2点从高评分对话中学习',
  TRUE
),
(
  'knowledge_extraction',
  '{"min_occurrence": 3, "min_confidence": 0.6, "auto_approve": false}',
  '知识提取配置：最少出现3次，置信度>=0.6，不自动批准',
  TRUE
),
(
  'rag_settings',
  '{"top_k": 5, "similarity_threshold": 0.7, "use_reranking": true}',
  'RAG检索配置：返回前5条，相似度>=0.7，使用重排序',
  TRUE
) ON CONFLICT (config_key) DO NOTHING;

-- 初始知识库样本（FAQ）
INSERT INTO knowledge_base (question, answer, keywords, category, source, confidence, is_active) VALUES
(
  '你们的车辆来自哪里？',
  '我们的车辆全部来自中国正规渠道，经过严格的质量检验，符合出口标准。我们与多家4S店和大型车商合作，保证车源可靠。',
  ARRAY['车源', '来源', '中国', '质量'],
  'vehicle_source',
  'manual',
  1.0,
  TRUE
),
(
  '运输到俄罗斯需要多长时间？',
  '从中国满洲里口岸到俄罗斯主要城市，通常需要10-15个工作日。具体时间取决于目的地城市和海关清关速度。我们提供全程物流追踪服务。',
  ARRAY['运输', '时间', '物流', '俄罗斯'],
  'logistics',
  'manual',
  1.0,
  TRUE
),
(
  '价格包含哪些费用？',
  '我们的报价包含车辆本身价格、出口手续费、运输费用。不包含俄罗斯当地的进口关税和登记费用。我们可以协助您了解俄罗斯当地的费用标准。',
  ARRAY['价格', '费用', '关税'],
  'pricing',
  'manual',
  1.0,
  TRUE
),
(
  '支持哪些付款方式？',
  '我们支持VTB银行转账、国际电汇（SWIFT）、以及部分加密货币支付。推荐使用VTB银行，手续费更低，到账更快。',
  ARRAY['付款', '支付', '银行'],
  'payment',
  'manual',
  1.0,
  TRUE
),
(
  '有质量保证吗？',
  '所有车辆出口前都会经过中俄双重质量检验，我们提供详细的车辆检测报告。对于车辆质量问题，我们提供3个月的质保服务。',
  ARRAY['质量', '保证', '检验'],
  'warranty',
  'manual',
  1.0,
  TRUE
) ON CONFLICT DO NOTHING;

-- ================================================
-- 完成
-- ================================================

COMMENT ON TABLE knowledge_base IS '知识库表 - 存储FAQ和自动学习的知识';
COMMENT ON TABLE quotations IS '报价单表';
COMMENT ON TABLE orders IS '订单表';
COMMENT ON TABLE contracts IS '合同表';
COMMENT ON TABLE knowledge_access_logs IS '知识库访问日志';
COMMENT ON TABLE document_logs IS '单据操作日志';
COMMENT ON TABLE learning_config IS '自动学习配置';

SELECT 'Knowledge Base and Document Management Tables Created Successfully!' as status;
