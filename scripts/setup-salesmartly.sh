#!/bin/bash

# ================================================
# AutoZQ SalesMartly 集成配置脚本
# ================================================

echo "🚀 AutoZQ SalesMartly 集成配置向导"
echo "=================================="
echo ""

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
  echo "📝 创建 .env 文件..."
  cp .env.sales.example .env
  echo "✅ .env 文件已创建"
else
  echo "✅ .env 文件已存在"
fi

echo ""
echo "请输入以下配置信息："
echo ""

# 读取 SalesMartly API Key
read -p "1️⃣ SalesMartly API Key: " SALESMARTLY_API_KEY
if [ ! -z "$SALESMARTLY_API_KEY" ]; then
  # 在 macOS 上使用 sed -i ''，在 Linux 上使用 sed -i
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/SALESMARTLY_API_KEY=.*/SALESMARTLY_API_KEY=$SALESMARTLY_API_KEY/" .env
  else
    sed -i "s/SALESMARTLY_API_KEY=.*/SALESMARTLY_API_KEY=$SALESMARTLY_API_KEY/" .env
  fi
  echo "✅ SalesMartly API Key 已配置"
fi

# 读取 Webhook Secret
read -p "2️⃣ SalesMartly Webhook Secret (可选，回车跳过): " SALESMARTLY_WEBHOOK_SECRET
if [ ! -z "$SALESMARTLY_WEBHOOK_SECRET" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/SALESMARTLY_WEBHOOK_SECRET=.*/SALESMARTLY_WEBHOOK_SECRET=$SALESMARTLY_WEBHOOK_SECRET/" .env
  else
    sed -i "s/SALESMARTLY_WEBHOOK_SECRET=.*/SALESMARTLY_WEBHOOK_SECRET=$SALESMARTLY_WEBHOOK_SECRET/" .env
  fi
  echo "✅ Webhook Secret 已配置"
fi

# 读取 Claude API Key
read -p "3️⃣ Claude API Key (AI功能必需): " ANTHROPIC_API_KEY
if [ ! -z "$ANTHROPIC_API_KEY" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY/" .env
  else
    sed -i "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY/" .env
  fi
  echo "✅ Claude API Key 已配置"
fi

# 读取数据库密码
read -p "4️⃣ PostgreSQL 数据库密码: " DB_PASSWORD
if [ ! -z "$DB_PASSWORD" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
  else
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
  fi
  echo "✅ 数据库密码已配置"
fi

echo ""
echo "=================================="
echo "✅ 配置完成！"
echo ""
echo "📋 下一步："
echo "1. 启动服务：npm run dev"
echo "2. 获取 Webhook URL："
echo ""

# 检测是否在本地环境
if [ "$NODE_ENV" != "production" ]; then
  echo "   本地开发环境，使用 ngrok："
  echo "   $ ngrok http 3001"
  echo ""
  echo "   你的 Webhook URL 将是："
  echo "   https://xxx.ngrok.io/api/webhook/salesmartly/receive"
else
  echo "   生产环境 Webhook URL："
  echo "   https://your-domain.com/api/webhook/salesmartly/receive"
fi

echo ""
echo "3. 在 SalesMartly 配置 Webhook 地址"
echo "4. 测试集成"
echo ""
echo "📚 详细文档：查看 SALESMARTLY_INTEGRATION.md"
echo ""
