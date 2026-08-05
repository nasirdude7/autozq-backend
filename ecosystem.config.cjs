/**
 * PM2 进程管理配置
 *
 * 用法（在 backend 目录）：
 *   pm2 start ecosystem.config.cjs        # 启动
 *   pm2 restart autozq-backend            # 重启
 *   pm2 logs autozq-backend               # 看日志
 *   pm2 stop autozq-backend               # 停止
 *   pm2 startup && pm2 save               # 开机自启 + 保存当前进程列表
 *
 * 崩溃会自动重启；内存超限也会重启，保证服务稳定。
 * 注意：文件名用 .cjs 后缀，因为 package.json 里 "type":"module"，
 *       pm2 配置需要 CommonJS 格式。
 */
module.exports = {
  apps: [
    {
      name: 'autozq-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,            // 有 Socket.IO 单例状态，先用单进程；如需多核可上 Redis 适配器后改 cluster
      exec_mode: 'fork',
      autorestart: true,       // 崩溃自动重启
      max_restarts: 10,        // 短时间内最多重启次数，超过则停止（防止无限崩溃循环）
      min_uptime: '10s',
      max_memory_restart: '500M', // 内存超 500M 自动重启
      env: {
        NODE_ENV: 'production'
      },
      // 日志
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true               // 日志加时间戳
    }
  ]
};
