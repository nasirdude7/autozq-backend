# Yandex Webmaster 验证指南

## 步骤1：获取验证代码

1. 访问 https://webmaster.yandex.ru
2. 添加你的网站 https://autozq.ru
3. 选择验证方法

## 验证方法选项

### 方法1：Meta标签验证（推荐）
在网站 <head> 中添加：
```html
<meta name="yandex-verification" content="YOUR_VERIFICATION_CODE" />
```

### 方法2：HTML文件验证
下载验证文件并上传到网站根目录：
```
yandex_XXXXXXXXXXXXX.html
```

### 方法3：DNS记录验证
添加TXT记录到你的DNS：
```
TXT record: verification.yandex.com
Value: YOUR_VERIFICATION_CODE
```

## 步骤2：提交Sitemap

验证成功后，在Webmaster中提交：
```
https://autozq.ru/sitemap.xml
```

## 步骤3：配置关键设置

### 地理位置
- 选择：Russia (Россия)
- 主要地区：全俄罗斯

### 主机设置
- 主域名：https://autozq.ru (带www或不带)
- HTTPS：启用

### 索引设置
- 允许索引：是
- 重新索引频率：每周

### 移动版本
- 响应式设计：是
- 移动友好：检查通过

## 步骤4：监控指标

关注以下指标：
- 索引页面数量
- 搜索查询
- 外部链接
- 站点质量指数 (SQI)
- 移动友好性

## 步骤5：配置Yandex Turbo Pages

提交Turbo RSS：
```
https://autozq.ru/turbo-rss.xml
```

## 常见问题

### Q: 验证需要多久？
A: 通常即时验证，最多24小时

### Q: Sitemap多久更新一次？
A: 建议每周自动更新

### Q: 如何提高站点质量指数？
A: 
- 高质量俄语内容
- 快速加载速度
- 移动友好
- 安全HTTPS
- 用户体验好

## 完成后检查清单

- [ ] 网站已验证
- [ ] Sitemap已提交
- [ ] 地理位置已设置（俄罗斯）
- [ ] 主域名已确认
- [ ] 移动友好性已检查
- [ ] Turbo Pages已配置（可选）
- [ ] Metrica已连接
