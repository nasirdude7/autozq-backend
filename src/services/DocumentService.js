import pool from '../db/salesPool.js';
import AIAssistantService from './AIAssistantService.js';

/**
 * 单据生成服务
 * 自动生成报价单、订单、合同等业务单据
 */
class DocumentService {
  /**
   * 生成报价单（Quotation）
   * @param {Object} data - 报价数据
   */
  static async generateQuotation(data) {
    try {
      const {
        customer_id,
        vehicles, // [{brand, model, year, price, quantity, specs}]
        currency = 'USD',
        valid_days = 7,
        terms,
        created_by
      } = data;

      // 1. 获取客户信息
      const customerQuery = `
        SELECT id, name, phone, email, country, language
        FROM customers WHERE id = $1
      `;
      const customerResult = await pool.query(customerQuery, [customer_id]);

      if (customerResult.rows.length === 0) {
        throw new Error('客户不存在');
      }

      const customer = customerResult.rows[0];

      // 2. 计算总价
      const subtotal = vehicles.reduce((sum, v) => sum + (v.price * v.quantity), 0);
      const tax = subtotal * 0.0; // 根据实际税率调整
      const total = subtotal + tax;

      // 3. 生成报价单号
      const quotationNo = `QT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // 4. 保存到数据库
      const insertQuery = `
        INSERT INTO quotations (
          quotation_no, customer_id, vehicles, subtotal, tax, total,
          currency, valid_until, terms, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '${valid_days} days', $8, 'draft', $9)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        quotationNo,
        customer_id,
        JSON.stringify(vehicles),
        subtotal,
        tax,
        total,
        currency,
        terms || 'Standard payment terms apply',
        created_by
      ]);

      const quotation = result.rows[0];

      // 5. 使用AI生成专业的报价说明（多语言）
      const aiPrompt = `
为以下汽车报价单生成专业的说明文字（使用${customer.language === 'ru' ? '俄语' : customer.language === 'zh' ? '中文' : '英语'}）：

客户：${customer.name}
国家：${customer.country}

车辆清单：
${vehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model} ${v.year} - ${v.quantity}台 @ $${v.price}`).join('\n')}

总价：${currency} ${total.toFixed(2)}
有效期：${valid_days}天

请生成：
1. 专业的开场白
2. 车辆详细介绍
3. 价格说明
4. 交易条款
5. 联系方式和结尾

