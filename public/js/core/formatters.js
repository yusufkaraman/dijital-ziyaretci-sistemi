(function() {
  if (window.__vdFormattersLoaded) return;
  window.__vdFormattersLoaded = true;

  function vdFormatTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function vdFormatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('tr-TR');
  }

  function vdCalcDuration(v) {
    if (!v || !v.arrival_time) return '—';
    const end = v.checkout_time ? new Date(v.checkout_time) : new Date();
    const mins = Math.floor((end - new Date(v.arrival_time)) / 60000);
    return mins < 60 ? (mins + ' dk') : (Math.floor(mins / 60) + ' sa ' + (mins % 60) + ' dk');
  }

  function vdVisitorTimeSummary(v, formatter) {
    const format = typeof formatter === 'function' ? formatter : vdFormatTime;
    const entry = v && v.arrival_time ? format(v.arrival_time) : 'Giriş bekleniyor';
    const exit = v && v.checkout_time ? format(v.checkout_time) : '—';
    return 'Giriş: ' + entry + ' · Çıkış: ' + exit;
  }

  /** HTML-escape user-supplied strings to prevent XSS via innerHTML */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Validate Turkish TC Kimlik No: exactly 11 digits */
  function isValidTC(tc) {
    return /^\d{11}$/.test(tc);
  }

  /** Validate email format */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Validate Turkish phone: 10-11 digits, optional leading +90 or 0 */
  function isValidPhone(phone) {
    const digits = phone.replace(/[\s\-\(\)\+]/g, '');
    if (digits.startsWith('90')) return /^\d{12}$/.test(digits);
    if (digits.startsWith('0')) return /^\d{11}$/.test(digits);
    return /^\d{10}$/.test(digits);
  }

  /**
   * Wrap an async action so that the triggering button is disabled while it runs.
   * Usage: onclick="withButtonLock(this, () => saveUser(123))"
   * Or call programmatically: withButtonLock(btnEl, asyncFn)
   */
  async function withButtonLock(btn, fn) {
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const origText = btn.textContent;
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  window.esc = esc;
  window.isValidTC = isValidTC;
  window.isValidEmail = isValidEmail;
  window.isValidPhone = isValidPhone;
  window.withButtonLock = withButtonLock;
  window.vdFormatTime = vdFormatTime;
  window.vdFormatDate = vdFormatDate;
  window.vdCalcDuration = vdCalcDuration;
  window.vdVisitorTimeSummary = vdVisitorTimeSummary;

  if (typeof window.formatTime !== 'function') window.formatTime = vdFormatTime;
  if (typeof window.formatDate !== 'function') window.formatDate = vdFormatDate;
  if (typeof window.calcDuration !== 'function') window.calcDuration = vdCalcDuration;
  if (typeof window.visitorTimeSummary !== 'function') window.visitorTimeSummary = vdVisitorTimeSummary;
})();
