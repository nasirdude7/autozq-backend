import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import http from 'http';
import vehicleRouter from './routes/vehicle.js';
import configRouter from './routes/config.js';
import pdfRouter from './routes/pdf.js';
import imageRouter from './routes/image.js';
import wordpressRouter from './routes/wordpress.js';
import exchangeRouter from './routes/exchange.js';
import seoRouter from './routes/seo.js';
import sitesRouter from './routes/sites.js';
import articleRouter from './routes/article.js';
import authRouter from './routes/auth.js';
import telegramRouter from './routes/telegram.js';
import adminRouter from './routes/admin.js';
// 销售工作台路由
import customersRouter from './routes/customers.js';
import chatRouter from './routes/chat.js';
import statsRouter from './routes/stats.js';
import webhookRouter from './routes/webhook.js';
import knowledgeRouter from './routes/knowledge.js';
import documentsRouter from './routes/documents.js';
import customerRouter from './routes/customer.js';
// 员工权限系统路由
import staffRouter from './routes/staff.js';
import labelsRouter from './routes/labels.js';
import assignmentsRouter from './routes/assignments.js';
import messagesRouter from './routes/messages.js';
import quickRepliesRouter from './routes/quickReplies.js';
import analysisRouter from './routes/analysis.js';
import analyticsRouter from './routes/analytics.js';
import dealersRouter from './routes/dealers.js';
import productsRouter from './routes/products.js';
// 认证中间件
import { authenticateToken } from './middleware/auth.js';
// 服务
import { loadSitesConfig } from './services/siteConfig.js';
import socketService from './services/SocketService.js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';

// 启动时校验关键环境变量（生产环境缺失则拒绝启动，避免带着不安全配置上线）
(function validateEnv() {
  const problems = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'autozq-secret-key-change-in-production') {
    problems.push('JWT_SECRET 未设置或仍是默认值');
  }

  if (IS_PROD) {
    if (!process.env.CORS_ORIGIN) {
      problems.push('生产环境必须设置 CORS_ORIGIN（允许访问的前端域名，逗号分隔）');
    }
    if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'postgres') {
      problems.push('生产环境 DB_PASSWORD 未设置或仍是默认弱密码 postgres');
    }
  }

  if (problems.length > 0) {
    console.error('\n❌ 环境变量校验失败，服务拒绝启动：');
    problems.forEach((p) => console.error(`   - ${p}`));
    if (IS_PROD) {
      console.error('   请修正后重启。\n');
      process.exit(1);
    } else {
      console.warn('   ⚠️  开发环境仅警告，生产环境(NODE_ENV=production)将拒绝启动。\n');
    }
  }
})();

// 配置全局代理（如果设置了环境变量且值不为空）
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

  // 检查代理值是否为空字符串（禁用代理的标志）
  if (proxyUrl && proxyUrl.trim() !== '') {
    console.log(`🌐 使用代理: ${proxyUrl}`);

    // 使用 undici 设置全局代理（这会影响所有 fetch 请求）
    const proxyAgent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(proxyAgent);

    console.log('✅ 全局代理已配置');
  } else {
    console.log('ℹ️  代理已禁用（HTTP_PROXY/HTTPS_PROXY 设为空值）');
  }
}

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3001;

// 创建 HTTP 服务器（用于 Socket.IO）
const server = http.createServer(app);

