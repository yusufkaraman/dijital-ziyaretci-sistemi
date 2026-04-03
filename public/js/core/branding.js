(function() {
  if (window.__vdBrandingLoaded) return;
  window.__vdBrandingLoaded = true;

  function detectLogoId() {
    const candidates = ['panel-logo-img', 'manager-logo-img', 'personel-logo-img'];
    for (let i = 0; i < candidates.length; i++) {
      if (document.getElementById(candidates[i])) return candidates[i];
    }
    return null;
  }

  async function vdApplyPanelBranding(options) {
    const opts = options || {};
    try {
      if (!window.api || typeof window.api.getScreenState !== 'function') return;
      const state = await window.api.getScreenState();
      const logoPath = (state && state.settings && (state.settings.lobby_logo_path || state.settings.company_logo_path)) || '/Assets/sitelogo.png';
      const logoId = opts.logoElementId || detectLogoId();
      const logoImg = logoId ? document.getElementById(logoId) : null;
      if (logoImg && logoPath) logoImg.src = logoPath;
    } catch (e) {
      console.warn('Branding load failed', e.message);
    }
  }

  function vdApplyUserChip(user, options) {
    if (!user) return;
    const opts = options || {};
    const nameEl = document.getElementById(opts.nameElementId || 'user-name');
    const avatarEl = document.getElementById(opts.avatarElementId || 'user-av');
    const roleEl = document.getElementById(opts.roleElementId || 'sidebar-role');
    const roleMap = opts.roleMap || null;

    if (nameEl) nameEl.textContent = user.full_name || '';
    if (avatarEl) {
      const name = user.full_name || '?';
      avatarEl.textContent = name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('');
    }
    if (roleEl && roleMap) roleEl.textContent = roleMap[user.role] || user.role || '';
  }

  window.vdApplyPanelBranding = vdApplyPanelBranding;
  window.vdApplyUserChip = vdApplyUserChip;

  if (typeof window.applyPanelBranding !== 'function') window.applyPanelBranding = vdApplyPanelBranding;
})();
