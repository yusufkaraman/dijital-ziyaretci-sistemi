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

  window.vdFormatTime = vdFormatTime;
  window.vdFormatDate = vdFormatDate;
  window.vdCalcDuration = vdCalcDuration;

  if (typeof window.formatTime !== 'function') window.formatTime = vdFormatTime;
  if (typeof window.formatDate !== 'function') window.formatDate = vdFormatDate;
  if (typeof window.calcDuration !== 'function') window.calcDuration = vdCalcDuration;
})();
