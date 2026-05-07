(function() {
  if (window.__vdUiLoaded) return;
  window.__vdUiLoaded = true;

  function vdShowToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    const level = type || 'success';
    t.textContent = msg || '';
    t.className = level === 'success' ? 'toast show' : ('toast show ' + level);
    setTimeout(function() {
      t.classList.remove('show');
    }, 3500);
  }

  function vdShowModal(title, content) {
    const legacy = document.getElementById('modal-overlay');
    const legacyTitle = document.getElementById('modal-title');
    const legacyBody = document.getElementById('modal-body');
    if (legacy && legacyTitle && legacyBody) {
      legacyTitle.textContent = title || '';
      legacyBody.innerHTML = content || '';
      legacy.classList.add('open');
      return;
    }

    const generic = document.getElementById('generic-modal-overlay');
    const genericTitle = document.getElementById('generic-modal-title');
    const genericBody = document.getElementById('generic-modal-body');
    if (generic && genericTitle && genericBody) {
      genericTitle.textContent = title || '';
      genericBody.innerHTML = content || '';
      generic.classList.add('open');
      generic.style.display = 'flex';
      document.body.classList.add('modal-open');
    }
  }

  function vdCloseModal() {
    const legacy = document.getElementById('modal-overlay');
    if (legacy) legacy.classList.remove('open');

    const generic = document.getElementById('generic-modal-overlay');
    if (generic) {
      generic.classList.remove('open');
      generic.style.display = 'none';
    }

    document.body.classList.remove('modal-open');
  }

  window.vdShowToast = vdShowToast;
  window.vdShowModal = vdShowModal;
  window.vdCloseModal = vdCloseModal;

  if (typeof window.showToast !== 'function') window.showToast = vdShowToast;
  if (typeof window.showModal !== 'function') window.showModal = vdShowModal;
  if (typeof window.closeModal !== 'function') window.closeModal = vdCloseModal;
})();
