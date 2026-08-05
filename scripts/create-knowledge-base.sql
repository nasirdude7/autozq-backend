-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    tags TEXT[], -- 标签数组
    language VARCHAR(10) DEFAULT 'zh',
    view_count INTEGER DEFAULT 0,
    useful_count INTEGER DEFAULT 0, -- 有用计数
    created_by UUID REFERENCES staff_users(id),
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识库分类表
CREATE TABLE IF NOT EXISTS knowledge_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES knowledge_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识库使用记录
CREATE TABLE IF NOT EXISTS knowledge_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff_users(id),
    customer_id UUID REFERENCES customers(id),
    action VARCHAR(20), -- 'view', 'share', 'rate_useful'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_knowledge_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_language ON knowledge_base(language);
CREATE INDEX idx_knowledge_published ON knowledge_base(is_published);
CREATE INDEX idx_knowledge_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_usage_knowledge ON knowledge_usage(knowledge_id);
CREATE INDEX idx_knowledge_usage_staff ON knowledge_usage(staff_id);

-- 预置知识库分类
INSERT INTO knowledge_categories (name, description, sort_order) VALUES
('产品信息', '车辆型号、配置、参数等产品相关信息', 1),
('价格政策', '报价、优惠、付款方式等价格相关', 2),
('物流运输', '运输方式、时效、费用、清关等', 3),
('售后服务', '质保、维修、配件等售后相关', 4),
('流程指南', '订购流程、手续办理等操作指南', 5),
('常见问题', 'FAQ常见问题解答', 6);

-- 预置知识条目（汽车出口业务）
INSERT INTO knowledge_base (title, content, category, tags, language) VALUES
('如何查询车辆配置？',
'您好！查询车辆配置有以下几种方式：

1. **通过VIN码查询**：提供17位车架号，我们可以精确查询到所有配置信息

2. **通过型号查询**：告诉我们品牌和型号，如"丰田凯美瑞2024款2.5L豪华版"

3. **配置清单**：我们可以提供完整的配置清单PDF，包含：
   - 发动机参数
   - 变速箱类型
   - 安全配置
   - 科技配置
   - 舒适性配置

请告诉我您感兴趣的车型，我立即为您查询详细配置！',
'产品信息',
ARRAY['配置', '查询', 'VIN码', '型号'],
'zh'),

('出口报价包含哪些费用？',
'我们的出口报价包含以下内容：

**基础费用**：
- 车辆采购价（含税）
- 国内运输费（工厂→港口）
- 出口商检费
- 报关费用

**可选服务**：
- 国际海运费（FOB/CIF可选）
- 目的港清关代理
- 目的地内陆运输
- 保险费用

**付款方式**：
- 首付30% - 订单确认
- 余款70% - 装船前付清
- 支持T/T电汇、L/C信用证

具体报价请提供：目的港、车型、数量，我们会在2小时内给您详细报价单！',
'价格政策',
ARRAY['报价', '费用', 'FOB', 'CIF', '付款'],
'zh'),

('出口需要哪些手续文件？',
'出口汽车需要准备以下文件：

**必备文件**：
1. 商业发票（Commercial Invoice）
2. 装箱单（Packing List）
3. 原产地证（Certificate of Origin）
4. 车辆一致性证书（COC）
5. 出口许可证

**清关文件**：
6. 提单（Bill of Lading）
7. 保险单（Insurance Policy）
8. 车辆合格证
9. 购车发票复印件

**我们的服务**：
✅ 免费协助准备所有文件
✅ 专业报关行合作
✅ 文件真实性担保
✅ 快速办理（3-5工作日）

所有文件我们都会提供中英文对照版本，确保清关顺利！',
'流程指南',
ARRAY['手续', '文件', '清关', '出口'],
'zh'),

('从中国到俄罗斯运输需要多久？',
'中国到俄罗斯的运输时效：

**海运方式**：
- 中国港口 → 符拉迪沃斯托克：7-10天
- 中国港口 → 圣彼得堡：30-35天
- 中国港口 → 新西伯利亚：25-30天

**陆运方式**：
- 满洲里口岸过境：3-5天（到莫斯科）
- 中欧班列：12-15天（到莫斯科）

**清关时间**：
- 正常情况：2-3个工作日
- 文件齐全可加急：1个工作日

**总时效**：
海运+清关：约15-40天
陆运+清关：约5-20天

我们提供全程跟踪服务，每个节点都会及时通知您！',
'物流运输',
ARRAY['运输', '时效', '俄罗斯', '海运', '陆运'],
'zh'),

('车辆质保政策是什么？',
'我们提供完善的质保服务：

**质保范围**：
✅ 发动机总成
✅ 变速箱总成
✅ 底盘系统
✅ 电气系统

**质保期限**：
- 标准质保：1年或2万公里（先到为准）
- 延保服务：可购买2年或5万公里延保

**质保条件**：
1. 按时保养（提供保养记录）
2. 正常使用（非人为损坏）
3. 原厂配件更换

**售后支持**：
📞 24小时热线支持
🔧 远程技术指导
📦 配件全球发货
🛠️ 合作维修网络

如发现质量问题，请立即联系我们，48小时内给出解决方案！',
'售后服务',
ARRAY['质保', '保修', '售后', '维修'],
'zh'),

('What documents are needed for car export?',
'Required documents for car export:

**Essential Documents**:
1. Commercial Invoice
2. Packing List
3. Certificate of Origin (COC)
4. Vehicle Conformity Certificate
5. Export License

**Customs Clearance**:
6. Bill of Lading (B/L)
7. Insurance Policy
8. Vehicle Certificate
9. Purchase Invoice Copy

**Our Services**:
✅ Free document preparation assistance
✅ Professional customs broker partnership
✅ Document authenticity guarantee
✅ Fast processing (3-5 business days)

All documents provided in Chinese-English bilingual version!',
'流程指南',
ARRAY['documents', 'export', 'customs', 'clearance'],
'en'),

('Какие документы нужны для экспорта автомобиля?',
'Необходимые документы для экспорта автомобиля:

**Основные документы**:
1. Коммерческий инвойс (Commercial Invoice)
2. Упаковочный лист (Packing List)
3. Сертификат происхождения (COC)
4. Сертификат соответствия автомобиля
5. Экспортная лицензия

**Таможенное оформление**:
6. Коносамент (Bill of Lading)
7. Страховой полис
8. Сертификат автомобиля
9. Копия счета-фактуры

**Наши услуги**:
✅ Бесплатная помощь в подготовке документов
✅ Сотрудничество с профессиональным таможенным брокером
✅ Гарантия подлинности документов
✅ Быстрая обработка (3-5 рабочих дней)

Все документы предоставляются на китайском и английском языках!',
'流程指南',
ARRAY['документы', 'экспорт', 'таможня'],
'ru');

COMMENT ON TABLE knowledge_base IS '知识库内容表';
COMMENT ON TABLE knowledge_categories IS '知识库分类表';
COMMENT ON TABLE knowledge_usage IS '知识库使用记录';
