-- ================================================
-- 客户会员登录 + 报价查看 数据库扩展
-- 说明：手机号 + 验证码自助注册登录（无密码），报价发布到个人中心
-- 幂等：可重复执行；每次新服务器部署都需运行一次
-- 依赖：extend-sales-db.sql（quotations 表）必须先执行
-- ================================================

-- 1. 客户短信验证码表（一次性、5分钟过期、限尝试）
CREATE TABLE IF NOT EXISTS customer_sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,        -- 校验尝试次数（防暴力）
  ip VARCHAR(64),                    -- 请求来源 IP（风控/审计）
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sms_codes_phone ON customer_sms_codes(phone);
CREATE INDEX IF NOT EXISTS idx_customer_sms_codes_expires ON customer_sms_codes(expires_at);

-- 2. customers 表增加会员认证字段（自助注册无需密码，验证码即认证）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- ================================================
-- 完成
-- ================================================
COMMENT ON TABLE customer_sms_codes IS '客户端手机验证码（一次性、限时、限尝试）';

SELECT 'Customer Portal Tables Ready!' as status;
