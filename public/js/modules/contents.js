async function loadScreensContent() {
  const contents = await api.getContents();
  const grid = document.getElementById('screens-content-grid');
  grid.innerHTML = contents.map(c => `
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;overflow:hidden;position:relative">
      ${c.type === 'image' ? `<img src="${c.file_path}" style="width:100%;height:100px;object-fit:cover"/>` : 
        `<div style="height:100px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px">▶️</div>`}
      <div style="padding:10px">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.title}">${c.title}</div>
        <div style="display:flex;justify-content:space-between;margin-top:5px">
          <button class="btn-text" style="color:var(--red)" onclick="deleteContent(${c.id})">Sil</button>
          <span style="font-size:10px;color:var(--text-3)">${c.type.toUpperCase()}</span>
        </div>
      </div>
    </div>`).join('');
  if (contents.length === 0) grid.innerHTML = '<div class="empty-state">Henüz içerik yüklenmemiş.</div>';
}

async function uploadMediaFile(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('media', file);
  formData.append('title', file.name);

  showToast('Dosya yükleniyor...', 'info');
  try {
    await api.uploadContent(formData);
    showToast('Medya başarıyla yüklendi');
    loadScreensContent();
  } catch(e) { showToast(e.message, 'error'); }
  input.value = '';
}

async function deleteContent(id) {
  if (!confirm('Bu içeriği silmek istediğinize emin misiniz?')) return;
  await api.deleteContent(id);
  showToast('İçerik silindi'); loadScreensContent();
}

