-- 客户分析表
CREATE TABLE IF NOT EXISTS customer_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    intent_score INTEGER CHECK (intent_score >= 0 AND intent_score <= 100),
    intent_level VARCHAR(20),
    customer_type VARCHAR(50),
    analysis_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_customer_analysis_customer ON customer_analysis(customer_id);
CREATE INDEX idx_customer_analysis_intent_score ON customer_analysis(intent_score DESC);
CREATE INDEX idx_customer_analysis_customer_type ON customer_analysis(customer_type);
CREATE INDEX idx_customer_analysis_updated ON customer_analysis(updated_at DESC);

COMMENT ON TABLE customer_analysis IS 'AI客户分析结果';
COMMENT ON COLUMN customer_analysis.intent_score IS '购买意向评分 0-100';
COMMENT ON COLUMN customer_analysis.intent_level IS '意向级别：高意向/中意向/低意向/观望中';
COMMENT ON COLUMN customer_analysis.customer_type IS '客户类型：个人买家/B端经销商/中间商/咨询者';
COMMENT ON COLUMN customer_analysis.analysis_data IS 'AI分析的完整JSON数据';
