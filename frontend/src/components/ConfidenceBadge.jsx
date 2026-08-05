import React from 'react';

/**
 * 置信度标签组件
 * @param {string} confidence - 置信度等级 (high/medium/low)
 */
function ConfidenceBadge({ confidence }) {
  const styles = {
    high: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: '高'
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: '中'
    },
    low: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: '低'
    }
  };

  const style = styles[confidence] || styles.low;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export default ConfidenceBadge;
