#!/usr/bin/env bash
# 全 API 连通性测试。用法: bash test-all-apis.sh
BASE="http://localhost:3001"
PASS=0; FAIL=0; SKIP=0
RESULTS=""

# 登录拿 token
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})")

if [ -z "$TOKEN" ]; then echo "❌ 登录失败,无法测试受保护端点"; fi
AUTH="Authorization: Bearer $TOKEN"

# 测试函数: name method path expected_codes [need_auth] [json_body]
t() {
  local name="$1" method="$2" path="$3" expect="$4" auth="$5" body="$6"
  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$BASE$path")
  [ "$auth" = "auth" ] && args+=(-H "$AUTH")
  if [ -n "$body" ]; then args+=(-H "Content-Type: application/json" -d "$body"); fi
  local code=$(curl "${args[@]}")
  if echo "$expect" | grep -qw "$code"; then
    RESULTS="$RESULTS\n✅ [$code] $name ($method $path)"; PASS=$((PASS+1))
  else
    RESULTS="$RESULTS\n❌ [$code, 期望$expect] $name ($method $path)"; FAIL=$((FAIL+1))
  fi
}
skip() { RESULTS="$RESULTS\n⏭️  跳过(破坏性/需外部服务): $1"; SKIP=$((SKIP+1)); }

echo "开始测试... token: ${TOKEN:0:12}..."

### --- 公开端点(无需认证) ---
t "根路径"            GET  "/"                          200
t "车辆健康检查"       GET  "/api/vehicle/health"        200
t "汇率"              GET  "/api/exchange/rate"          "200 500"
t "站点列表"          GET  "/api/sites/list"             200
t "默认站点"          GET  "/api/sites/default"          200
t "webhook健康"       GET  "/api/webhook/health"         200
t "登录(正确)"        POST "/api/auth/login"             200 "" '{"username":"admin","password":"admin123"}'
t "登录(错误密码)"    POST "/api/auth/login"             401 "" '{"username":"admin","password":"wrong"}'
t "登出"              POST "/api/auth/logout"            200

### --- 认证边界: 不带 token 应 401 ---
t "销售客户(无token)"  GET  "/api/sales/customers"        401
t "聊天会话(无token)"  GET  "/api/sales/chat/conversations" 401
t "统计(无token)"     GET  "/api/sales/stats/dashboard"   401
t "管理员用户(无token)" GET "/api/admin/users"            "401 403"

### --- 销售: 客户(带token) ---
t "客户列表"          GET  "/api/sales/customers?limit=3" 200 auth
t "客户搜索"          GET  "/api/sales/customers/search?q=test" "200 400" auth
t "批量分析"          POST "/api/sales/customers/batch/analyze" "200 400 500" auth '{"customer_ids":[]}'

### --- 销售: 聊天(带token) ---
t "会话列表"          GET  "/api/sales/chat/conversations?limit=3" 200 auth
t "会话搜索"          GET  "/api/sales/chat/search?q=hi"  "200 400" auth
t "翻译"              POST "/api/sales/chat/translate"    200 auth '{"text":"hello","target_language":"ru","source_language":"en"}'
t "意图分析"          POST "/api/sales/chat/analyze-intent" "200 400 500" auth '{"message":"how much"}'
t "建议回复"          POST "/api/sales/chat/suggest-replies" "200 400 500" auth '{"message":"price?"}'

### --- 销售: 统计(带token) ---
t "统计-仪表盘"       GET  "/api/sales/stats/dashboard"   200 auth
t "统计-业务员"       GET  "/api/sales/stats/agents"      200 auth
t "统计-客户"         GET  "/api/sales/stats/customers"   200 auth
t "统计-会话"         GET  "/api/sales/stats/conversations" 200 auth
t "统计-实时"         GET  "/api/sales/stats/realtime"    200 auth

### --- 销售: 知识库(带token) ---
t "知识库搜索"        GET  "/api/sales/knowledge/search?q=car" "200 400" auth
t "知识库统计"        GET  "/api/sales/knowledge/stats"   200 auth
t "推荐回复"          POST "/api/sales/knowledge/recommend-reply" "200 400 500" auth '{"message":"hello"}'

### --- 销售: 单据(带token) ---
t "单据统计"          GET  "/api/sales/documents/stats/overview" 200 auth

### --- 管理员(带token) ---
t "管理员-用户列表"    GET  "/api/admin/users"            200 auth
t "管理员-配置"       GET  "/api/admin/config"           200 auth
t "管理员-站点"       GET  "/api/admin/sites"            200 auth
t "管理员-统计"       GET  "/api/admin/stats"            200 auth

### --- 其他模块 ---
t "wordpress测试"     GET  "/api/wordpress/test"         "200 500"
t "telegram测试"      GET  "/api/telegram/test"          "200 500"

