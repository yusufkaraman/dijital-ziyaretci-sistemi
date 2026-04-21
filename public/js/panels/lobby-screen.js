'use strict';

// ═══════════════════ ARAÇLAR ═══════════════════

const $ = (id) => document.getElementById(id);
const setText = (id, val) => { const el = $(id); if (el) el.textContent = (val != null ? val : '—'); };
const safeEsc = (value) => {
  if (typeof window.esc === 'function') return window.esc(value);
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ── SVG Hava Durumu İkonları ──────────────────────────
const WEATHER_SVG = {
  sunny: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`,
  cloudy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
  </svg>`,
  rainy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
    <line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/>
    <line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/>
    <line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/>
  </svg>`,
  snowy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
    <line x1="8" y1="15" x2="8" y2="21"/><line x1="16" y1="15" x2="16" y2="21"/>
    <line x1="12" y1="13" x2="12" y2="19"/>
    <polyline points="7 18 8 16 9 18"/><polyline points="15 18 16 16 17 18"/>
    <polyline points="11 16 12 14 13 16"/>
  </svg>`,
  foggy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 15h18"/><path d="M3 19h18"/><path d="M5 11a7 7 0 0 1 14 0"/>
  </svg>`,
  stormy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
    <polyline points="13 11 9 17 15 17 11 23"/>
  </svg>`,
};

function weatherSVG(status) {
  return WEATHER_SVG[status] || WEATHER_SVG.cloudy;
}

// ── Forecast SVG (küçük) ──────────────────────────────
function forecastSVG(status) {
  const s = WEATHER_SVG[status] || WEATHER_SVG.cloudy;
  return s; // aynı SVG, CSS ile boyut ayarlanır (.lb-forecast-icon svg)
}

// Baş harfleri
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ═══════════════════ PARTİKÜLLER ═══════════════════

(function spawnParticles() {
  const c = $('lb-particles');
  if (!c) return;
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div');
    p.className = 'lb-particle';
    const size = 2 + Math.random() * 5;
    p.style.cssText = `left:${Math.random()*100}%;width:${size}px;height:${size}px;animation-duration:${14+Math.random()*20}s;animation-delay:${-Math.random()*34}s`;
    c.appendChild(p);
  }
})();

// ═══════════════════ SAAT ═══════════════════

