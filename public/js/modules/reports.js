// ── RAPORLAR ──────────────────────────────────────────
async function loadReports() {
  const visitors = await api.getVisitors({});
  document.getElementById('rep-total').textContent = visitors.length;
  const thisMonth = visitors.filter(v => v.created_at?.startsWith(new Date().toISOString().slice(0,7)));
  document.getElementById('rep-month').textContent = thisMonth.length;

  const hostCount = {};
  visitors.forEach(v => { if (v.host_name) hostCount[v.host_name] = (hostCount[v.host_name]||0)+1; });
  const topHosts = Object.entries(hostCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('top-hosts-list').innerHTML = topHosts.length ?
    topHosts.map(([name, count], i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:18px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
        <div style="flex:1"><div style="font-weight:600">${name}</div></div>
        <span style="font-weight:700;color:var(--primary)">${count}</span>
      </div>`).join('') : '<div class="empty-state">Veri yok</div>';
}