保持专业、友好的语气。
`;

      const aiDescription = await AIAssistantService.translate(
        aiPrompt,
        customer.language,
        'zh'
      );

      // 6. 生成HTML格式报价单
      const htmlContent = this.generateQuotationHTML({
        ...quotation,
        customer,
        vehicles,
        description: aiDescription.translated || '专业汽车出口服务'
      });

      // 更新HTML内容
      await pool.query(
        'UPDATE quotations SET html_content = $1 WHERE id = $2',
        [htmlContent, quotation.id]
      );

      return {
        success: true,
        data: {
          ...quotation,
          customer,
          html_content: htmlContent
        },
        message: '报价单生成成功'
      };
    } catch (error) {
      console.error('生成报价单错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成HTML格式报价单
   */
  static generateQuotationHTML(data) {
    const { quotation_no, customer, vehicles, subtotal, tax, total, currency, valid_until, description } = data;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>报价单 - ${quotation_no}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1a5490; margin: 0; }
    .info-section { margin-bottom: 30px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .label { font-weight: bold; color: #555; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .total-section { text-align: right; margin-top: 20px; }
    .total-row { display: flex; justify-content: flex-end; margin: 10px 0; }
    .total-label { width: 150px; font-weight: bold; }
    .total-value { width: 150px; text-align: right; }
    .grand-total { font-size: 1.2em; color: #1a5490; border-top: 2px solid #333; padding-top: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚗 AutoZQ 报价单</h1>
    <p>专业汽车出口服务</p>
  </div>

  <div class="info-section">
    <div class="info-row">
      <div><span class="label">报价单号：</span>${quotation_no}</div>
      <div><span class="label">日期：</span>${new Date().toLocaleDateString()}</div>
    </div>
    <div class="info-row">
      <div><span class="label">有效期至：</span>${new Date(valid_until).toLocaleDateString()}</div>
      <div><span class="label">币种：</span>${currency}</div>
    </div>
  </div>

  <div class="info-section">
    <h3>客户信息</h3>
    <div class="info-row"><span class="label">姓名：</span>${customer.name}</div>
    <div class="info-row"><span class="label">电话：</span>${customer.phone}</div>
    ${customer.email ? `<div class="info-row"><span class="label">邮箱：</span>${customer.email}</div>` : ''}
    <div class="info-row"><span class="label">国家：</span>${customer.country || 'N/A'}</div>
  </div>

  <h3>车辆明细</h3>
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>品牌型号</th>
        <th>年份</th>
        <th>数量</th>
        <th>单价</th>
        <th>小计</th>
      </tr>
    </thead>
    <tbody>
      ${vehicles.map((v, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${v.brand} ${v.model}</td>
          <td>${v.year}</td>
          <td>${v.quantity}</td>
          <td>${currency} ${v.price.toLocaleString()}</td>
          <td>${currency} ${(v.price * v.quantity).toLocaleString()}</td>
        </tr>
        ${v.specs ? `<tr><td colspan="6" style="font-size:0.9em; color:#666;">配置：${v.specs}</td></tr>` : ''}
      `).join('')}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <div class="total-label">小计：</div>
      <div class="total-value">${currency} ${subtotal.toLocaleString()}</div>
    </div>
    <div class="total-row">
      <div class="total-label">税费：</div>
      <div class="total-value">${currency} ${tax.toLocaleString()}</div>
    </div>
    <div class="total-row grand-total">
      <div class="total-label">总计：</div>
      <div class="total-value">${currency} ${total.toLocaleString()}</div>
    </div>
  </div>

  <div class="info-section" style="margin-top: 40px;">
    <h3>说明</h3>
    <p>${description}</p>
  </div>

  <div class="footer">
    <p><strong>AutoZQ 汽车出口</strong></p>
    <p>满洲里口岸 | 中俄汽车贸易专家</p>
    <p>联系电话：+86-xxx-xxxx | 邮箱：sales@autozq.com</p>
    <p style="margin-top: 20px; font-size: 0.85em; color: #999;">
      本报价单自生成之日起${Math.floor((new Date(valid_until) - new Date()) / (1000 * 60 * 60 * 24))}天内有效。
      价格以最终确认为准，可能因市场波动有所调整。
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * 生成订单（Order）
   * @param {Object} data - 订单数据
   */
  static async generateOrder(data) {
    try {
      const {
        customer_id,
        quotation_id,
        vehicles,
        total_amount,
        currency,
        payment_method,
        delivery_address,
        notes,
        created_by
      } = data;

      // 生成订单号
      const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const insertQuery = `
        INSERT INTO orders (
          order_no, customer_id, quotation_id, vehicles, total_amount,
          currency, payment_method, delivery_address, notes, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        orderNo,
        customer_id,
        quotation_id,
        JSON.stringify(vehicles),
        total_amount,
        currency,
        payment_method,
        delivery_address,
        notes,
        created_by
      ]);

      return {
        success: true,
        data: result.rows[0],
        message: '订单生成成功'
      };
    } catch (error) {
      console.error('生成订单错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成合同（Contract）
   * @param {Object} data - 合同数据
   */
  static async generateContract(data) {
    try {
      const {
        order_id,
        customer_id,
        contract_type = 'sales',
        terms,
        created_by
      } = data;

      // 生成合同号
      const contractNo = `CT${Date.now()}`;

      // 获取订单和客户信息
      const orderQuery = `
        SELECT o.*, c.name, c.phone, c.country, c.language
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        WHERE o.id = $1
      `;
      const orderResult = await pool.query(orderQuery, [order_id]);

      if (orderResult.rows.length === 0) {
        throw new Error('订单不存在');
      }

      const order = orderResult.rows[0];

      // 使用AI生成合同条款
      const aiPrompt = `
生成一份专业的汽车销售合同（${order.language === 'ru' ? '俄语' : '中文'}），包含以下信息：

订单号：${order.order_no}
客户：${order.name} (${order.country})
车辆：${JSON.stringify(order.vehicles)}
总金额：${order.currency} ${order.total_amount}

请生成标准的销售合同条款，包括：
1. 甲乙双方信息
2. 标的物描述
3. 价格与付款方式
4. 交付时间与地点
5. 质量保证
6. 违约责任
7. 争议解决

保持法律专业性和严谨性。
`;

      const aiContract = await AIAssistantService.translate(
        aiPrompt,
        order.language,
        'zh'
      );

      const insertQuery = `
        INSERT INTO contracts (
          contract_no, order_id, customer_id, contract_type,
          terms, content, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        contractNo,
        order_id,
        customer_id,
        contract_type,
        terms || 'Standard terms',
        aiContract.translated,
        created_by
      ]);

      return {
        success: true,
        data: result.rows[0],
        message: '合同生成成功'
      };
    } catch (error) {
      console.error('生成合同错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取单据列表
   * @param {string} type - 单据类型: quotation/order/contract
   * @param {Object} filters - 筛选条件
   */
  static async listDocuments(type, filters = {}) {
    try {
      const { customer_id, status, limit = 50, offset = 0 } = filters;

      let table;
      switch (type) {
        case 'quotation':
          table = 'quotations';
          break;
        case 'order':
          table = 'orders';
          break;
        case 'contract':
          table = 'contracts';
          break;
        default:
          throw new Error('Invalid document type');
      }

      let query = `SELECT * FROM ${table} WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      if (customer_id) {
        query += ` AND customer_id = $${paramIndex++}`;
        params.push(customer_id);
      }

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length
      };
    } catch (error) {
      console.error('获取单据列表错误:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 发送单据给客户（通过WhatsApp/Email）
   * @param {string} documentId - 单据ID
   * @param {string} type - 单据类型
   * @param {string} method - 发送方式: whatsapp/email
   */
  static async sendDocument(documentId, type, method = 'whatsapp') {
    try {
      // 获取单据详情
      const table = type === 'quotation' ? 'quotations' : type === 'order' ? 'orders' : 'contracts';
      const query = `
        SELECT d.*, c.name, c.phone, c.email, c.whatsapp_id
        FROM ${table} d
        JOIN customers c ON c.id = d.customer_id
        WHERE d.id = $1
      `;

      const result = await pool.query(query, [documentId]);

      if (result.rows.length === 0) {
        throw new Error('单据不存在');
      }

      const doc = result.rows[0];

      // 根据发送方式处理
      if (method === 'whatsapp' && doc.whatsapp_id) {
        // TODO: 调用WhatsApp API发送
        console.log(`发送单据到WhatsApp: ${doc.whatsapp_id}`);
      } else if (method === 'email' && doc.email) {
        // TODO: 调用邮件服务发送
        console.log(`发送单据到Email: ${doc.email}`);
      }

      // 记录发送日志
      await pool.query(
        `UPDATE ${table} SET sent_at = NOW(), sent_method = $1 WHERE id = $2`,
        [method, documentId]
      );

      return {
        success: true,
        message: '单据已发送'
      };
    } catch (error) {
      console.error('发送单据错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取单据统计总览
   * GET /api/sales/documents/stats/overview 使用
   * @param {object} filters - { start_date, end_date } 可选时间范围
   */
  static async getStats(filters = {}) {
    try {
      const { start_date, end_date } = filters;

      // 构造可选时间过滤(基于 created_at)
      const buildRange = (params) => {
        let clause = '';
        if (start_date) { params.push(start_date); clause += ` AND created_at >= $${params.length}`; }
        if (end_date)   { params.push(end_date);   clause += ` AND created_at <= $${params.length}`; }
        return clause;
      };

      const qp = []; const qRange = buildRange(qp);
      const op = []; const oRange = buildRange(op);
      const cp = []; const cRange = buildRange(cp);

      const [quotations, orders, contracts] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0) AS total_amount
           FROM quotations WHERE 1=1${qRange}`, qp),
        pool.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total_amount
           FROM orders WHERE 1=1${oRange}`, op),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM contracts WHERE 1=1${cRange}`, cp)
      ]);

      return {
        success: true,
        data: {
          quotations: {
            count: quotations.rows[0].count,
            total_amount: Number(quotations.rows[0].total_amount)
          },
          orders: {
            count: orders.rows[0].count,
            total_amount: Number(orders.rows[0].total_amount)
          },
          contracts: {
            count: contracts.rows[0].count
          }
        }
      };
    } catch (error) {
      console.error('获取单据统计错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 发布报价给客户（"个人中心 + 聊天"双通道）
   * 1) 报价状态 draft -> sent，客户端个人中心即可查看
   * 2) 往该客户会话插入一条报价卡片消息（message_type='quotation'），
   *    员工聊天工作台和客户端聊天都能看到
   * 3) 若客户来自 SalesMartly（有 whatsapp_id），尽力推送一条通知到外部渠道
   * @param {string} quotationId
   * @param {string} publishedBy - 操作员工 id（可空）
   */
  static async publishToCustomer(quotationId, publishedBy = null) {
    try {
      // 1. 取报价 + 客户信息
      const q = await pool.query(
        `SELECT q.*, c.name AS customer_name, c.phone AS customer_phone,
                c.whatsapp_id, c.language AS customer_language
         FROM quotations q
         JOIN customers c ON c.id = q.customer_id
         WHERE q.id = $1`,
        [quotationId]
      );
      if (q.rows.length === 0) throw new Error('报价单不存在');
      const quote = q.rows[0];

      // 2. 更新状态为 sent（仅 draft/sent 可发布；已接受/拒绝不覆盖）
      await pool.query(
        `UPDATE quotations
         SET status = 'sent', sent_at = COALESCE(sent_at, NOW()), sent_method = 'portal'
         WHERE id = $1 AND status IN ('draft', 'sent')`,
        [quotationId]
      );

      // 3. 插入聊天报价卡片（动态 import 避免与模型的循环依赖）
      const { default: Conversation } = await import('../models/Conversation.js');
      const { default: Message } = await import('../models/Message.js');

      // 有 whatsapp_id 走 whatsapp 会话，否则走 web（个人中心）。
      // 注意：platform 受 conversations_platform_check 约束，只能是 whatsapp/wechat/telegram/web
      const platform = quote.whatsapp_id ? 'whatsapp' : 'web';
      const conversation = await Conversation.getOrCreate(quote.customer_id, platform);

      const cardText = this.buildQuoteCardText(quote);
      // message_type 受约束只能是 text/image/video/audio/file，报价卡片数据放 attachments(jsonb)
      // 前端遇到 attachments.quotation_id 即渲染为报价卡片
      await Message.create({
        conversation_id: conversation.id,
        sender_type: 'agent',
        // 员工账号是文件型(users.json)的非 UUID id，不能写入 uuid 外键列 sender_id；
        // 置 null，操作人记录在 metadata.published_by
        sender_id: null,
        content: cardText,
        message_type: 'text',
        attachments: {
          kind: 'quotation',
          quotation_id: quote.id,
          quotation_no: quote.quotation_no,
          total: Number(quote.total),
          currency: quote.currency,
          valid_until: quote.valid_until,
          view_url: `/customer-portal.html?quote=${quote.id}`
        },
        metadata: { published_by: publishedBy, channel: 'portal+chat' }
      });

      // 4. 尽力推送到外部渠道（SalesMartly）。失败不影响发布结果。
      let externalPush = 'skipped';
      if (quote.whatsapp_id) {
        try {
          // 取最近一条客户消息，复用其 session_id / channel
          const lastMsgs = await Message.findByConversationId(conversation.id, { limit: 20, order: 'desc' });
          const lastCustomerMsg = (lastMsgs || []).find(m => m.sender_type === 'customer' && m.metadata);
          const meta = lastCustomerMsg?.metadata
            ? (typeof lastCustomerMsg.metadata === 'string' ? JSON.parse(lastCustomerMsg.metadata) : lastCustomerMsg.metadata)
            : null;

          if (meta?.session_id) {
            const channelMap = { whatsapp: 12, telegram: 2, wechat: 3 };
            const { sendReplyToSalesMartly } = await import('../routes/webhook.js');
            await sendReplyToSalesMartly({
              chat_user_id: quote.whatsapp_id,
              channel: channelMap[platform] || 12,
              session_id: meta.session_id,
              text: cardText
            });
            externalPush = 'sent';
          } else {
            externalPush = 'no_session'; // 没有可用会话上下文，无法推外部渠道
          }
        } catch (pushErr) {
          console.error('⚠️ 报价外部推送失败(不影响发布):', pushErr.message);
          externalPush = 'failed';
        }
      }

      return {
        success: true,
        message: '报价已发布给客户',
        data: {
          quotation_id: quote.id,
          conversation_id: conversation.id,
          external_push: externalPush
        }
      };
    } catch (error) {
      console.error('发布报价错误:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 报价卡片文案（多语言简版，正文详情在个人中心查看）
   */
  static buildQuoteCardText(quote) {
    const lang = quote.customer_language || 'ru';
    const amount = `${quote.currency} ${Number(quote.total).toLocaleString()}`;
    const t = {
      zh: `📄 您有一份新报价单 ${quote.quotation_no}，总金额 ${amount}。请登录个人中心查看详情。`,
      en: `📄 You have a new quotation ${quote.quotation_no}, total ${amount}. Log in to your portal to view details.`,
      ru: `📄 Для вас новое коммерческое предложение ${quote.quotation_no}, сумма ${amount}. Войдите в личный кабинет, чтобы посмотреть детали.`
    };
    return t[lang] || t.ru;
  }
}

export default DocumentService;
