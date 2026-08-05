-- 产品库表（整车车型库）
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand VARCHAR(100) NOT NULL,                    -- 品牌（Toyota, BYD, Ford...）
    model VARCHAR(200) NOT NULL,                    -- 车型（Camry, Seal, F-150...）
    year INTEGER,                                   -- 年款（2024, 2023...）
    variant VARCHAR(200),                           -- 配置版本（2.5L Luxury, AWD Performance...）
    category VARCHAR(50) DEFAULT 'sedan',           -- 类别: sedan/suv/pickup/ev/truck/van
    price DECIMAL(12,2),                            -- 价格
    currency VARCHAR(10) DEFAULT 'USD',             -- 币种
    specs JSONB DEFAULT '{}',                       -- 配置参数 JSON: {engine, transmission, horsepower, torque, fuel_type, drive_type, seats, range_km...}
    description TEXT,                               -- 卖点/描述（支持多语言，坐席自己写或AI生成）
    images TEXT[] DEFAULT '{}',                     -- 车图数组（公网可访问URL）
    stock_status VARCHAR(20) DEFAULT 'in_stock',    -- 库存状态: in_stock/pre_order/out_of_stock
    tags TEXT[] DEFAULT '{}',                       -- 标签（热销/新能源/四驱/七座...）
    is_active BOOLEAN DEFAULT TRUE,                 -- 上架/下架
    created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_stock_status ON products(stock_status);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_specs ON products USING GIN(specs);

-- 预置示例车型（汽车出口业务常见车型）
INSERT INTO products (brand, model, year, variant, category, price, currency, specs, description, images, stock_status, tags) VALUES
(
    'Toyota',
    'Camry',
    2024,
    '2.5L Luxury',
    'sedan',
    28500.00,
    'USD',
    '{"engine": "2.5L Inline-4", "transmission": "8-Speed Automatic", "horsepower": "203 hp", "torque": "184 lb-ft", "fuel_type": "Gasoline", "drive_type": "FWD", "seats": 5, "fuel_economy": "28 city / 39 highway mpg", "safety": "8 airbags, Toyota Safety Sense 3.0"}'::jsonb,
    '🔥 热销车型！丰田凯美瑞 2024 款豪华版，动力充沛，油耗经济，配置丰富。TSS 3.0 主动安全系统，8 气囊全方位防护。适合家用/商务，出口俄罗斯/中东/非洲热门选择。',
    ARRAY['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800'],
    'in_stock',
    ARRAY['热销', '家用', '省油', '可靠']
),
(
    'BYD',
    'Seal',
    2024,
    'AWD Performance',
    'ev',
    32000.00,
    'USD',
    '{"motor": "Dual Motor AWD", "battery": "82.5 kWh", "range_km": 650, "horsepower": "530 hp", "torque": "670 Nm", "drive_type": "AWD", "seats": 5, "acceleration": "3.8s (0-100km/h)", "charging": "DC fast charge 30min (30%-80%)"}'::jsonb,
    '⚡ 比亚迪海豹 2024 四驱性能版，纯电动轿跑，续航 650km，3.8秒破百。搭载刀片电池，安全可靠。CTB 车身电池一体化技术，操控媲美百万豪车。新能源出口爆款，欧洲/东南亚热销。',
    ARRAY['https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800'],
    'in_stock',
    ARRAY['新能源', '纯电', '四驱', '性能', '热销']
),
(
    'Ford',
    'F-150',
    2023,
    'XLT 4WD SuperCrew',
    'pickup',
    45000.00,
    'USD',
    '{"engine": "3.5L EcoBoost V6", "transmission": "10-Speed Automatic", "horsepower": "400 hp", "torque": "500 lb-ft", "fuel_type": "Gasoline", "drive_type": "4WD", "seats": 5, "towing_capacity": "13,200 lbs", "payload": "3,325 lbs", "bed_length": "5.5 ft"}'::jsonb,
    '🚛 美式皮卡之王！福特 F-150 XLT 四驱版，3.5T EcoBoost 发动机，400 马力强劲动力，拖曳能力 13,200 磅。SuperCrew 双排座，空间宽敞。工程/农业/越野全能，中东/非洲/拉美热销。',
    ARRAY['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800'],
    'pre_order',
    ARRAY['皮卡', '四驱', '大排量', '越野', '工程']
),
(
    'Mercedes-Benz',
    'GLE 450',
    2024,
    '4MATIC SUV',
    'suv',
    68000.00,
    'USD',
    '{"engine": "3.0L Inline-6 Turbo + 48V Mild Hybrid", "transmission": "9-Speed Automatic", "horsepower": "362 hp", "torque": "369 lb-ft", "fuel_type": "Hybrid", "drive_type": "AWD", "seats": 5, "features": "MBUX, Air Suspension, 360 Camera, Burmester Audio"}'::jsonb,
    '🌟 豪华 SUV 标杆！奔驰 GLE 450 四驱，3.0T + 48V 轻混，动力平顺，空气悬挂舒适。MBUX 智能系统，柏林之声音响，360 全景影像。欧洲/中东高端市场首选。',
    ARRAY['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800'],
    'in_stock',
    ARRAY['豪华', 'SUV', '四驱', '轻混', '高端']
),
(
    'Chery',
    'Tiggo 8 Pro',
    2023,
    '1.6T DCT Luxury',
    'suv',
    18500.00,
    'USD',
    '{"engine": "1.6T Inline-4", "transmission": "7-Speed DCT", "horsepower": "197 hp", "torque": "290 Nm", "fuel_type": "Gasoline", "drive_type": "FWD", "seats": 7, "fuel_economy": "7.4L/100km", "features": "Panoramic Sunroof, 360 Camera, Adaptive Cruise"}'::jsonb,
    '✨ 高性价比七座 SUV！奇瑞瑞虎 8 Pro，1.6T 动力充沛，7 座大空间，全景天窗，360 全景影像，ACC 自适应巡航。南美/中东/非洲出口热销，性价比之王。',
    ARRAY['https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800'],
    'in_stock',
    ARRAY['七座', 'SUV', '性价比', '家用', '热销']
);

COMMENT ON TABLE products IS '产品库（整车车型库）';
COMMENT ON COLUMN products.brand IS '品牌';
COMMENT ON COLUMN products.model IS '车型';
COMMENT ON COLUMN products.year IS '年款';
COMMENT ON COLUMN products.variant IS '配置版本';
COMMENT ON COLUMN products.category IS '类别: sedan轿车/suv/pickup皮卡/ev纯电/truck卡车/van面包车';
COMMENT ON COLUMN products.specs IS '配置参数 JSON: engine, transmission, horsepower, torque, fuel_type, drive_type, seats, range_km等';
COMMENT ON COLUMN products.description IS '卖点/描述（可多语言）';
COMMENT ON COLUMN products.images IS '车图数组（公网可访问URL）';
COMMENT ON COLUMN products.stock_status IS '库存状态: in_stock现货/pre_order期货/out_of_stock无货';
COMMENT ON COLUMN products.tags IS '标签数组（热销/新能源/四驱/七座...）';
