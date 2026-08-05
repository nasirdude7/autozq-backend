import { generateQuotePDF } from './src/services/pdfGenerator.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 测试PDF生成（西里尔文）\n');

const testData = {
  imagePath: 'C:\\Users\\admin\\Desktop\\1.png',
  vehicleInfo: {
    brand: 'Volkswagen',
    model: 'Tharu',
    year: '2022',
    color: 'White',
    mileage: '54000',
    displacement: '1.4L',
    horsepower: '150hp',
    transmission: '7-speed DCT',
    drive_type: 'FWD'
  },
  config: {
    powertrain: 'Бензиновый турбированный двигатель 1.4 TSI, 150 л.с., 250 Н·м',
    transmission: '7-ступенчатая роботизированная коробка передач DSG',
    safety: '• 6 подушек безопасности\n• ABS, EBD, ESP\n• Камера заднего вида',
    comfort: '• Двухзонный климат-контроль\n• Подогрев сидений\n• Бесключевой доступ',
    entertainment: '• 8-дюймовый сенсорный экран\n• Apple CarPlay\n• 6 динамиков',
    adas: '• Адаптивный круиз-контроль\n• Система удержания в полосе',
    fuel: '• Смешанный цикл: 6.5 л/100км\n• Euro 6'
  },
  prices: {
    exw: '15000',
    fob: '15500',
    cip: '16800'
  }
};

try {
  console.log('开始生成PDF...');
  const pdfPath = await generateQuotePDF(testData);
  console.log('✅ PDF生成成功!');
  console.log('文件路径:', pdfPath);
} catch (error) {
  console.log('❌ PDF生成失败');
  console.log('错误:', error.message);
  console.log('详细:', error.stack);
}
