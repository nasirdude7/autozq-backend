/**
 * auth-guard.js — 前端共享认证守卫
 *
 * 作用：
 *  1. 页面加载即检查登录态，未登录跳转 login.html
 *  2. 提供 window.API_BASE（同源，去掉 localhost 硬编码）
 *  3. 提供 window.authFetch()：自动注入 Bearer token；401/403 自动清 token 跳登录
 *
 * 用法：在需要登录的页面 <head> 里最先引入：
 *   <script src="/js/auth-guard.js"></script>
 * 然后把业务里的 fetch(...) 换成 authFetch(...)，API_BASE 用 window.API_BASE。
 */
(function () {
  'use strict';

  // 同源基地址：本地/服务器都自动正确，无需再硬编码 http://localhost:3001
  var API_BASE = window.location.origin;
  window.API_BASE = API_BASE;

  function getToken() {
    return localStorage.getItem('token');
  }

  function redirectToLogin() {
    // 记录当前页，登录后可选择性跳回
    try {
      localStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
    } catch (e) { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!/login\.html$/.test(window.location.pathname)) {
      window.location.href = '/login.html';
    }
  }

  // 页面级守卫：没有 token 直接跳登录
  if (!getToken()) {
    redirectToLogin();
  }

  /**
   * authFetch(url, options)
   * - 自动带上 Authorization: Bearer <token>
   * - 收到 401/403 视为登录失效，清 token 跳登录
   * 返回与 fetch 相同的 Response（401/403 时在跳转前抛出，便于调用方停下）
   */
  window.authFetch = async function (url, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});

    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var res = await fetch(url, Object.assign({}, options, { headers: headers }));

    if (res.status === 401 || res.status === 403) {
      redirectToLogin();
      throw new Error('登录已失效，请重新登录');
    }
    return res;
  };

  // 登出helper
  window.authLogout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  };
})();
