/**
 * 客户端守卫 + 工具（与员工端 auth-guard.js 完全独立）
 * 关键：使用 localStorage 'customer_token'，绝不与员工 'token' 冲突。
 * 客户页面只引入本文件，绝不引入 auth-guard.js（否则会被踢去员工登录页）。
 */
(function () {
  window.CUSTOMER_API_BASE = window.location.origin;

  // 当前语言：优先已保存的客户语言，其次浏览器语言，默认俄语
  function detectLang() {
    const saved = localStorage.getItem('customer_lang');
    if (saved) return saved;
    const nav = (navigator.language || 'ru').slice(0, 2).toLowerCase();
    if (['ru', 'en', 'zh'].includes(nav)) return nav;
    return 'ru';
  }
  window.CUSTOMER_LANG = detectLang();

  // 简易多语言字典（客户前台 UI 文案）
  const I18N = {
    zh: {
      portal_title: '个人中心', my_quotes: '我的报价', login_title: '会员登录',
      phone: '手机号', code: '验证码', get_code: '获取验证码', login: '登录',
      logout: '退出', name_optional: '姓名（选填）', sending: '发送中...',
      code_sent: '验证码已发送', login_success: '登录成功', no_quotes: '暂无报价',
      view: '查看', accept: '接受报价', accepted: '已接受', total: '总计',
      valid_until: '有效期至', status: '状态', quote_no: '报价单号',
      accept_confirm: '确认接受此报价？', accept_success: '已接受报价',
      back: '返回', resend: '秒后重发', welcome: '欢迎',
      status_sent: '待确认', status_accepted: '已接受', status_rejected: '已拒绝', status_expired: '已过期',
      dev_code_hint: '测试模式验证码'
    },
    en: {
      portal_title: 'My Account', my_quotes: 'My Quotations', login_title: 'Member Login',
      phone: 'Phone', code: 'Code', get_code: 'Get Code', login: 'Login',
      logout: 'Logout', name_optional: 'Name (optional)', sending: 'Sending...',
      code_sent: 'Code sent', login_success: 'Logged in', no_quotes: 'No quotations yet',
      view: 'View', accept: 'Accept', accepted: 'Accepted', total: 'Total',
      valid_until: 'Valid until', status: 'Status', quote_no: 'Quote No.',
      accept_confirm: 'Accept this quotation?', accept_success: 'Quotation accepted',
      back: 'Back', resend: 's to resend', welcome: 'Welcome',
      status_sent: 'Pending', status_accepted: 'Accepted', status_rejected: 'Rejected', status_expired: 'Expired',
      dev_code_hint: 'Test-mode code'
    },
    ru: {
      portal_title: 'Личный кабинет', my_quotes: 'Мои предложения', login_title: 'Вход для клиентов',
      phone: 'Телефон', code: 'Код', get_code: 'Получить код', login: 'Войти',
      logout: 'Выйти', name_optional: 'Имя (необязательно)', sending: 'Отправка...',
      code_sent: 'Код отправлен', login_success: 'Вход выполнен', no_quotes: 'Пока нет предложений',
      view: 'Посмотреть', accept: 'Принять', accepted: 'Принято', total: 'Итого',
      valid_until: 'Действительно до', status: 'Статус', quote_no: 'Номер',
      accept_confirm: 'Принять это предложение?', accept_success: 'Предложение принято',
      back: 'Назад', resend: 'с до повтора', welcome: 'Добро пожаловать',
      status_sent: 'Ожидает', status_accepted: 'Принято', status_rejected: 'Отклонено', status_expired: 'Истекло',
      dev_code_hint: 'Код тестового режима'
    }
  };

  window.t = function (key) {
    const dict = I18N[window.CUSTOMER_LANG] || I18N.ru;
    return dict[key] || (I18N.ru[key] || key);
  };

  window.setCustomerLang = function (lang) {
    if (['ru', 'en', 'zh'].includes(lang)) {
      window.CUSTOMER_LANG = lang;
      localStorage.setItem('customer_lang', lang);
    }
  };

  // 带 customer_token 的 fetch；401/403 清除并跳登录
  window.customerFetch = async function (url, options = {}) {
    const token = localStorage.getItem('customer_token');
    const headers = Object.assign({}, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const resp = await fetch(url, Object.assign({}, options, { headers }));
    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem('customer_token');
      localStorage.removeItem('customer_info');
      if (!location.pathname.endsWith('customer-login.html')) {
        location.href = '/customer-login.html';
      }
      throw new Error('未登录或登录失效');
    }
    return resp;
  };

  window.customerLogout = async function () {
    try {
      await window.customerFetch(window.CUSTOMER_API_BASE + '/api/customer/auth/logout', { method: 'POST' });
    } catch (e) { /* 忽略 */ }
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_info');
    location.href = '/customer-login.html';
  };

  // 受保护页面调用：无 token 直接跳登录
  window.requireCustomerLogin = function () {
    if (!localStorage.getItem('customer_token')) {
      location.href = '/customer-login.html';
      return false;
    }
    return true;
  };
})();