### --- 客户会员端: 手机号+验证码登录 + 报价 ---
# 依赖 SMS_PROVIDER=none(桩) 且非生产环境，request-code 会回传 dev_code
CPHONE="+7900$(date +%s | tail -c 8)"
t "客户-请求验证码"    POST "/api/customer/auth/request-code" 200 "" "{\"phone\":\"$CPHONE\",\"lang\":\"ru\"}"
t "客户-请求验证码(空号)" POST "/api/customer/auth/request-code" 400 "" '{"phone":""}'
# 取 dev_code(需再请求一次并解析；60秒节流，故换个号)
CPHONE2="+7901$(date +%s | tail -c 8)"
CJSON=$(curl -s -X POST "$BASE/api/customer/auth/request-code" -H "Content-Type: application/json" -d "{\"phone\":\"$CPHONE2\",\"lang\":\"ru\"}")
DEVCODE=$(echo "$CJSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).dev_code||'')}catch(e){console.log('')}})")
t "客户-错误验证码"    POST "/api/customer/auth/verify" 400 "" "{\"phone\":\"$CPHONE2\",\"code\":\"000000\"}"
# 用正确 dev_code 登录拿客户 token
CVERIFY=$(curl -s -X POST "$BASE/api/customer/auth/verify" -H "Content-Type: application/json" -d "{\"phone\":\"$CPHONE2\",\"code\":\"$DEVCODE\",\"name\":\"API Test\"}")
CTOKEN=$(echo "$CVERIFY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch(e){console.log('')}})")
CAUTH="Authorization: Bearer $CTOKEN"
if [ -n "$CTOKEN" ]; then
  RESULTS="$RESULTS\n✅ [200] 客户-验证码登录(拿到token) (POST /api/customer/auth/verify)"; PASS=$((PASS+1))
else
  RESULTS="$RESULTS\n❌ 客户-验证码登录失败(无token) (POST /api/customer/auth/verify)"; FAIL=$((FAIL+1))
fi
# 客户 token 访问自己的接口
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/customer/me" -H "$CAUTH")
[ "$code" = "200" ] && { RESULTS="$RESULTS\n✅ [200] 客户-我的资料 (GET /api/customer/me)"; PASS=$((PASS+1)); } || { RESULTS="$RESULTS\n❌ [$code] 客户-我的资料"; FAIL=$((FAIL+1)); }
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/customer/quotations" -H "$CAUTH")
[ "$code" = "200" ] && { RESULTS="$RESULTS\n✅ [200] 客户-我的报价 (GET /api/customer/quotations)"; PASS=$((PASS+1)); } || { RESULTS="$RESULTS\n❌ [$code] 客户-我的报价"; FAIL=$((FAIL+1)); }
# 隔离: 客户 token 不能访问员工接口(应 403)
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/sales/customers" -H "$CAUTH")
[ "$code" = "403" ] && { RESULTS="$RESULTS\n✅ [403] 隔离-客户token禁止访问员工接口 (GET /api/sales/customers)"; PASS=$((PASS+1)); } || { RESULTS="$RESULTS\n❌ [$code,期望403] 隔离-客户token访问员工接口"; FAIL=$((FAIL+1)); }
# 隔离: 员工 token 不能访问客户受保护接口(应 403)
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/customer/me" -H "$AUTH")
[ "$code" = "403" ] && { RESULTS="$RESULTS\n✅ [403] 隔离-员工token禁止访问客户接口 (GET /api/customer/me)"; PASS=$((PASS+1)); } || { RESULTS="$RESULTS\n❌ [$code,期望403] 隔离-员工token访问客户接口"; FAIL=$((FAIL+1)); }
# 客户接口无 token 应 401
t "客户-报价(无token)"  GET "/api/customer/quotations" 401

### --- 破坏性/需外部服务: 跳过 ---
skip "DELETE /api/admin/users/:id (删用户)"
skip "DELETE /api/sales/customers/:id (删客户)"
skip "POST /api/vehicle/recognize (需图片+AI)"
skip "POST /api/article/generate (AI长任务)"
skip "POST /api/image/replace-background (需图片+AI)"
skip "POST /api/pdf/generate (需数据)"
skip "POST /api/seo/generate (AI长任务)"
skip "POST /api/telegram/publish-* (会真发TG)"
skip "POST /api/wordpress/publish-article (会真发WP)"
skip "POST /api/webhook/salesmartly/receive (需签名+真实payload)"

echo -e "$RESULTS"
echo ""
echo "========================================"
echo "✅ 通过: $PASS   ❌ 失败: $FAIL   ⏭️ 跳过: $SKIP"
echo "========================================"