// 安全响应头
app.use(helmet({
  // 前端是同源静态页，关掉 CSP 避免误伤内联脚本/样式；如需更严格可后续单独配置
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS：生产读白名单（CORS_ORIGIN，逗号分隔），开发放开
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // 同源请求（无 origin，如 curl/服务端）或非生产环境：放行
    if (!origin || !IS_PROD) return callback(null, true);
    if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS 不允许的来源'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 请求体限制：默认 2mb（图片/上传接口如需更大，可在对应路由单独放宽）
// verify 回调保存原始请求字节到 req.rawBody：Webhook 签名校验必须对“发送方实际签名的原始字节”
// 做 HMAC，而不是对 JSON.parse→JSON.stringify 往返后的结果（西里尔文等非 ASCII 转义差异会导致误拒）。
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 限流：全局每 IP 15 分钟 1000 次；登录接口更严（防暴力破解）
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录尝试过于频繁，请稍后再试' }
});
app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/auth', authRouter);          // 认证路由（登录）
app.use('/api/admin', adminRouter);        // 管理员路由
app.use('/api/vehicle', vehicleRouter);
app.use('/api/vehicle', configRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/image', imageRouter);
app.use('/api/wordpress', wordpressRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api/seo', seoRouter);
app.use('/api/sites', sitesRouter);
app.use('/api/article', articleRouter);
app.use('/api/telegram', telegramRouter);  // Telegram发布路由

// 销售工作台路由（均需登录：注入 authenticateToken，前端须带 Bearer token）
app.use('/api/sales/customers', authenticateToken, customersRouter);  // 客户管理
app.use('/api/sales/chat', authenticateToken, chatRouter);            // 聊天功能
app.use('/api/sales/stats', authenticateToken, statsRouter);          // 统计数据
app.use('/api/sales/knowledge', authenticateToken, knowledgeRouter);  // 知识库
app.use('/api/sales/documents', authenticateToken, documentsRouter);  // 单据管理
// 员工权限系统路由
app.use('/api/staff', staffRouter);                   // 员工管理（包含登录，部分端点需要鉴权）
app.use('/api/labels', authenticateToken, labelsRouter);              // 标签管理
app.use('/api/assignments', authenticateToken, assignmentsRouter);    // 客户分配
app.use('/api/messages', authenticateToken, messagesRouter);          // 消息发送和翻译
app.use('/api/quick-replies', authenticateToken, quickRepliesRouter); // 快捷回复/话术库
app.use('/api/analysis', authenticateToken, analysisRouter);          // AI客户分析
app.use('/api/analytics', authenticateToken, analyticsRouter);        // 数据分析仪表板
app.use('/api/dealers', authenticateToken, dealersRouter);            // B端经销商监控（超管专属）
app.use('/api/products', authenticateToken, productsRouter);          // 产品库（整车车型库）
// Webhook 独立鉴权（SalesMartly 的 Bearer token + HMAC 签名，不走用户 JWT）
app.use('/api/webhook', webhookRouter);            // Webhook 集成
// 客户端路由（面向客户：手机号+验证码登录、查看报价。独立的客户 JWT，受保护接口在路由内部处理）
app.use('/api/customer', customerRouter);          // 客户会员端

// 静态文件服务（访问上传的图片）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 前端静态文件服务
app.use(express.static(path.join(__dirname, '../../frontend')));

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '车辆出口营销工作台 API',
    version: '1.0.0',
    modules: {
      vehicle: '车辆营销模块',
      sales: '销售工作台模块'
    },
    endpoints: {
      vehicleRecognize: 'POST /api/vehicle/recognize',
      health: 'GET /api/vehicle/health',
      salesCustomers: 'GET /api/sales/customers',
      salesChat: 'GET /api/sales/chat/conversations',
      salesStats: 'GET /api/sales/stats/dashboard'
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 全局错误处理：生产环境返回通用错误，避免泄露 SQL/表结构等内部细节
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  // CORS 拒绝
  if (err && err.message === 'CORS 不允许的来源') {
    return res.status(403).json({ success: false, error: '来源不被允许' });
  }
  res.status(err.status || 500).json({
    success: false,
    error: IS_PROD ? '服务器内部错误' : (err.message || '服务器内部错误')
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`\n🚀 服务器已启动`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌍 访问地址: http://localhost:${PORT}`);
  console.log(`🔑 API Key 已配置: ${process.env.ANTHROPIC_API_KEY ? '是' : '否'}`);

  // 初始化 Socket.IO
  socketService.initialize(server);
  console.log(`🔌 Socket.IO 已启动: ws://localhost:${PORT}`);

  // 加载站点配置
  try {
    loadSitesConfig();
  } catch (error) {
    console.error('⚠️  站点配置加载失败:', error.message);
  }

  console.log('');
});

// 进程级异常捕获：记录日志但不让单个未捕获错误直接崩掉整个服务
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
});

export default app;
