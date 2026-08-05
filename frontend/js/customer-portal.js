/**
 * 客户个人中心：我的报价列表 + 详情 + 接受
 */
(function () {
  if (!window.requireCustomerLogin()) return;
  const API = window.CUSTOMER_API_BASE;
  const el = (id) => document.getElementById(id);

  const info = JSON.parse(localStorage.getItem('customer_info') || '{}');
  if (info.language) window.setCustomerLang(info.language);

  function applyLang() {
    document.documentElement.lang = window.CUSTOMER_LANG;
    el('pageTitle').textContent = t('my_quotes');
    el('btnLogout').textContent = t('logout');
    el('welcome').textContent = t('welcome') + (info.name ? ', ' + info.name : '');
    el('modalClose').textContent = t('back');
    document.querySelectorAll('header .lang button').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === window.CUSTOMER_LANG);
    });
    if (lastQuotes) render(lastQuotes);
  }

  document.querySelectorAll('header .lang button').forEach((b) => {
    b.addEventListener('click', () => { window.setCustomerLang(b.dataset.lang); applyLang(); });
  });

  el('btnLogout').addEventListener('click', () => window.customerLogout());
  el('modalClose').addEventListener('click', () => el('overlay').classList.remove('show'));

  function fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleDateString(window.CUSTOMER_LANG === 'zh' ? 'zh-CN' : window.CUSTOMER_LANG === 'ru' ? 'ru-RU' : 'en-US'); }
    catch { return s; }
  }
  function statusLabel(s) { return t('status_' + s) || s; }

  let lastQuotes = null;

  function render(quotes) {
    lastQuotes = quotes;
    const list = el('list');
    if (!quotes || quotes.length === 0) {
      list.innerHTML = '<div class="empty">' + t('no_quotes') + '</div>';
      return;
    }
    list.innerHTML = quotes.map((q) => {
      const amount = q.currency + ' ' + Number(q.total).toLocaleString();
      const canAccept = q.status === 'sent';
      return (
        '<div class="quote-card">' +
          '<div class="info">' +
            '<div class="no">' + t('quote_no') + ': ' + q.quotation_no + '</div>' +
            '<div class="amount">' + amount + '</div>' +
            '<div class="meta">' + t('valid_until') + ': ' + fmtDate(q.valid_until) + '</div>' +
            '<div style="margin-top:6px"><span class="badge ' + q.status + '">' + statusLabel(q.status) + '</span></div>' +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn-sm btn-view" data-view="' + q.id + '">' + t('view') + '</button>' +
            (canAccept ? '<button class="btn-sm btn-accept" data-accept="' + q.id + '">' + t('accept') + '</button>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('[data-view]').forEach((b) =>
      b.addEventListener('click', () => viewQuote(b.dataset.view)));
    list.querySelectorAll('[data-accept]').forEach((b) =>
      b.addEventListener('click', () => acceptQuote(b.dataset.accept)));
  }

  async function loadQuotes() {
    try {
      const resp = await window.customerFetch(API + '/api/customer/quotations');
      const data = await resp.json();
      if (data.success) render(data.data);
    } catch (e) { /* guard 已处理跳转 */ }
  }

  async function viewQuote(id) {
    try {
      const resp = await window.customerFetch(API + '/api/customer/quotations/' + id);
      const data = await resp.json();
      if (!data.success) return;
      el('modalTitle').textContent = t('quote_no') + ': ' + data.data.quotation_no;
      const frame = el('modalFrame');
      // 用 srcdoc 渲染服务端生成的报价 HTML
      frame.srcdoc = data.data.html_content || '<p style="padding:20px">No content</p>';
      el('overlay').classList.add('show');
    } catch (e) { /* ignore */ }
  }

  async function acceptQuote(id) {
    if (!confirm(t('accept_confirm'))) return;
    try {
      const resp = await window.customerFetch(API + '/api/customer/quotations/' + id + '/accept', { method: 'POST' });
      const data = await resp.json();
      if (data.success) { alert(t('accept_success')); loadQuotes(); }
      else alert(data.error || 'Error');
    } catch (e) { /* ignore */ }
  }

  applyLang();
  loadQuotes();

  // 支持 ?quote=<id> 直接打开某张报价（来自聊天卡片链接）
  const params = new URLSearchParams(location.search);
  const openId = params.get('quote');
  if (openId) setTimeout(() => viewQuote(openId), 300);
})();
