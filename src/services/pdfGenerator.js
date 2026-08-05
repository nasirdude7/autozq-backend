import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { getExchangeRate, convertToRub } from './exchangeRate.js';
import { getLanguageConfig } from '../config/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  primary: '#1a3a5c',
  accent: '#e8b84b',
  text: '#333333',
  lightGray: '#f5f5f5',
  white: '#ffffff',
  border: '#dddddd'
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 50;
const CONTENT_TOP = 70;      // 内容起始Y
const CONTENT_BOTTOM = PAGE_HEIGHT - 60; // 内容底部限制

export async function generateQuotePDF({ imagePath, vehicleInfo, config, prices, language, vehicleType, conditionDescription }) {
  // 多语言配置
  const lang = language || 'ru';
  const L = getLanguageConfig(lang).pdf;
  const isUsed = vehicleType === 'used';

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: false
  });

  const timestamp = Date.now();
  const filename = `quote-${vehicleInfo.brand}-${vehicleInfo.model}-${timestamp}.pdf`;
  const outputPath = path.join(__dirname, '../../uploads', filename);

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const fontsDir = path.join(__dirname, '../../fonts');
  doc.registerFont('Regular', path.join(fontsDir, 'Arial.ttf'));
  doc.registerFont('Bold', path.join(fontsDir, 'Arial-Bold.ttf'));

  // 预加载Logo
  let logoBuffer = null;
  try {
    const logoResponse = await fetch('https://autozq.ru/wp-content/uploads/2026/05/logo4.png');
    logoBuffer = await logoResponse.buffer();
  } catch (error) {
    console.log('Logo加载失败');
  }

  // 获取俄罗斯央行官方汇率
  let exchangeRate = null;
  try {
    const rateResult = await getExchangeRate();
    if (rateResult.success) {
      exchangeRate = rateResult;
      console.log(`💱 汇率: 1元 = ${rateResult.cnyToRub}卢布 (${rateResult.date})`);
    }
  } catch (e) {
    console.log('汇率获取失败');
  }

  let pageNum = 0;

  // 添加新页的辅助函数
  function newPage() {
    doc.addPage({ size: 'A4', margin: 0 });
    pageNum++;
    drawHeader(doc, logoBuffer);
    drawFooter(doc, pageNum);
  }

  // ========== 第1页：封面 ==========
  newPage();

  // 车辆主图（用sharp转换为PNG，确保PDFKit兼容）
  try {
    if (fs.existsSync(imagePath)) {
      console.log('🖼️ PDF开始处理主图:', imagePath);
      // 用sharp统一转换为PNG格式（兼容WebP/JPEG/PNG等所有格式）
      const pngBuffer = await sharp(imagePath)
        .png()
        .toBuffer();

      console.log('✅ 主图转PNG成功, 大小:', (pngBuffer.length / 1024).toFixed(2), 'KB');

      doc.image(pngBuffer, MARGIN + 47, 110, {
        fit: [CONTENT_WIDTH - 94, 280],
        align: 'center'
      });
      console.log('✅ 主图已添加到PDF');
    } else {
      console.error('❌ 主图文件不存在:', imagePath);
    }
  } catch (error) {
    console.error('❌ 主图加载失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }

  // 车型名称（固定位置）
  doc.font('Bold').fontSize(28).fillColor(COLORS.primary);
  doc.text(`${vehicleInfo.brand} ${vehicleInfo.model}`, MARGIN, 420, {
    width: CONTENT_WIDTH, align: 'center'
  });

  if (vehicleInfo.year) {
    doc.font('Regular').fontSize(18).fillColor(COLORS.text);
    doc.text(vehicleInfo.year, MARGIN, 458, { width: CONTENT_WIDTH, align: 'center' });
  }

  // 价格卡片（人民币 + 卢布换算）
  const priceData = [
    { label: 'EXW Маньчжурия', labelCn: 'EXW满洲里', value: prices.exw },
    { label: 'FOB Маньчжурия', labelCn: 'FOB满洲里', value: prices.fob },
    { label: 'CIP Забайкальск', labelCn: 'CIP后贝加尔斯克', value: prices.cip }
  ].filter(p => p.value);

  if (priceData.length > 0) {
    const priceY = 495;
    const gap = 12;
    const cardWidth = (CONTENT_WIDTH - (priceData.length - 1) * gap) / priceData.length;
    const cardHeight = 95;

    priceData.forEach((price, i) => {
      const x = MARGIN + i * (cardWidth + gap);

      // 卡片背景
      doc.roundedRect(x, priceY, cardWidth, cardHeight, 5).fill(COLORS.lightGray);

      // 标签（俄语）
      doc.font('Bold').fontSize(11).fillColor(COLORS.primary);
      doc.text(price.label, x + 4, priceY + 12, { width: cardWidth - 8, align: 'center' });

      // 人民币价格
      doc.font('Bold').fontSize(18).fillColor(COLORS.accent);
      const cny = parseFloat(price.value);
      const fpCny = '¥' + cny.toLocaleString('en-US', { maximumFractionDigits: 0 });
      doc.text(fpCny, x + 4, priceY + 38, { width: cardWidth - 8, align: 'center' });

      // 卢布换算价格
      if (exchangeRate) {
        const rub = convertToRub(cny, exchangeRate.cnyToRub);
        const fpRub = '₽' + rub.toLocaleString('ru-RU');
        doc.font('Regular').fontSize(12).fillColor(COLORS.text);
        doc.text(fpRub, x + 4, priceY + 66, { width: cardWidth - 8, align: 'center' });
      }
    });

    // 汇率信息（卡片下方）
    if (exchangeRate) {
      const rateInfoY = priceY + cardHeight + 18;
      const rateDate = exchangeRate.date.split('T')[0]; // 取日期部分

      doc.font('Regular').fontSize(9).fillColor(COLORS.text);
      doc.text(
        `Курс ЦБ РФ на ${rateDate}: 1 CNY = ${exchangeRate.cnyToRub.toFixed(4)} RUB`,
        MARGIN, rateInfoY, { width: CONTENT_WIDTH, align: 'center' }
      );

      doc.font('Regular').fontSize(8).fillColor('#888888');
      doc.text(
        'Цена в рублях указана по курсу на дату котировки. Оплата производится по курсу ЦБ РФ на день платежа.',
        MARGIN, rateInfoY + 14, { width: CONTENT_WIDTH, align: 'center' }
      );
    }
  }

  // ========== 第2页：基础参数表 ==========
  newPage();

  doc.font('Bold').fontSize(18).fillColor(COLORS.primary);
  doc.text(L.specs, MARGIN, CONTENT_TOP);

  const specs = [
    [L.brand, vehicleInfo.brand],
    [L.model, vehicleInfo.model],
    [L.year, vehicleInfo.year || '-'],
    [L.color, vehicleInfo.color || '-'],
    [L.mileage, vehicleInfo.mileage ? `${vehicleInfo.mileage} km` : '-'],
    [L.displacement, vehicleInfo.displacement || '-'],
    [L.horsepower, vehicleInfo.horsepower || '-'],
    [L.transmission, vehicleInfo.transmission || '-'],
    [L.drive, vehicleInfo.drive_type || '-']
  ];

  let ty = CONTENT_TOP + 35;
  const rowH = 34;
  const labelW = 200;

  specs.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.rect(MARGIN, ty, CONTENT_WIDTH, rowH).fill(COLORS.lightGray);
    }
    doc.font('Regular').fontSize(11).fillColor(COLORS.text);
    doc.text(label, MARGIN + 12, ty + 11, { width: labelW - 12 });
    doc.font('Bold').fontSize(11).fillColor(COLORS.primary);
    doc.text(value, MARGIN + labelW, ty + 11, { width: CONTENT_WIDTH - labelW - 12 });
    ty += rowH;
  });
  doc.rect(MARGIN, CONTENT_TOP + 35, CONTENT_WIDTH, specs.length * rowH).stroke(COLORS.border);

  // ========== 配置页（逐行表格式）==========
  const sections = [
    { title: L.safety, key: 'safety' },
    { title: L.comfort, key: 'comfort' },
    { title: L.multimedia, key: 'entertainment' },
    { title: L.assist, key: 'adas' },
    { title: L.engine, key: 'powertrain' },
    { title: L.transmission, key: 'transmission' }
  ];

  newPage();
  doc.font('Bold').fontSize(18).fillColor(COLORS.primary);
  doc.text(L.config, MARGIN, CONTENT_TOP);
  let cy = CONTENT_TOP + 35;

  sections.forEach(section => {
    if (!config[section.key]) return;

    // 将内容拆分成行（按换行符或分号）
    const rawText = config[section.key];
    const items = rawText
      .split(/[\n;；]/)
      .map(s => s.replace(/^[•\-\*\s]+/, '').trim())
      .filter(s => s.length > 0);

    // 计算标题栏 + 所有行的总高度
    doc.font('Regular').fontSize(9);
    const lineHeights = items.map(item =>
      doc.heightOfString(item, { width: CONTENT_WIDTH - 30 }) + 8
    );
    const titleBarH = 26;

    // 检查标题栏是否放得下（至少标题+1行）
    if (cy + titleBarH + (lineHeights[0] || 20) > CONTENT_BOTTOM) {
      newPage();
      cy = CONTENT_TOP;
    }

    // 绘制标题栏（深蓝背景）
    doc.rect(MARGIN, cy, CONTENT_WIDTH, titleBarH).fill(COLORS.primary);
    doc.font('Bold').fontSize(12).fillColor(COLORS.white);
    doc.text(section.title, MARGIN + 12, cy + 7);
    cy += titleBarH;

    // 逐行绘制内容
    items.forEach((item, idx) => {
      const lineH = lineHeights[idx];

      // 单行换页检查
      if (cy + lineH > CONTENT_BOTTOM) {
        newPage();
        cy = CONTENT_TOP;
      }

      // 交替行背景
      if (idx % 2 === 0) {
        doc.rect(MARGIN, cy, CONTENT_WIDTH, lineH).fill(COLORS.lightGray);
      } else {
        doc.rect(MARGIN, cy, CONTENT_WIDTH, lineH).fill(COLORS.white);
      }

      // 行文字（带圆点）
      doc.font('Regular').fontSize(9).fillColor(COLORS.text);
      doc.text('- ' + item, MARGIN + 12, cy + 4, { width: CONTENT_WIDTH - 24 });

      cy += lineH;
    });

    // 配置块边框
    cy += 12; // 块间距
  });

  // ========== 车况描述页（仅二手车）==========
  if (isUsed && conditionDescription && conditionDescription.trim()) {
    newPage();
    doc.font('Bold').fontSize(18).fillColor(COLORS.primary);
    doc.text(L.condition, MARGIN, CONTENT_TOP);

    let condY = CONTENT_TOP + 35;

    // 将车况描述拆分成行
    const condItems = conditionDescription
      .split(/[\n;；]/)
      .map(s => s.replace(/^[•\-\*\s]+/, '').trim())
      .filter(s => s.length > 0);

    condItems.forEach((item, idx) => {
      doc.font('Regular').fontSize(11);
      const itemH = doc.heightOfString(item, { width: CONTENT_WIDTH - 30 }) + 12;

      // 换页检查
      if (condY + itemH > CONTENT_BOTTOM) {
        newPage();
        condY = CONTENT_TOP;
      }

      // 交替背景
      if (idx % 2 === 0) {
        doc.rect(MARGIN, condY, CONTENT_WIDTH, itemH).fill(COLORS.lightGray);
      }

      doc.font('Regular').fontSize(11).fillColor(COLORS.text);
      doc.text('- ' + item, MARGIN + 12, condY + 6, { width: CONTENT_WIDTH - 24 });

      condY += itemH;
    });
  }

  // ========== 最后一页：公司信息 ==========
  newPage();

  // Logo区域深蓝背景框
  const logoBoxY = 100;
  const logoBoxH = 120;
  doc.rect(MARGIN, logoBoxY, CONTENT_WIDTH, logoBoxH).fill(COLORS.primary);

  // Logo居中显示在深蓝框内
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, (PAGE_WIDTH - 160) / 2, logoBoxY + 30, { width: 160 });
    } catch (e) {}
  }

  doc.font('Bold').fontSize(24).fillColor(COLORS.primary);
  doc.text(L.contacts, MARGIN, 260, { width: CONTENT_WIDTH, align: 'center' });

  const contacts = [
    [L.website, 'https://autozq.ru'],
    [L.phone, '+86 147 4705 3666'],
    ['Email', 'info@autozq.ru'],
    ['WhatsApp', '+86 147 4705 3666'],
    ['Telegram', 'https://t.me/autozqauto']
  ];

  let conY = 320;
  const conRowH = 42;
  const conTableW = 420;
  const conX = (PAGE_WIDTH - conTableW) / 2;

  contacts.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.rect(conX, conY, conTableW, conRowH).fill(COLORS.lightGray);
    }
    doc.font('Bold').fontSize(12).fillColor(COLORS.primary);
    doc.text(label, conX + 20, conY + 14, { width: 140 });
    doc.font('Regular').fontSize(12).fillColor(COLORS.text);
    doc.text(value, conX + 160, conY + 14, { width: conTableW - 180 });
    conY += conRowH;
  });
  doc.rect(conX, 320, conTableW, contacts.length * conRowH).stroke(COLORS.border);

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return outputPath;
}

function drawHeader(doc, logoBuffer) {
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(COLORS.primary);

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN, 12, { height: 26 });
    } catch (e) {}
  }

  doc.font('Bold').fontSize(11).fillColor(COLORS.white);
  doc.text('AutoZQ', MARGIN + 100, 18);

  doc.font('Regular').fontSize(10).fillColor(COLORS.white);
  doc.text('autozq.ru', PAGE_WIDTH - 150, 19, { width: 100, align: 'right' });

  doc.strokeColor(COLORS.accent).lineWidth(2);
  doc.moveTo(0, HEADER_HEIGHT).lineTo(PAGE_WIDTH, HEADER_HEIGHT).stroke();
}

function drawFooter(doc, pageNum) {
  const bottom = PAGE_HEIGHT - 35;
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(MARGIN, bottom - 5).lineTo(PAGE_WIDTH - MARGIN, bottom - 5).stroke();
  doc.font('Regular').fontSize(8).fillColor(COLORS.text);
  doc.text(`Страница ${pageNum}`, MARGIN, bottom);
  doc.text('https://autozq.ru', PAGE_WIDTH - 150, bottom, { width: 100, align: 'right' });
}