const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2,'0');
  const mm  = String(now.getMinutes()).padStart(2,'0');
  setText('lb-clock-time', `${hh}:${mm}`);
  setText('lb-clock-date', now.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' }));
  setText('lb-clock-day',  DAYS_TR[now.getDay()]);
  // Footer tarih
  const fd = $('lb-ticker-date');
  if (fd) fd.textContent = now.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

// ═══════════════════ HAVA DURUMU ═══════════════════

async function loadWeather() {
  try {
    const data = await apiPublicFetch('/weather', { method: 'GET' });
    if (!data) return;

    setText('lb-weather-city', data.city || 'Ankara');
    setText('lb-weather-temp', data.temp != null ? `${data.temp}°C` : '—');
    setText('lb-weather-cond', data.condition || '');

    const iconEl = $('lb-weather-icon');
    if (iconEl) iconEl.innerHTML = weatherSVG(data.status);

    const extraEl = $('lb-weather-extra');
    if (extraEl) {
      const parts = [];
      if (data.feels_like != null) parts.push(`<span>Hissedilen <b>${safeEsc(String(data.feels_like))}°C</b></span>`);
      if (data.humidity != null)   parts.push(`<span>Nem <b>%${safeEsc(String(data.humidity))}</b></span>`);
      if (data.uv != null)         parts.push(`<span>UV Endeksi <b>${safeEsc(String(data.uv))}</b></span>`);
      if (data.wind != null)       parts.push(`<span>Rüzgar <b>${safeEsc(String(data.wind))} km/h ${safeEsc(data.wind_dir || '')}</b></span>`);
      extraEl.innerHTML = parts.join('');
    }

    const forecastEl = $('lb-weather-forecast');
    if (forecastEl && Array.isArray(data.forecast) && data.forecast.length) {
      forecastEl.innerHTML = data.forecast.slice(0,3).map(day => `
        <div class="lb-forecast-day">
          <div class="lb-forecast-name">${safeEsc(day.day || '')}</div>
          <div class="lb-forecast-icon">${forecastSVG(day.status)}</div>
          <div class="lb-forecast-hi">${day.max != null ? safeEsc(String(day.max)) + '°' : '—'}</div>
          <div class="lb-forecast-lo">${day.min != null ? safeEsc(String(day.min)) + '°' : ''}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('[Lobi] Hava durumu:', err.message);
  }
}

// ═══════════════════ GERÇEK HABERLER (RSS) ═══════════════════

let newsArticles    = [];
let newsDisplayIdx  = 0;

async function loadNews() {
  try {
    const data = await apiPublicFetch('/news', { method: 'GET' });
    if (data && Array.isArray(data.articles) && data.articles.length) {
      newsArticles   = data.articles;
      newsDisplayIdx = 0;
      renderNews();
    }
  } catch (err) {
    console.warn('[Lobi] Haberler yüklenemedi:', err.message);
  }
}

function renderNews(doAdvance = true) {
  const listEl = $('lb-news-list');
  if (!listEl || !newsArticles.length) return;

  const visibleCount = document.fullscreenElement ? 6 : 4;
  const items = [];
  for (let i = 0; i < visibleCount; i++) {
    const article = newsArticles[(newsDisplayIdx + i) % newsArticles.length];
    if (!article) continue;

    items.push(`
      <div class="lb-news-item" style="animation-delay:${i*0.07}s">
        <div class="lb-news-body">
          <div class="lb-news-title">${safeEsc(article.title)}</div>
          <div class="lb-news-source">${safeEsc(article.source || '')}</div>
        </div>
      </div>
    `);
  }
  listEl.innerHTML = items.join('');
  if (doAdvance) {
    newsDisplayIdx = (newsDisplayIdx + 1) % Math.max(1, newsArticles.length);
  }
}

// ═══════════════════ VİDEO DÖNGÜSÜ ═══════════════════

let mediaQueue  = [];
let mediaIdx    = 0;
let mediaTimer  = null;
let normalMediaQueue = [];
let isCompanyMode    = false;
let currentCompanyId = null;
let defaultCompanyId = null;
let cachedMediaItems = [];
const MAX_CACHED_MEDIA_ITEMS = 200;
const failedMediaSources = new Set();
let currentVisitorCardMedia = null;
let activeHostMediaContext = null;

function showMediaPlaceholder() {
  const ph = $('lb-video-placeholder');
  if (ph) ph.style.display = 'flex';
}

function hideMediaPlaceholder() {
  const ph = $('lb-video-placeholder');
  if (ph) ph.style.display = 'none';
}

function stopMediaTimer() {
  if (!mediaTimer) return;
  clearTimeout(mediaTimer);
  mediaTimer = null;
}

function setVisitorCardMedia(item) {
  const wrap = $('lb-visitor-media-wrap');
  const img = $('lb-visitor-card-media');
  if (!wrap || !img) return;

   wrap.classList.remove('is-logo-plate', 'is-light-logo');
   img.classList.remove('is-light-logo');

  if (item && item.type === 'image' && item.src) {
    currentVisitorCardMedia = item;
    img.src = item.src;
    img.alt = item.title || 'Sirket gorseli';
    img.style.removeProperty('aspect-ratio');
    if (item.is_logo_plate) {
      wrap.classList.add('is-logo-plate');
      applyAdaptiveLogoPlate(img, wrap);
    }
    wrap.style.display = 'block';
    return;
  }

  currentVisitorCardMedia = null;
  img.removeAttribute('src');
  img.alt = '';
  wrap.style.display = 'none';
}

function normalizeMediaItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((c) => c.is_active && (c.type === 'video' || c.type === 'image') && c.file_path)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .slice(0, MAX_CACHED_MEDIA_ITEMS)
    .map((c) => ({
      type: c.type,
      src: c.file_path,
      title: c.title || '',
      company_id: c.company_id || null,
    }));
}

function getHealthyMediaItems(items) {
  return items.filter((item) => !failedMediaSources.has(item.src));
}

function getCompanyTaggedImage(companyId) {
  if (!companyId) return null;
  const healthyItems = getHealthyMediaItems(cachedMediaItems);
  return healthyItems.find((item) =>
    item.type === 'image' && Number(item.company_id) === Number(companyId)
  ) || null;
}

function buildNormalMediaQueue() {
  const healthyItems = getHealthyMediaItems(cachedMediaItems)
    .filter((item) => item.type === 'video');
  const generalItems = healthyItems.filter((item) => !item.company_id);
  if (generalItems.length) return generalItems;

  const defaultCompanyItems = defaultCompanyId
    ? healthyItems.filter((item) => Number(item.company_id) === Number(defaultCompanyId))
    : [];
  if (defaultCompanyItems.length) return defaultCompanyItems;

  return healthyItems;
}

function replaceMediaQueue(nextQueue) {
  const player = $('lb-video-player');
  const oldSrc = mediaQueue[mediaIdx]?.src;
  mediaQueue = Array.isArray(nextQueue) ? [...nextQueue] : [];

  if (!mediaQueue.length) {
    if (player) player.innerHTML = '';
    stopMediaTimer();
    showMediaPlaceholder();
    return;
  }

  const nextIdx = oldSrc ? mediaQueue.findIndex((item) => item.src === oldSrc) : -1;
  if (nextIdx !== -1) {
    mediaIdx = nextIdx;
    return;
  }

  mediaIdx = mediaQueue.length === 1
    ? 0
    : Math.floor(Math.random() * mediaQueue.length);
  playCurrentMedia();
}

function handleMediaError(src) {
  if (src) failedMediaSources.add(src);

  if (isCompanyMode) {
    mediaQueue = mediaQueue.filter((item) => item.src !== src);
    if (!mediaQueue.length) {
      revertToNormalContent();
      return;
    }
    if (mediaIdx >= mediaQueue.length) mediaIdx = 0;
    setTimeout(playCurrentMedia, 400);
    return;
  }

  normalMediaQueue = buildNormalMediaQueue();
  replaceMediaQueue(normalMediaQueue);
}

async function loadMediaQueue() {
  try {
    const all = await apiPublicFetch('/contents', { method: 'GET' });
    if (!Array.isArray(all)) return;
    // Normal rotation: only untagged (general) content — company-tagged content plays on visitor arrival
    cachedMediaItems = normalizeMediaItems(all);
    const mapped = buildNormalMediaQueue();

    // If in company mode, silently update the normal queue backup without interrupting
    if (isCompanyMode) {
      normalMediaQueue = mapped;
      return;
    }

    normalMediaQueue = mapped;
    replaceMediaQueue(mapped);
  } catch (err) {
    console.warn('[Lobi] Medya listesi:', err.message);
  }
}

async function switchToCompanyContent(companyId) {
  if (!companyId) return;
  try {
    const all = await apiPublicFetch('/contents?company_id=' + companyId, { method: 'GET' });
    if (!Array.isArray(all)) return;
    const items = getHealthyMediaItems(normalizeMediaItems(all));
    const imageItem = items.find((item) => item.type === 'image') || null;
    const videoItems = items.filter((item) => item.type === 'video');

    if (items.length === 0) return; // no company content — keep current

    if (!isCompanyMode) {
      normalMediaQueue = buildNormalMediaQueue();
    }

    isCompanyMode = true;
    currentCompanyId = companyId;
    setVisitorCardMedia(imageItem ? { ...imageItem, is_logo_plate: true } : null);

    if (videoItems.length) {
      mediaQueue = videoItems;
      mediaIdx = 0;
      playCurrentMedia();
    }
  } catch (err) {
    console.warn('[Lobi] Sirket icerik yuklenemedi:', err.message);
  }
}

function getHostMediaCompanyId(context) {
  if (!context || context.host_company_id == null) return null;
  const companyId = Number(context.host_company_id);
  return Number.isFinite(companyId) ? companyId : null;
}

function applyHostMediaContext(context) {
  const companyId = getHostMediaCompanyId(context);
  if (!companyId) {
    activeHostMediaContext = null;
    if (!activeVisitor) revertToNormalContent();
    return;
  }

  activeHostMediaContext = context || { host_company_id: companyId };
  if (!isCompanyMode || Number(currentCompanyId) !== Number(companyId)) {
    switchToCompanyContent(companyId);
  }
}

function revertToNormalContent() {
  if (!isCompanyMode) return;
  isCompanyMode = false;
  currentCompanyId = null;
  setVisitorCardMedia(null);
  stopMediaTimer();
  normalMediaQueue = buildNormalMediaQueue();

  if (normalMediaQueue.length > 0) {
    mediaQueue = [...normalMediaQueue];
    mediaIdx = normalMediaQueue.length === 1
      ? 0
      : Math.floor(Math.random() * normalMediaQueue.length);
    playCurrentMedia();
  } else {
    loadMediaQueue();
  }
}

function playCurrentMedia() {
  if (!mediaQueue.length) {
    showMediaPlaceholder();
    return;
  }
  const item   = mediaQueue[mediaIdx];
  const player = $('lb-video-player');
  if (!player) return;
  stopMediaTimer();

  player.innerHTML = '';
  hideMediaPlaceholder();

  if (item.type === 'video') {
    const v    = document.createElement('video');
    v.src      = item.src;
    v.autoplay = true;
    v.defaultMuted = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    if (mediaQueue.length === 1) {
      v.loop = true;
    } else {
      v.addEventListener('ended', playNextMedia);
      mediaTimer = setTimeout(playNextMedia, 5 * 60 * 1000);
    }
    v.addEventListener('error', () => { handleMediaError(item.src); });
    player.appendChild(v);
    v.play().catch(() => {});
  } else {
    const img  = document.createElement('img');
    img.src    = item.src; img.alt = item.title;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    img.addEventListener('error', () => { handleMediaError(item.src); });
    mediaTimer = setTimeout(playNextMedia, 15000);
    player.appendChild(img);
  }
}

function playNextMedia() {
  if (mediaQueue.length === 0) return;
  if (mediaQueue.length === 1) {
    playCurrentMedia();
    return;
  }
  
  let nextIdx;
  do {
    nextIdx = Math.floor(Math.random() * mediaQueue.length);
  } while (nextIdx === mediaIdx);
  
  mediaIdx = nextIdx;
  playCurrentMedia();
}

// ═══════════════════ AYARLAR ═══════════════════

async function loadSettings() {
  try {
    const data = await apiPublicFetch('/screen/current', { method: 'GET' });
    if (!data || !data.settings) return;
    const s = data.settings;
    const nextDefaultCompanyId = data.company?.id ? Number(data.company.id) : null;
    const shouldRefreshMedia = !isCompanyMode && nextDefaultCompanyId !== defaultCompanyId;
    defaultCompanyId = nextDefaultCompanyId;

    if (s.company_name)  setText('lb-brand-name', s.company_name);
    const tickerBrandEl = $('lb-ticker-brand-text');
    if (tickerBrandEl) tickerBrandEl.textContent = '+90 532 743 69 62';
    if (s.welcome_title) setText('lb-welcome-bar-title', s.welcome_title);
    if (s.welcome_subtitle || s.welcome_message)
      setText('lb-welcome-bar-sub', s.welcome_subtitle || s.welcome_message);

    // Özel logo
    const rawLogoPath = s.logo_url || s.company_logo || s.lobby_logo_path || s.company_logo_path;
    if (rawLogoPath) {
      const logoEl = $('lb-logo-img');
      const normalizeLogo = typeof window.vdNormalizeBrandLogoPath === 'function'
        ? window.vdNormalizeBrandLogoPath
        : (value) => (/B%C4%B1kmazGrup\.jpg|BıkmazGrup\.jpg|BikmazGrup\.jpg/i.test(String(value || '')) ? '/Assets/sitelogo.png' : value);
      if (logoEl) logoEl.src = normalizeLogo(rawLogoPath);
    }

    // Ticker mesajları
    const tickerEl = $('lb-ticker-inner');
    if (tickerEl) {
      const msgs = (s.ticker_text || '').split('|').map(m => m.trim()).filter(Boolean);
      tickerEl.innerHTML = msgs.map(m =>
        `<span class="lb-ticker-item">${safeEsc(m)}</span>`
      ).join('');
    }

    applyScreenState(data);
    if (!data.host_media && !data.visitor && shouldRefreshMedia) loadMediaQueue();
  } catch (err) {
    console.warn('[Lobi] Ayarlar:', err.message);
  }
}

// ═══════════════════ ZİYARETÇİ OVERLAY ═══════════════════

let overlayTimer = null;
let activeVisitor = null;
let lobbyAudioCtx = null;
let lastOverlayBellVisitorId = null;

function playLobbyDoorbell() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = lobbyAudioCtx || (lobbyAudioCtx = new AudioCtx());
    if (ctx.state === 'suspended') ctx.resume();
    const playTone = (frequency, startOffset, duration, volume) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startOffset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      oscillator.start(ctx.currentTime + startOffset);
      oscillator.stop(ctx.currentTime + startOffset + duration);
    };
    playTone(659.25, 0, 1.2, 0.2);
    playTone(523.25, 0.5, 1.5, 0.15);
  } catch (_) {
    // no-op
  }
}

document.addEventListener('click', () => {
  if (lobbyAudioCtx && lobbyAudioCtx.state === 'suspended') lobbyAudioCtx.resume();
}, { once: true });

function applyAdaptiveLogoPlate(imgEl, wrapEl) {
  if (!imgEl) return;
  const targets = [imgEl, wrapEl].filter(Boolean);
  targets.forEach((el) => el.classList.remove('is-light-logo'));

  const markReady = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 24;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(imgEl, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size).data;
      let visiblePixels = 0;
      let brightPixels = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        const alpha = imageData[i + 3];
        if (alpha < 24) continue;
        visiblePixels += 1;
        const luminance = (0.2126 * imageData[i]) + (0.7152 * imageData[i + 1]) + (0.0722 * imageData[i + 2]);
        if (luminance >= 176) brightPixels += 1;
      }

      if (!visiblePixels) return;
      if ((brightPixels / visiblePixels) >= 0.52) {
        targets.forEach((el) => el.classList.add('is-light-logo'));
      }
    } catch (_) {
      // no-op
    }
  };

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    markReady();
    return;
  }

  imgEl.addEventListener('load', markReady, { once: true });
}

function showVisitorOverlay(visitor) {
  const overlay = $('lb-visitor-overlay');
  if (!overlay) return;
  const nextVisitorId = visitor && visitor.id != null ? Number(visitor.id) : null;
  const shouldRingBell = nextVisitorId !== null && nextVisitorId !== lastOverlayBellVisitorId;
  activeVisitor = visitor || null;
  const fallbackLogoItem = getCompanyTaggedImage(visitor.host_company_id);
  const hostLogoSrc = visitor.host_company_logo || fallbackLogoItem?.src || '';
  const infoLabels = overlay.querySelectorAll('.lb-visitor-info-lbl');
  if (infoLabels[1]) infoLabels[1].textContent = 'Sirket';

  setText('lb-visitor-name', visitor.full_name);
  // Misafirin kendi şirketi — girilmediyse boş bırak
  const companyEl = $('lb-visitor-company');
  if (companyEl) {
    companyEl.textContent = visitor.company_name || '';
    companyEl.style.display = visitor.company_name ? '' : 'none';
  }
  setText('lb-visitor-host', visitor.host_name || '—');
  setText('lb-visitor-host-company', visitor.host_company_name || '—');

  // Top logo disabled: keep a single logo in the lower media slot
  const cardLogoWrap = $('lb-visitor-logo-wrap');
  const cardLogoImg  = $('lb-visitor-card-logo');
  if (cardLogoWrap && cardLogoImg) {
    cardLogoWrap.style.display = 'none';
  }

  // Inline logo disabled: logo should only appear in the lower media slot
  const logoEl = $('lb-visitor-host-logo');
  if (logoEl) {
    logoEl.style.display = 'none';
  }

  overlay.classList.remove('screen-hide');
  if (shouldRingBell) {
    playLobbyDoorbell();
    lastOverlayBellVisitorId = nextVisitorId;
  }

  // Switch to company-specific content
  if (visitor.host_company_id) {
    applyHostMediaContext({
      source: 'visitor',
      id: visitor.id,
      full_name: visitor.full_name,
      planned_time: visitor.planned_time || null,
      arrival_time: visitor.arrival_time || null,
      host_company_id: visitor.host_company_id,
      host_company_name: visitor.host_company_name || null,
      host_company_logo: visitor.host_company_logo || null,
    });
  }
}

function hideVisitorOverlay(options) {
  const opts = options || {};
  const overlay = $('lb-visitor-overlay');
  if (overlay) overlay.classList.add('screen-hide');
  if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
  activeVisitor = null;
  lastOverlayBellVisitorId = null;
  if (!opts.preserveHostMedia) {
    activeHostMediaContext = null;
    setVisitorCardMedia(null);
    revertToNormalContent();
  }
}

function getPayloadVisitor(payload) {
  return payload && typeof payload === 'object' ? payload.visitor || null : null;
}

function getPayloadCompanyId(payload) {
  const visitor = getPayloadVisitor(payload);
  if (visitor && visitor.host_company_id != null) return Number(visitor.host_company_id);
  if (payload && payload.host_company_id != null) return Number(payload.host_company_id);
  return null;
}

function shouldHandleVisitorPayload(payload) {
  return Boolean(getPayloadVisitor(payload));
}

function shouldHideForPayload(payload) {
  if (getPayloadVisitor(payload)) return true;
  return Boolean(activeVisitor);
}

function safeSocketHandler(label, handler) {
  return function wrappedSocketHandler(payload) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[Lobi] Socket handler hatasi (${label})`, err);
    }
  };
}

async function syncVisitorOverlayWithServer(fallbackPayload) {
  try {
    const data = await apiPublicFetch('/screen/current', { method: 'GET' });
    if (data) {
      applyScreenState(data, fallbackPayload);
      return;
    }
    if (fallbackPayload && fallbackPayload.visitor && shouldHandleVisitorPayload(fallbackPayload)) {
      showVisitorOverlay(fallbackPayload.visitor);
      return;
    }
    hideVisitorOverlay();
  } catch (err) {
    console.warn('[Lobi] Ekran durumu senkronize edilemedi:', err.message);
    if (fallbackPayload && fallbackPayload.visitor && shouldHandleVisitorPayload(fallbackPayload)) {
      showVisitorOverlay(fallbackPayload.visitor);
    }
  }
}

function applyScreenState(data, fallbackPayload) {
  const visitor = data && data.visitor ? data.visitor : null;
  const hostMedia = data && data.host_media ? data.host_media : null;

  if (visitor && shouldHandleVisitorPayload({ visitor })) {
    showVisitorOverlay(visitor);
    return;
  }

  if (fallbackPayload && fallbackPayload.visitor && shouldHandleVisitorPayload(fallbackPayload)) {
    showVisitorOverlay(fallbackPayload.visitor);
    return;
  }

  if (hostMedia && getHostMediaCompanyId(hostMedia)) {
    hideVisitorOverlay({ preserveHostMedia: true });
    applyHostMediaContext(hostMedia);
    return;
  }

  hideVisitorOverlay();
}

async function syncHostMediaWithServer() {
  try {
    const data = await apiPublicFetch('/screen/current', { method: 'GET' });
    applyScreenState(data);
  } catch (err) {
    console.warn('[Lobi] Host medyasi senkronize edilemedi:', err.message);
  }
}

// ═══════════════════ SOCKET ═══════════════════

const socket = vdCreateSocket({
  autoReloadOnSystem: false,
  onConnect: () => {
    const d = $('lb-conn-dot');
    if (d) { d.classList.add('live'); d.classList.remove('dead'); }
  },
  onDisconnect: () => {
    const d = $('lb-conn-dot');
    if (d) { d.classList.remove('live'); d.classList.add('dead'); }
  },
  handlers: {
    'screen:update': safeSocketHandler('screen:update', (d) => {
      if ((d.action === 'arrived' || d.action === 'approved') && d.visitor && shouldHandleVisitorPayload(d)) {
        syncVisitorOverlayWithServer(d);
      } else if ((d.action === 'checkout' || d.action === 'left' || d.action === 'cancel') && shouldHideForPayload(d)) {
        syncHostMediaWithServer();
      }
    }),
    'visitor:approved': safeSocketHandler('visitor:approved', (d) => {
      if (d && d.visitor && shouldHandleVisitorPayload(d)) {
        syncVisitorOverlayWithServer(d);
      }
    }),
    'visitor:arrived': safeSocketHandler('visitor:arrived', (d) => {
      if (d && d.visitor && shouldHandleVisitorPayload(d)) {
        syncVisitorOverlayWithServer(d);
      }
    }),
    'visitor:checkout': safeSocketHandler('visitor:checkout', (d) => {
      syncHostMediaWithServer();
    }),
    'visitor:cancelled': safeSocketHandler('visitor:cancelled', (d) => {
      syncHostMediaWithServer();
    }),
    'visitor:waiting': safeSocketHandler('visitor:waiting', () => syncHostMediaWithServer()),
    'visitor:deleted': safeSocketHandler('visitor:deleted', () => syncHostMediaWithServer()),
    'appointment:created': safeSocketHandler('appointment:created', () => syncHostMediaWithServer()),
    'appointment:updated': safeSocketHandler('appointment:updated', () => syncHostMediaWithServer()),
    'appointment:approved': safeSocketHandler('appointment:approved', () => syncHostMediaWithServer()),
    'appointment:cancelled': safeSocketHandler('appointment:cancelled', () => syncHostMediaWithServer()),
    'appointment:deleted': safeSocketHandler('appointment:deleted', () => syncHostMediaWithServer()),
    'content:updated': safeSocketHandler('content:updated', () => loadMediaQueue()),
    'settings:updated': safeSocketHandler('settings:updated', () => loadSettings()),
    'system:reload':    () => { /* Lobi'de yoksay */ },
  },
});

// ═══════════════════ TAM EKRAN ═══════════════════

const fsBtn = $('lb-fs-btn');
const fsIconEnter = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
</svg>`;
const fsIconExit = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 0 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
</svg>`;

function lobiToggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      if (fsBtn) { fsBtn.innerHTML = fsIconExit; fsBtn.classList.add('is-fullscreen'); }
    }).catch(err => console.warn('[Lobi] Fullscreen hatası:', err));
  } else {
    document.exitFullscreen().then(() => {
      if (fsBtn) { fsBtn.innerHTML = fsIconEnter; fsBtn.classList.remove('is-fullscreen'); }
    }).catch(() => {});
  }
}

if (fsBtn) fsBtn.innerHTML = fsIconEnter;
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && fsBtn) {
    fsBtn.innerHTML = fsIconEnter;
    fsBtn.classList.remove('is-fullscreen');
  }
  renderNews(false);
});
window.lobiToggleFullscreen = lobiToggleFullscreen;

// ═══════════════════ BAŞLAT ═══════════════════

(async function init() {
  await Promise.allSettled([
    loadSettings(),
    loadWeather(),
    loadMediaQueue(),
    loadNews(),
  ]);

  // Periyodik yenilemeler
  setInterval(loadWeather,    15 * 60 * 1000); // 15 dk
  setInterval(loadMediaQueue,  5 * 60 * 1000); // 5 dk
  setInterval(syncHostMediaWithServer, 30 * 1000); // host videosu icin yakin randevu kontrolu
  setInterval(loadSettings,   10 * 60 * 1000); // 10 dk
  setInterval(loadNews,       30 * 60 * 1000); // 30 dk (RSS cache ile uyumlu)
  setInterval(renderNews,     12 * 1000);       // 12 sn'de bir haberler kaydır
})();
