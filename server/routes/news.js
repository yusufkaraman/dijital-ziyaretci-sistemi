const express = require('express');
const router  = express.Router();

// ── Cache (30 dk) ─────────────────────────────────────────
let cache = { data: null, timestamp: 0 };
const CACHE_MS = 30 * 60 * 1000;

// ── RSS Kaynakları ─────────────────────────────────────────
// Türkçe: Google News YZ ve Savunma
// İngilizce: BBC Technology, Defense News, TechCrunch AI
const RSS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=yapay+zeka+teknoloji&hl=tr&gl=TR&ceid=TR:tr',              lang: 'tr', label: 'Google Haberler' },
  { url: 'https://news.google.com/rss/search?q=savunma+sanayi+ASELSAN+askeri+teknoloji&hl=tr&gl=TR&ceid=TR:tr', lang: 'tr', label: 'Google Haberler' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',                                               lang: 'en', label: 'BBC Technology' },
  { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml',                              lang: 'en', label: 'Defense News' },
  { url: 'https://feeds.feedburner.com/TechCrunch/',                                                       lang: 'en', label: 'TechCrunch' },
];

// ── Fetch with AbortController timeout ────────────────────
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── XML Yardımcıları ──────────────────────────────────────
function extractTag(xml, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i'
  );
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : (m[2] || '')).trim();
}

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

function parseItems(xmlText, feed) {
  const items  = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;

  while ((m = itemRe.exec(xmlText)) !== null) {
    const block  = m[1];
    const title  = decodeHtml(extractTag(block, 'title'));
    if (!title || title.length < 6) continue;

    const link   = extractTag(block, 'link') || '';
    const pub    = extractTag(block, 'pubDate');
    let   source = decodeHtml(extractTag(block, 'source'));
    if (!source) source = feed.label;

    items.push({
      title,
      link,
      source,
      pub,
      lang: feed.lang,
    });
  }
  return items;
}

// ── GET /api/news ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.timestamp < CACHE_MS)) {
      return res.json(cache.data);
    }

    const allItems = [];
    const seen     = new Set();

    await Promise.allSettled(
      RSS_FEEDS.map(async (feed) => {
        try {
          const r = await fetchWithTimeout(feed.url, 9000);
          if (!r.ok) { console.warn('[News] HTTP', r.status, feed.url); return; }
          const xml   = await r.text();
          const items = parseItems(xml, feed);
          let added = 0;
          for (const item of items) {
            if (!seen.has(item.title)) {
              seen.add(item.title);
              allItems.push(item);
              added++;
            }
          }
          console.log(`[News] ${feed.label}: ${added} haber (${feed.lang})`);
        } catch (e) {
          console.warn('[News] Feed hatası:', feed.label, '-', e.message);
        }
      })
    );

    // Tarihe göre sırala — önce Türkçe, sonra İngilizce
    allItems.sort((a, b) => {
      // Önce dil grupla: tr önce
      if (a.lang !== b.lang) return a.lang === 'tr' ? -1 : 1;
      const da = a.pub ? new Date(a.pub) : 0;
      const db = b.pub ? new Date(b.pub) : 0;
      return (isNaN(Number(db)) ? 0 : Number(db)) - (isNaN(Number(da)) ? 0 : Number(da));
    });

    const result = {
      articles:  allItems.slice(0, 30),
      total:     allItems.length,
      timestamp: now,
    };
    cache = { data: result, timestamp: now };
    res.json(result);

  } catch (err) {
    console.error('[News]', err.message);
    if (cache.data) return res.json(cache.data);
    res.status(500).json({ articles: [], error: err.message });
  }
});

module.exports = router;
