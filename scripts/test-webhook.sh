#!/bin/bash

# ================================================
# AutoZQ Webhook 测试脚本
# ================================================

BASE_URL=${1:-"http://localhost:3001"}

echo "🧪 AutoZQ Webhook 测试"
echo "======================"
echo "测试服务器: $BASE_URL"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
PASSED=0
FAILED=0

# 测试函数
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4

  echo -n "测试: $name ... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✅ 通过${NC} (HTTP $http_code)"
    ((PASSED++))
  else
    echo -e "${RED}❌ 失败${NC} (HTTP $http_code)"
    echo "响应: $body"
    ((FAILED++))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  基础测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试健康检查
test_endpoint "健康检查" "GET" "/api/webhook/health"

# 测试测试端点
test_endpoint "测试端点" "POST" "/api/webhook/test" '{"test": "message"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Webhook 功能测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试简单文本消息
test_endpoint "接收简单文本" "POST" "/api/webhook/salesmartly/receive" '{
  "message_id": "test_msg_001",
  "conversation_id": "test_conv_001",
  "customer": {
    "id": "test_cust_001",
    "name": "Test Customer",
    "phone": "+1234567890",
    "country": "USA",
    "language": "en"
  },
  "message": {
    "text": "Hello, I want to buy a car",
    "type": "text"
  },
  "platform": "whatsapp",
  "sender_type": "customer",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

# 测试多语言消息（俄语）
test_endpoint "接收俄语消息" "POST" "/api/webhook/salesmartly/receive" '{
  "message_id": "test_msg_002",
  "conversation_id": "test_conv_002",
  "customer": {
    "id": "test_cust_002",
    "name": "Ivan Petrov",
    "phone": "+79001234567",
    "country": "Russia",
    "language": "ru"
  },
  "message": {
    "text": "Я хочу купить Toyota Camry",
    "type": "text"
  },
  "platform": "whatsapp",
  "sender_type": "customer",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

# 测试询价消息
test_endpoint "接收询价消息" "POST" "/api/webhook/salesmartly/receive" '{
  "message_id": "test_msg_003",
  "conversation_id": "test_conv_003",
  "customer": {
    "id": "test_cust_003",
    "name": "Ahmed Hassan",
    "phone": "+966501234567",
    "country": "Saudi Arabia",
    "language": "ar"
  },
  "message": {
    "text": "كم سعر سيارة تويوتا؟",
    "type": "text"
  },
  "platform": "whatsapp",
  "sender_type": "customer",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  边界情况测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 测试空消息
test_endpoint "接收空消息" "POST" "/api/webhook/salesmartly/receive" '{
  "message_id": "test_msg_004",
  "conversation_id": "test_conv_004",
  "customer": {
    "id": "test_cust_004",
    "name": "Empty Test",
    "phone": "+1234567891"
  },
  "message": {
    "text": "",
    "type": "text"
  },
  "platform": "whatsapp",
  "sender_type": "customer",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

# 测试客服消息（应被忽略）
test_endpoint "客服消息（应忽略）" "POST" "/api/webhook/salesmartly/receive" '{
  "message_id": "test_msg_005",
  "conversation_id": "test_conv_005",
  "customer": {
    "id": "agent_001",
    "name": "Agent"
  },
  "message": {
    "text": "This is from agent",
    "type": "text"
  },
  "platform": "whatsapp",
  "sender_type": "agent",
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试结果汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "✅ 通过: ${GREEN}$PASSED${NC}"
echo -e "❌ 失败: ${RED}$FAILED${NC}"
echo -e "📋 总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 所有测试通过！${NC}"
  echo ""
  echo "✅ Webhook 服务正常运行"
  echo "✅ 可以在 SalesMartly 配置 Webhook 地址了"
  echo ""
  echo "📝 Webhook URL:"
  echo "   $BASE_URL/api/webhook/salesmartly/receive"
  exit 0
else
  echo -e "${RED}⚠️ 部分测试失败${NC}"
  echo ""
  echo "请检查："
  echo "1. 服务器是否正在运行（npm run dev）"
  echo "2. 数据库连接是否正常"
  echo "3. Claude API Key 是否配置"
  echo "4. 查看服务器日志获取详细错误"
  exit 1
fi
