/**
 * 模拟车辆识别服务
 * 用于演示和测试，不调用真实 AI API
 */

/**
 * 模拟识别车辆信息
 * @param {string} imagePath - 图片文件路径
 * @returns {Promise<Object>} 模拟识别结果
 */
export async function recognizeVehicleFromImage(imagePath) {
  // 模拟 AI 识别延迟（2-5秒）
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  // 生成模拟识别结果
  const mockResults = [
    // 示例1: 高置信度结果
    {
      brand: { value: 'Toyota', confidence: 'high' },
      model: { value: 'Camry', confidence: 'high' },
      year: { value: '2020', confidence: 'high' },
      color: { value: '白色', confidence: 'high' },
      mileage: { value: '45000', unit: 'km', confidence: 'medium' },
      displacement: { value: '2.5L', confidence: 'high' },
      horsepower: { value: '203', confidence: 'medium' },
      transmission: { value: '自动', confidence: 'high' },
      drive_type: { value: '前驱', confidence: 'high' },
    },
    // 示例2: 混合置信度结果
    {
      brand: { value: 'Honda', confidence: 'high' },
      model: { value: 'Accord', confidence: 'high' },
      year: { value: '2019', confidence: 'medium' },
      color: { value: '黑色', confidence: 'high' },
      mileage: { value: '65000', unit: 'km', confidence: 'low' },
      displacement: { value: '1.5T', confidence: 'medium' },
      horsepower: { value: '194', confidence: 'low' },
      transmission: { value: 'CVT', confidence: 'high' },
      drive_type: { value: '前驱', confidence: 'medium' },
    },
    // 示例3: 部分识别失败
    {
      brand: { value: 'Nissan', confidence: 'medium' },
      model: { value: 'Altima', confidence: 'medium' },
      year: { value: '2021', confidence: 'high' },
      color: { value: '灰色', confidence: 'high' },
      mileage: { value: '', unit: 'km', confidence: 'low' },
      displacement: { value: '2.0T', confidence: 'medium' },
      horsepower: { value: '', confidence: 'low' },
      transmission: { value: '自动', confidence: 'medium' },
      drive_type: { value: '', confidence: 'low' },
    },
  ];

  // 随机返回一个模拟结果
  const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];

  console.log('🤖 [模拟识别] 返回模拟数据:', JSON.stringify(randomResult, null, 2));

  return {
    success: true,
    data: randomResult,
  };
}
