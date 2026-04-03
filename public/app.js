// Step 5 compatibility shim:
// Keep index.html contract (/app.js) while loading the modular panel runtime.
(function () {
  const runtimeScripts = [
    '/js/modules/dashboard.js',
    '/js/modules/visitors.js',
    '/js/modules/checkin.js',
    '/js/modules/appointments.js',
    '/js/modules/rooms.js',
    '/js/modules/personnel.js',
    '/js/modules/blacklist.js',
    '/js/modules/reports.js',
    '/js/modules/settings.js',
    '/js/modules/screen.js',
    '/js/panels/secretary-panel.js',
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(script);
    });
  }

  async function boot() {
    for (const src of runtimeScripts) {
      await loadScript(src);
    }
  }

  boot().catch((error) => {
    console.error('Secretary panel bootstrap failed:', error);
    if (typeof window.vdShowToast === 'function') {
      window.vdShowToast('Panel dosyalari yuklenemedi', 'error');
    }
  });
})();
