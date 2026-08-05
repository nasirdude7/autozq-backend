import React, { useState } from 'react';
import ConfidenceBadge from './ConfidenceBadge';

function VehicleForm({ data }) {
  const [formData, setFormData] = useState(data);

  // 表单字段配置
  const fields = [
    { key: 'brand', label: '品牌', placeholder: '例如: Toyota' },
    { key: 'model', label: '车型', placeholder: '例如: Camry' },
    { key: 'year', label: '年款', placeholder: '例如: 2020', type: 'number' },
    { key: 'color', label: '颜色', placeholder: '例如: 白色' },
    { key: 'mileage', label: '里程 (km)', placeholder: '例如: 50000', type: 'number' },
    { key: 'displacement', label: '排量', placeholder: '例如: 2.0L' },
    { key: 'horsepower', label: '马力', placeholder: '例如: 150', type: 'number' },
    { key: 'transmission', label: '变速箱', placeholder: '例如: 自动' },
    { key: 'drive_type', label: '驱动方式', placeholder: '例如: 前驱' },
  ];

  // 处理输入变化
  const handleChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value,
      },
    }));
  };

  // 保存表单
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('保存的数据:', formData);
    alert('数据已保存（控制台可查看）');
    // TODO: 这里可以添加保存到数据库的逻辑
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        车辆信息
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {fields.map((field) => {
            const fieldData = formData[field.key] || { value: '', confidence: 'low' };

            return (
              <div key={field.key}>
                <label className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {field.label}
                  </span>
                  <ConfidenceBadge confidence={fieldData.confidence} />
                </label>
                <input
                  type={field.type || 'text'}
                  value={fieldData.value || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldData.confidence === 'low'
                      ? 'border-red-300 bg-red-50'
                      : fieldData.confidence === 'medium'
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-green-300 bg-green-50'
                  }`}
                />
                {/* 显示里程单位 */}
                {field.key === 'mileage' && fieldData.unit && (
                  <p className="mt-1 text-xs text-gray-500">
                    单位: {fieldData.unit}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* 提示信息 */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">识别说明</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><span className="font-medium">绿色背景</span>：AI 高置信度识别</li>
                <li><span className="font-medium">黄色背景</span>：AI 中等置信度，建议核对</li>
                <li><span className="font-medium">红色背景</span>：AI 无法识别，需手动填写</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 按钮组 */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => window.location.reload()}
          >
            重新开始
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            保存信息
          </button>
        </div>
      </form>
    </div>
  );
}

export default VehicleForm;
