function printReport() { window.print(); }

// ── EKRAN YÖNETİMİ ────────────────────────────────────
function showScreenModal() {
  showModal('Lobi Ekranı', `
    <div style="text-align:center;padding:20px">
      <div style="font-size:48px;margin-bottom:16px">📺</div>
      <p style="margin-bottom:20px;color:var(--text-secondary)">Lobi ekranını ayrı sekmede açın</p>
      <a href="/lobi" target="_blank" class="btn-primary" style="text-decoration:none;display:inline-block">Lobi Ekranını Aç →</a>
    </div>`);
}

// ── MODAL ─────────────────────────────────────────────
function showModal(title, body) {
  return window.vdShowModal(title, body);
}

function closeModal() {
  return window.vdCloseModal();
}

// ── GRAFİKLER (Chart.js Destekli Entegre Yapı) ────────────────
// Grafik işlemleri ortak charts çekirdeği üzerinden yönetilir.

