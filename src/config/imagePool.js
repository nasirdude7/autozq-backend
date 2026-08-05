/**
 * 汽车出口营销相关的Unsplash图片库
 * 所有图片均来自Unsplash，已验证可用
 */

export const UNSPLASH_IMAGE_POOL = {
  // 汽车运输/出口
  'car-export': [
    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1600&h=900&fit=crop', // 货船
    'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=1600&h=900&fit=crop', // 汽车运输车
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&h=900&fit=crop'  // 港口
  ],

  // 汽车展示
  'car-display': [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600&h=900&fit=crop', // 跑车
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&h=900&fit=crop', // 豪车
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1600&h=900&fit=crop'  // SUV
  ],

  // 汽车检查/维修
  'car-inspection': [
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&h=900&fit=crop', // 汽车维修
    'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1600&h=900&fit=crop', // 引擎检查
    'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1600&h=900&fit=crop'  // 汽车内部
  ],

  // 文档/合同
  'documents': [
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&h=900&fit=crop', // 文档签署
    'https://images.unsplash.com/photo-1554224311-beee460ae6ba?w=1600&h=900&fit=crop', // 商务合同
    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1600&h=900&fit=crop'  // 文件工作
  ],

  // 物流/仓库
  'logistics': [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&h=900&fit=crop', // 仓库
    'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=1600&h=900&fit=crop', // 物流中心
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1600&h=900&fit=crop'  // 配送
  ],

  // 二手车市场
  'used-cars': [
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1600&h=900&fit=crop', // 二手SUV
    'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=1600&h=900&fit=crop', // 汽车市场
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1600&h=900&fit=crop'  // 汽车展厅
  ],

  // 通用汽车
  'general': [
    'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1600&h=900&fit=crop', // 红色汽车
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1600&h=900&fit=crop', // 白色汽车
    'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1600&h=900&fit=crop'  // 蓝色汽车
  ]
};

/**
 * 根据关键词获取合适的图片
 */
export function getImageFromPool(keywords, index = 0) {
  const lowerKeywords = keywords.toLowerCase();

  // 匹配图片类型
  let category = 'general';

  if (lowerKeywords.includes('export') || lowerKeywords.includes('出口') || lowerKeywords.includes('shipping')) {
    category = 'car-export';
  } else if (lowerKeywords.includes('inspection') || lowerKeywords.includes('检查') || lowerKeywords.includes('维修')) {
    category = 'car-inspection';
  } else if (lowerKeywords.includes('document') || lowerKeywords.includes('文档') || lowerKeywords.includes('合同')) {
    category = 'documents';
  } else if (lowerKeywords.includes('logistics') || lowerKeywords.includes('物流') || lowerKeywords.includes('运输')) {
    category = 'logistics';
  } else if (lowerKeywords.includes('used') || lowerKeywords.includes('二手') || lowerKeywords.includes('market')) {
    category = 'used-cars';
  } else if (lowerKeywords.includes('car') || lowerKeywords.includes('汽车') || lowerKeywords.includes('vehicle')) {
    category = 'car-display';
  }

  const pool = UNSPLASH_IMAGE_POOL[category];

  // 添加随机性：使用时间戳和index生成随机索引
  const randomSeed = Date.now() + index * 1000;
  const randomIndex = Math.floor((randomSeed % 997) * pool.length / 997);  // 使用质数997增加随机性

  return pool[randomIndex % pool.length];
}
