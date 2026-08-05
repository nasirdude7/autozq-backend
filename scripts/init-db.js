import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config({ path: join(__dirname, '../.env') });

async function initializeDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'autozq_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('🔌 连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    // 读取 SQL 文件
    const sqlFile = join(__dirname, 'init-sales-db.sql');
    console.log(`📄 读取 SQL 文件: ${sqlFile}`);
    const sql = readFileSync(sqlFile, 'utf8');

    console.log('🚀 开始执行数据库初始化...\n');

    // 执行 SQL
    await client.query(sql);

    console.log('\n✅ 数据库初始化完成！');
    console.log('\n📊 创建的表：');
    console.log('  - users (用户表)');
    console.log('  - customers (客户表)');
    console.log('  - conversations (会话表)');
    console.log('  - messages (消息表)');
    console.log('  - customer_profiles (客户画像表)');
    console.log('  - customer_ratings (客户评级表)');
    console.log('  - quick_replies (快捷回复表)');
    console.log('  - customer_vehicles (客户意向车型表)');
    console.log('  - follow_ups (跟进记录表)');
    console.log('  - assignment_logs (分配记录表)');
    console.log('  - agent_stats (客服统计表)');
    console.log('  - whatsapp_accounts (WhatsApp账号表)');
    console.log('\n💡 提示：');
    console.log('  1. 默认管理员账号需要手动设置密码');
    console.log('  2. 请修改 .env 文件中的数据库配置');
    console.log('  3. 生产环境请修改默认的 JWT_SECRET');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('\n详细错误:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行初始化
initializeDatabase();
