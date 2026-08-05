/**
 * 置信度评估器
 * 注意：当前版本中，置信度由 Claude Vision API 直接返回
 * 此文件保留用于未来可能的后处理逻辑
 */

/**
 * 验证置信度值是否有效
 * @param {string} confidence - 置信度值
 * @returns {boolean} 是否有效
 */
export function isValidConfidence(confidence) {
  return ['high', 'medium', 'low'].includes(confidence);
}

/**
 * 后处理识别结果（可选）
 * @param {Object} data - Claude 返回的原始数据
 * @returns {Object} 处理后的数据
 */
export function postProcessRecognitionData(data) {
  // 确保所有字段都有置信度
  const processedData = {};

  for (const [key, field] of Object.entries(data)) {
    if (!field || typeof field !== 'object') {
      processedData[key] = {
        value: '',
        confidence: 'low'
      };
      continue;
    }

    // 如果 value 为空或 undefined，强制设为 low 置信度
    if (!field.value || field.value.trim() === '') {
      processedData[key] = {
        ...field,
        value: '',
        confidence: 'low'
      };
    } else {
      // 验证置信度有效性
      processedData[key] = {
        ...field,
        confidence: isValidConfidence(field.confidence) ? field.confidence : 'medium'
      };
    }
  }

  return processedData;
}
