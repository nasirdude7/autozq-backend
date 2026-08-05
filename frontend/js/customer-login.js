/**
 * 客户登录页逻辑：手机号 + 验证码，自助注册登录
 */
(function () {
  const API = window.CUSTOMER_API_BASE;

  // 已登录则直接进个人中心
  if (localStorage.getItem('customer_token')) {
    location.href = '/customer-portal.html';
    return;
  }

  const el = (id) => document.getElementById(id);
  const msg = el('msg');

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = 'msg ' + (type || 'err');
    msg.style.display = 'block';
  }
  function hideMsg() { msg.style.display = 'none'; }

  // 渲染当前语言文案
  function applyLang() {
    document.documentElement.lang = window.CUSTOMER_LANG;
    el('subtitle').textContent = t('login_title');
    el('lblPhone').textContent = t('phone');
    el('lblName').textContent = t('name_optional');
    el('lblCode').textContent = t('code');
    el('btnCode').textContent = t('get_code');
    el('btnLogin').textContent = t('login');
    document.querySelectorAll('.lang-switch button').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === window.CUSTOMER_LANG);
    });
  }

  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.addEventListener('click', () => { window.setCustomerLang(b.dataset.lang); applyLang(); });
  });

  // 获取验证码 + 倒计时
  let countdown = 0, timer = null;
  el('btnCode').addEventListener('click', async () => {
    hideMsg();
    const phone = el('phone').value.trim();
    if (!phone) { showMsg(t('phone')); return; }

    el('btnCode').disabled = true;
    try {
      const resp = await fetch(API + '/api/customer/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, lang: window.CUSTOMER_LANG })
      });
      const data = await resp.json();
      if (!data.success) { showMsg(data.error || 'Error'); el('btnCode').disabled = false; return; }

      let okText = t('code_sent');
      // 桩/测试模式：后端回传验证码，自动填入方便测试
      if (data.dev_code) {
        el('code').value = data.dev_code;
        okText += ' — ' + t('dev_code_hint') + ': ' + data.dev_code;
      }
      showMsg(okText, 'ok');

      countdown = 60;
      timer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(timer);
          el('btnCode').disabled = false;
          el('btnCode').textContent = t('get_code');
        } else {
          el('btnCode').textContent = countdown + t('resend');
        }
      }, 1000);
    } catch (e) {
      showMsg('Network error');
      el('btnCode').disabled = false;
    }
  });

  // 提交登录/注册
  el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg();
    const phone = el('phone').value.trim();
    const code = el('code').value.trim();
    const name = el('name').value.trim();
    if (!phone || !code) { showMsg(t('phone') + ' / ' + t('code')); return; }

    el('btnLogin').disabled = true;
    try {
      const resp = await fetch(API + '/api/customer/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, name, lang: window.CUSTOMER_LANG })
      });
      const data = await resp.json();
      if (!data.success) { showMsg(data.error || 'Error'); el('btnLogin').disabled = false; return; }

      localStorage.setItem('customer_token', data.token);
      localStorage.setItem('customer_info', JSON.stringify(data.customer));
      if (data.customer.language) window.setCustomerLang(data.customer.language);
      showMsg(t('login_success'), 'ok');
      setTimeout(() => { location.href = '/customer-portal.html'; }, 400);
    } catch (e) {
      showMsg('Network error');
      el('btnLogin').disabled = false;
    }
  });

  applyLang();
})();
