#!/bin/bash

echo "🔧 AutoZQi 多站点配置助手"
echo "=============================="
echo ""

# 检查sites.json是否存在
if [ -f "config/sites.json" ]; then
    echo "⚠️  发现已有配置: config/sites.json"
    read -p "是否覆盖? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "❌ 取消操作"
        exit 0
    fi
fi

# 复制示例配置
cp config/sites.example.json config/sites.json
echo "✅ 已创建 config/sites.json"
echo ""

# 引导用户填写配置
echo "📝 请编辑 config/sites.json 填写你的站点信息："
echo ""
echo "需要配置的字段："
echo "  - wordpress.url: 你的WordPress站点地址"
echo "  - wordpress.username: WordPress管理员账号"
echo "  - wordpress.app_password: WordPress应用密码"
echo "  - seo.base_url: SEO基础URL（通常与wordpress.url相同）"
echo ""

# 根据操作系统打开编辑器
if command -v code &> /dev/null; then
    echo "🖊️  使用 VSCode 打开配置文件..."
    code config/sites.json
elif command -v nano &> /dev/null; then
    echo "🖊️  使用 nano 打开配置文件..."
    nano config/sites.json
elif command -v vim &> /dev/null; then
    echo "🖊️  使用 vim 打开配置文件..."
    vim config/sites.json
else
    echo "⚠️  请手动编辑: config/sites.json"
fi

echo ""
echo "✅ 配置完成！"
echo ""
echo "📋 下一步："
echo "  1. 确认 .gitignore 包含 config/sites.json"
echo "  2. 重启后端: npm start"
echo "  3. 查看日志确认站点已加载"
echo ""
echo "🛡️  安全提醒："
echo "  - config/sites.json 包含敏感信息，不要提交到 git"
echo "  - 协作者应该复制此文件并填写自己的配置"
