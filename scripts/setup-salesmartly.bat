@echo off
chcp 65001 >nul
echo.
echo ========================================
echo 🚀 AutoZQ SalesMartly 集成配置向导
echo ========================================
echo.

REM 检查 .env 文件是否存在
if not exist ".env" (
  echo 📝 创建 .env 文件...
  copy .env.sales.example .env >nul
  echo ✅ .env 文件已创建
) else (
  echo ✅ .env 文件已存在
)

echo.
echo 请输入以下配置信息：
echo （从 SalesMartly AI 员工配置页面获取）
echo.

REM 读取 SalesMartly AccessToken
set /p SALESMARTLY_ACCESS_TOKEN="1️⃣  SalesMartly AccessToken（必需）: "
if not "%SALESMARTLY_ACCESS_TOKEN%"=="" (
  powershell -Command "(Get-Content .env) -replace 'SALESMARTLY_ACCESS_TOKEN=.*', 'SALESMARTLY_ACCESS_TOKEN=%SALESMARTLY_ACCESS_TOKEN%' | Set-Content .env"
  echo ✅ SalesMartly AccessToken 已配置
) else (
  echo ⚠️  警告：AccessToken 为空，消息回复将失败
)

REM 读取 Webhook Secret
set /p SALESMARTLY_WEBHOOK_SECRET="2️⃣  SalesMartly Webhook Secret (可选，回车跳过): "
if not "%SALESMARTLY_WEBHOOK_SECRET%"=="" (
  powershell -Command "(Get-Content .env) -replace 'SALESMARTLY_WEBHOOK_SECRET=.*', 'SALESMARTLY_WEBHOOK_SECRET=%SALESMARTLY_WEBHOOK_SECRET%' | Set-Content .env"
  echo ✅ Webhook Secret 已配置
)

REM 读取 Claude API Key
set /p ANTHROPIC_API_KEY="3️⃣  Claude API Key (AI功能必需): "
if not "%ANTHROPIC_API_KEY%"=="" (
  powershell -Command "(Get-Content .env) -replace 'ANTHROPIC_API_KEY=.*', 'ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY%' | Set-Content .env"
  echo ✅ Claude API Key 已配置
) else (
  echo ⚠️  警告：Claude API Key 为空，AI 功能将无法使用
)

REM 读取数据库密码
set /p DB_PASSWORD="4️⃣  PostgreSQL 数据库密码: "
if not "%DB_PASSWORD%"=="" (
  powershell -Command "(Get-Content .env) -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=%DB_PASSWORD%' | Set-Content .env"
  echo ✅ 数据库密码已配置
)

echo.
echo ========================================
echo ✅ 配置完成！
echo.
echo 📋 下一步：
echo.
echo 1. 启动 AutoZQ 服务：
echo    cd backend
echo    npm run dev
echo.
echo 2. 获取公网 Webhook URL：
echo.
echo    方式 A - 使用 ngrok（推荐用于本地测试）：
echo    $ npm install -g ngrok
echo    $ ngrok http 3001
echo.
echo    你会得到类似这样的 URL：
echo    https://abc123def.ngrok.io
echo.
echo    你的消息接收地址就是：
echo    https://abc123def.ngrok.io/api/webhook/salesmartly/receive
echo.
echo    方式 B - 生产环境使用自己的域名：
echo    https://your-domain.com/api/webhook/salesmartly/receive
echo.
echo 3. 在 SalesMartly 创建 AI 员工：
echo    - 昵称：AutoZQ AI 助手
echo    - 消息接收地址：填写上面的 URL
echo    - 复制生成的 AccessToken
echo    - 如果 AccessToken 与输入的不同，请重新运行此脚本
echo.
echo 4. 测试 Webhook：
echo    访问健康检查：https://your-url/api/webhook/health
echo.
echo 📚 详细文档：
echo    - SALESMARTLY_SETUP_GUIDE.md（实战配置指南）
echo    - SALESMARTLY_INTEGRATION.md（完整技术文档）
echo.
pause
