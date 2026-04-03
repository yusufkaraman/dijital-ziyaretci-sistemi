(function() {
  if (window.__vdPasswordLoaded) return;
  window.__vdPasswordLoaded = true;

  function vdShowChangePasswordModal() {
    if (typeof window.vdShowModal !== 'function') return;
    window.vdShowModal('Sifre Degistir',
      '<div style="display:grid;gap:12px">' +
        '<div><label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Mevcut Sifre *</label><input type="password" id="cp-current" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px" placeholder="Mevcut sifreniz"></div>' +
        '<div><label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Yeni Sifre *</label><input type="password" id="cp-new" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px" placeholder="En az 8 karakter"></div>' +
        '<div><label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Yeni Sifre (Tekrar) *</label><input type="password" id="cp-confirm" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px" placeholder="Yeni sifreyi tekrar yazin"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">' +
          '<button class="btn-link" onclick="closeModal()">Iptal</button>' +
          '<button class="btn-primary" onclick="submitPasswordChange()">Sifreyi Guncelle</button>' +
        '</div>' +
      '</div>'
    );
  }

  async function vdSubmitPasswordChange() {
    const currentEl = document.getElementById('cp-current');
    const newEl = document.getElementById('cp-new');
    const confirmEl = document.getElementById('cp-confirm');
    const currentPassword = currentEl ? currentEl.value : '';
    const newPassword = newEl ? newEl.value : '';
    const confirmPassword = confirmEl ? confirmEl.value : '';

    if (!currentPassword || !newPassword || !confirmPassword) {
      return window.vdShowToast('Lutfen tum sifre alanlarini doldurun.', 'error');
    }
    if (newPassword.length < 8) {
      return window.vdShowToast('Yeni sifre en az 8 karakter olmalidir.', 'error');
    }
    if (newPassword !== confirmPassword) {
      return window.vdShowToast('Yeni sifre ve tekrari ayni olmalidir.', 'error');
    }

    try {
      await window.api.changePassword({ current_password: currentPassword, new_password: newPassword });
      window.vdCloseModal();
      window.vdShowToast('Sifreniz basariyla guncellendi.');
    } catch (e) {
      window.vdShowToast(e.message, 'error');
    }
  }

  window.vdShowChangePasswordModal = vdShowChangePasswordModal;
  window.vdSubmitPasswordChange = vdSubmitPasswordChange;

  if (typeof window.showChangePasswordModal !== 'function') window.showChangePasswordModal = vdShowChangePasswordModal;
  if (typeof window.submitPasswordChange !== 'function') window.submitPasswordChange = vdSubmitPasswordChange;
})();
