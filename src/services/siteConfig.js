import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../../config/sites.json');
const EXAMPLE_PATH = path.join(__dirname, '../../config/sites.example.json');

let sitesConfig = null;

/**
 * 加载站点配置
 */
export function loadSitesConfig() {
  if (sitesConfig) return sitesConfig;

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      sitesConfig = JSON.parse(data);
      console.log('✅ 已加载站点配置:', sitesConfig.sites.map(s => s.name).join(', '));
    } else {
      console.warn('⚠️ 未找到 config/sites.json，使用示例配置');
      const data = fs.readFileSync(EXAMPLE_PATH, 'utf8');
      sitesConfig = JSON.parse(data);
    }
    return sitesConfig;
  } catch (error) {
    console.error('❌ 加载站点配置失败:', error.message);
    throw new Error('站点配置文件格式错误');
  }
}

/**
 * 获取所有站点列表（隐藏敏感信息）
 */
export function getAllSites() {
  const config = loadSitesConfig();
  return config.sites.map(site => ({
    id: site.id,
    name: site.name,
    country: site.country,
    language: site.seo.language,
    currency: site.seo.currency
  }));
}

/**
 * 获取默认站点
 */
export function getDefaultSite() {
  const config = loadSitesConfig();
  const defaultId = config.default_site || config.sites[0].id;
  return getSiteById(defaultId);
}

/**
 * 根据ID获取站点配置
 */
export function getSiteById(siteId) {
  const config = loadSitesConfig();
  const site = config.sites.find(s => s.id === siteId);
  if (!site) {
    throw new Error(`站点不存在: ${siteId}`);
  }
  return site;
}

/**
 * 获取站点的WordPress配置
 */
export function getWordPressConfig(siteId) {
  const site = getSiteById(siteId);
  return {
    url: site.wordpress.url,
    username: site.wordpress.username,
    appPassword: site.wordpress.app_password
  };
}

/**
 * 获取站点的SEO配置
 */
export function getSEOConfig(siteId) {
  const site = getSiteById(siteId);
  return site.seo;
}
