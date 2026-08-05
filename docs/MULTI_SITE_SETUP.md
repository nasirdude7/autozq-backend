# 多站点配置指南

## 🏗️ 架构说明

本系统支持**多站点多国家**配置，实现：
- ✅ **敏感信息隔离**：真实站点配置不提交到git
- ✅ **多人协作安全**：协作者看不到你的真实WordPress账号和域名
- ✅ **灵活扩展**：轻松添加新国家、新站点

---

## 📁 配置文件结构

```
backend/
├── config/
│   ├── sites.json            # 真实配置（git忽略，保密）
│   └── sites.example.json    # 示例配置（提交git，公开）
├── .gitignore                # 包含 config/sites.json
└── .env                      # API密钥等（git忽略）
```

---

## 🔐 安全机制

### **1. .gitignore 保护**
```
# .gitignore
config/sites.json     # 你的真实配置，永远不提交
.env                  # API密钥，永远不提交
```

### **2. 示例配置**
协作者克隆代码后，复制示例配置：
```bash
cp config/sites.example.json config/sites.json
# 然后修改为自己的站点信息
```

---

## 📋 配置格式

### **sites.json 结构**
```json
{
  "sites": [
    {
      "id": "autozqi-ru",
      "name": "AutoZQi Russia",
      "country": "ru",
      "wordpress": {
        "url": "https://autozqi.ru",
        "username": "admin",
        "app_password": "你的真实密码"
      },
      "seo": {
        "target_market": "ru",
        "currency": "RUB",
        "language": "russian",
        "base_url": "https://autozqi.ru"
      }
    },
    {
      "id": "autozqi-kz",
      "name": "AutoZQi Kazakhstan",
      "country": "kz",
      "wordpress": {
        "url": "https://autozqi.kz",
        "username": "admin",
        "app_password": "另一个密码"
      },
      "seo": {
        "target_market": "kz",
        "currency": "KZT",
        "language": "russian",
        "base_url": "https://autozqi.kz"
      }
    }
  ],
  "default_site": "autozqi-ru"
}
```

---

## 🌍 支持的国家配置

| 国家代码 | 市场 | 货币 | 语言 | 物流节点 |
|---------|------|------|------|----------|
| `ru` | 俄罗斯 | RUB | russian | 满洲里/后贝加尔斯克 |
| `kz` | 哈萨克斯坦 | KZT | russian | 霍尔果斯/阿拉山口 |
| `by` | 白俄罗斯 | BYN | russian | 经俄罗斯转运 |
| `uz` | 乌兹别克斯坦 | UZS | russian | 经哈萨克斯坦 |
| `kg` | 吉尔吉斯斯坦 | KGS | russian | 伊尔克什坦 |

可根据需要添加更多国家。

---

## 🚀 使用方式

### **前端：站点切换（即将实现）**
```javascript
// 用户在前端选择目标站点
const siteId = 'autozqi-kz';

// 生成SEO时指定站点
fetch('/api/seo/vehicle', {
  method: 'POST',
  body: JSON.stringify({
    brand: 'Toyota',
    model: 'Camry',
    site_id: siteId  // 可选，不传则用默认站点
  })
});
```

### **后端：自动应用站点配置**
```javascript
// SEO生成会自动使用对应站点的配置
// - 俄罗斯站：Владивосток, через Забайкальск
// - 哈萨克斯坦站：Алматы, через Хоргос
// - URL: 自动带上正确的base_url
```

---

## 👥 多人协作流程

### **场景1：新协作者加入**
1. 克隆代码
2. 复制示例配置：`cp config/sites.example.json config/sites.json`
3. 修改 `sites.json` 为自己的测试站点
4. 你的 `autozqi.ru` **永远不会被他看到**

### **场景2：添加新站点**
1. 编辑你的 `config/sites.json`（不提交git）
2. 添加新站点配置：
```json
{
  "id": "new-site",
  "name": "新站点名称",
  "country": "kz",
  "wordpress": {...},
  "seo": {...}
}
```
3. 重启后端，新站点立即可用

### **场景3：更新示例配置**
如果你新增了配置字段，更新 `sites.example.json`（提交git）：
```bash
# 更新示例，让协作者知道有新字段
vim config/sites.example.json
git add config/sites.example.json
git commit -m "docs: 添加新的站点配置字段"
```

---

## 🛡️ 安全检查清单

- [ ] `config/sites.json` 在 `.gitignore` 中
- [ ] `config/sites.json` 未被 `git status` 显示
- [ ] `sites.example.json` 中没有真实密码和域名
- [ ] `.env` 在 `.gitignore` 中
- [ ] 协作者无法看到你的真实WordPress账号

---

## 🔧 故障排查

### **问题1：站点配置未生效**
```bash
# 检查配置文件是否存在
ls config/sites.json

# 查看后端启动日志
# 应该显示：✅ 已加载站点配置: AutoZQi Russia, ...
```

### **问题2：Git显示sites.json**
```bash
# 确认.gitignore包含
cat .gitignore | grep sites.json

# 如果已经提交过，从git中移除
git rm --cached config/sites.json
git commit -m "chore: 移除敏感配置文件"
```

---

## 📈 扩展示例

### **添加英语市场（美国/欧洲）**
```json
{
  "id": "autoexport-us",
  "country": "us",
  "wordpress": {...},
  "seo": {
    "target_market": "us",
    "currency": "USD",
    "language": "english",
    "base_url": "https://autoexport.com"
  }
}
```

然后修改 `seoManager.js`，添加英语Prompt模板。

---

## 📞 技术支持

如有问题，请检查：
1. 后端日志中的站点加载信息
2. `.gitignore` 是否正确配置
3. `sites.json` 格式是否正确（可用JSON校验工具）
