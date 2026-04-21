(function() {
  if (window.__vdPwaInstallLoaded) return;
  window.__vdPwaInstallLoaded = true;

  var deferredPrompt = null;
  var isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent || '');
  var isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent || '');
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent || '');

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  }

  function getButton() {
    return document.getElementById('pwa-install-btn');
  }

  function setButtonLabel(label) {
    var btn = getButton();
    if (!btn) return;
    var textEl = btn.querySelector('span');
    if (textEl) textEl.textContent = label;
  }

  function showInstallButton() {
    var btn = getButton();
    if (!btn) return;
    btn.style.display = '';
  }

  function hideInstallButton() {
    var btn = getButton();
    if (!btn) return;
    btn.style.display = 'none';
  }

  function refreshInstallButton() {
    if (isStandalone()) {
      hideInstallButton();
      return;
    }

    if (deferredPrompt) {
      setButtonLabel('Indir');
      showInstallButton();
      return;
    }

    if (isIos) {
      setButtonLabel('Ekle');
      showInstallButton();
      return;
    }

    if (isMobile) {
      setButtonLabel('Indir');
      showInstallButton();
      return;
    }

    hideInstallButton();
  }

  function notify(message, level) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, level || 'info');
      return;
    }
    window.alert(message);
  }

  function prepareIosInstallState() {
    if (!isIos || isStandalone()) return;
    setButtonLabel('Ekle');
    showInstallButton();
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled', function() {
    deferredPrompt = null;
    hideInstallButton();
  });

  window.addEventListener('pageshow', refreshInstallButton);

  window.vdInstallPwa = async function() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      var result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        deferredPrompt = null;
        hideInstallButton();
      }
      return;
    }

    if (isIos && !isStandalone()) {
      if (!isSafari) {
        notify("iPhone'da uygulamayi kurmak icin bu sayfayi Safari'de acip Paylas > Ana Ekrana Ekle yolunu izleyin.", 'info');
        return;
      }
      notify("Safari'de alttaki Paylas dugmesine dokunup 'Ana Ekrana Ekle' secenegiyle uygulamayi kurabilirsiniz.", 'info');
      return;
    }

    if (isMobile) {
      notify("Tarayiciniz kurulum penceresini henuz acmadi. Tarayici menüsünden 'Uygulamayi yukle' veya 'Ana ekrana ekle' secenegini kullanabilirsiniz.", 'info');
      return;
    }

    notify('Bu cihaz veya tarayici PWA kurulum penceresini su anda desteklemiyor.', 'info');
  };

  document.addEventListener('DOMContentLoaded', function() {
    prepareIosInstallState();
    refreshInstallButton();
  });
})();
