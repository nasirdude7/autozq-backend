import axios from 'axios';

const API_BASE_URL = '/api';

/**
 * 上传车辆图片并识别
 * @param {File} file - 图片文件
 * @returns {Promise} 识别结果
 */
export async function recognizeVehicle(file) {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/vehicle/recognize`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000, // 30秒超时
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // 服务器返回错误
      throw new Error(error.response.data.error || '识别失败');
    } else if (error.request) {
      // 请求发送失败
      throw new Error('网络请求失败，请检查网络连接');
    } else {
      throw new Error('请求配置错误');
    }
  }
}

/**
 * 健康检查
 * @returns {Promise}
 */
export async function healthCheck() {
  try {
    const response = await axios.get(`${API_BASE_URL}/vehicle/health`);
    return response.data;
  } catch (error) {
    throw new Error('后端服务未启动');
  }
}
