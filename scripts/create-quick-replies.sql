-- 快捷回复/话术库表
CREATE TABLE IF NOT EXISTS quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    language VARCHAR(10) DEFAULT 'zh',
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES staff_users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_quick_replies_category ON quick_replies(category);
CREATE INDEX idx_quick_replies_language ON quick_replies(language);
CREATE INDEX idx_quick_replies_active ON quick_replies(is_active);

-- 预置话术（汽车出口业务常用）
INSERT INTO quick_replies (title, content, category, language) VALUES
('欢迎语', '您好！我是AutoZQ的销售顾问，很高兴为您服务。请问您对哪款车型感兴趣？', 'greeting', 'zh'),
('询问需求', '请问您需要什么品牌或型号的车辆？我们可以为您提供专业的建议。', 'inquiry', 'zh'),
('价格咨询', '关于价格，我们需要了解您的具体需求（车型、配置、数量等）才能给出准确报价。请稍等，我马上为您查询。', 'pricing', 'zh'),
('配置说明', '这款车型配置丰富，包括[具体配置]。如需详细配置清单，我可以发送给您。', 'specification', 'zh'),
('物流说明', '我们提供全程物流服务，从中国到您指定的港口，通常需要30-45天。运费根据目的地和车辆数量计算。', 'logistics', 'zh'),
('付款方式', '付款方式：我们支持T/T电汇、L/C信用证等方式。首付30%，发货前付清余款。', 'payment', 'zh'),
('文件说明', '出口所需文件包括：商业发票、装箱单、原产地证、出口许可证等，我们会协助您准备。', 'documentation', 'zh'),
('跟进提醒', '您好，之前咨询的车型现在有现货，价格也有优惠。请问您还感兴趣吗？', 'followup', 'zh'),
('感谢结束', '感谢您的咨询！如有任何问题，随时联系我。祝您生意兴隆！', 'closing', 'zh'),
('Russian Welcome', 'Здравствуйте! Я менеджер AutoZQ. Какой автомобиль вас интересует?', 'greeting', 'ru'),
('Russian Price', 'Для точной цены нам нужны детали: модель, комплектация, количество. Подождите минуту, я проверю.', 'pricing', 'ru'),
('English Welcome', 'Hello! I am a sales consultant at AutoZQ. How can I help you today?', 'greeting', 'en'),
('English Price', 'For accurate pricing, we need details about the model, configuration, and quantity. Let me check for you.', 'pricing', 'en');

COMMENT ON TABLE quick_replies IS '快捷回复/话术库';
COMMENT ON COLUMN quick_replies.title IS '话术标题';
COMMENT ON COLUMN quick_replies.content IS '话术内容';
COMMENT ON COLUMN quick_replies.category IS '分类：greeting/inquiry/pricing/specification/logistics/payment/documentation/followup/closing';
COMMENT ON COLUMN quick_replies.language IS '语言：zh/ru/en/ar';
COMMENT ON COLUMN quick_replies.usage_count IS '使用次数';
