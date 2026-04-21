const express = require('express');
const router  = express.Router();
const https   = require('https');
const prisma  = require('../prisma');

// ── Native HTTPS GET with timeout ─────────────────────────
function httpsGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BikmazDesk/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
    }, (res) => {
      // Redirect desteği
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse hatası: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout (${timeoutMs}ms)`));
    });
  });
}



// ── Cache (15 dk) ─────────────────────────────────────────
let weatherCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 15 * 60 * 1000;

// ── wttr.in Weather Code → Internal Status ────────────────
function mapWttrCode(code) {
  const c = parseInt(code);
  if (c === 113) return 'sunny';
  if ([116, 119, 122].includes(c)) return 'cloudy';
  if ([143, 248, 260].includes(c)) return 'foggy';
  if ([200, 386, 389, 392, 395].includes(c)) return 'stormy';
  if ([179, 182, 227, 230, 323, 326, 329, 332, 335, 338, 350, 368, 371].includes(c)) return 'snowy';
  if ([176, 185, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308,
       311, 314, 317, 320, 353, 356, 359, 362, 365, 374, 377].includes(c)) return 'rainy';
  return 'cloudy';
}

// ── wttr.in Description → Türkçe ─────────────────────────
function conditionTR(desc, code) {
  const c = parseInt(code);
  if (c === 113) return 'Güneşli';
  if (c === 116) return 'Parçalı Bulutlu';
  if (c === 119) return 'Bulutlu';
  if (c === 122) return 'Kapalı';
  if ([143, 248, 260].includes(c)) return 'Sisli';
  if ([200, 386, 389, 392, 395].includes(c)) return 'Fırtınalı';
  if ([179, 182, 227, 230].includes(c)) return 'Kar Fırtınası';
  if ([323, 326, 329, 332, 335, 338, 350, 368, 371].includes(c)) return 'Karlı';
  if ([176, 185, 263, 266, 281, 284].includes(c)) return 'Hafif Yağmur';
  if ([293, 296, 299, 302, 305, 308].includes(c)) return 'Yağmurlu';
  if ([311, 314, 317, 320, 353, 356, 359].includes(c)) return 'Sağanak Yağış';
  if ([362, 365, 374, 377].includes(c)) return 'Karla Karışık Yağmur';
  return desc || 'Bilinmiyor';
}

// ── Day name (Türkçe) ─────────────────────────────────────
const DAY_NAMES_SHORT = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

function translateWindDir(dir) {
  const map = {
    'N': 'Kuzey', 'NNE': 'K. Kuzeydoğu', 'NE': 'Kuzeydoğu', 'ENE': 'D. Kuzeydoğu',
    'E': 'Doğu', 'ESE': 'D. Güneydoğu', 'SE': 'Güneydoğu', 'SSE': 'G. Güneydoğu',
    'S': 'Güney', 'SSW': 'G. Güneybatı', 'SW': 'Güneybatı', 'WSW': 'B. Güneybatı',
    'W': 'Batı', 'WNW': 'B. Kuzeybatı', 'NW': 'Kuzeybatı', 'NNW': 'K. Kuzeybatı'
  };
  return map[dir] || dir;
}

// ── Fetch from wttr.in ────────────────────────────────────
async function fetchFromWttr(city) {
  const url  = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  const data = await httpsGet(url, 9000);

  const cur  = data.current_condition[0];
  const code = parseInt(cur.weatherCode);

  // 3 günlük tahmin
  const forecast = [];
  if (Array.isArray(data.weather)) {
    for (let i = 1; i <= 3 && i < data.weather.length; i++) {
      const day    = data.weather[i];
      const dayCode = parseInt(day.hourly?.[4]?.weatherCode ?? 113);
      const d      = new Date(day.date);
      forecast.push({
        day:      DAY_NAMES_SHORT[d.getDay()],
        max:      parseInt(day.maxtempC),
        min:      parseInt(day.mintempC),
        status:   mapWttrCode(dayCode),
        condition: conditionTR(null, dayCode),
      });
    }
  }

  return {
    city:      city.includes(',') ? city.split(',')[0].trim() : city,
    temp:      parseInt(cur.temp_C),
    feels_like: parseInt(cur.FeelsLikeC),
    condition: conditionTR(cur.weatherDesc?.[0]?.value, code),
    status:    mapWttrCode(code),
    wind:      parseInt(cur.windspeedKmph),
    wind_dir:  translateWindDir(cur.winddir16Point),
    humidity:  parseInt(cur.humidity),
    uv:        parseFloat(cur.uvIndex),
    forecast,
    source:    'wttr.in',
    is_mock:   false,
  };
}

// ── Fetch from Open-Meteo (fallback) ─────────────────────
async function fetchFromOpenMeteo(city) {
  // WMO code → status
  function mapWMO(code) {
    if (code === 0) return 'sunny';
    if ([1,2,3].includes(code)) return 'cloudy';
    if ([45,48].includes(code)) return 'foggy';
    if ([95,96,99].includes(code)) return 'stormy';
    if ([71,73,75,77,85,86].includes(code)) return 'snowy';
    return 'rainy';
  }
  const CONDITIONS = {
    0:'Güneşli',1:'Açık',2:'Parçalı Bulutlu',3:'Bulutlu',
    45:'Sisli',48:'Kırağı Sis',
    51:'Hafif Çiseleme',53:'Çiseleme',55:'Yoğun Çiseleme',
    61:'Hafif Yağmur',63:'Yağmurlu',65:'Şiddetli Yağmur',
    71:'Hafif Kar',73:'Karlı',75:'Yoğun Kar',77:'Kar Taneleri',
    80:'Hafif Sağanak',81:'Sağanak',82:'Şiddetli Sağanak',
    95:'Fırtına',96:'Dolu Fırtına',99:'Şiddetli Fırtına',
  };

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`;
  const geoData = await httpsGet(geoUrl, 8000);
  if (!geoData.results?.length) throw new Error('Şehir bulunamadı');

  const { latitude, longitude, name } = geoData.results[0];
  const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,uv_index&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const data  = await httpsGet(wxUrl, 8000);

  const cw = data.current;
  if (!cw) throw new Error('Hava verisi alınamadı');
  
  const code = cw.weather_code;
  const daily = data.daily;
  const DAY_SHORT = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];

  const forecast = [];
  for (let i = 1; i <= 3; i++) {
    if (!daily?.time?.[i]) break;
    const d = new Date(daily.time[i]);
    forecast.push({
      day:      DAY_SHORT[d.getDay()],
      max:      Math.round(daily.temperature_2m_max[i]),
      min:      Math.round(daily.temperature_2m_min[i]),
      status:   mapWMO(daily.weathercode[i]),
      condition: CONDITIONS[daily.weathercode[i]] || '',
    });
  }

  function compassDir(deg) {
    const directions = ['Kuzey', 'K. Kuzeydoğu', 'Kuzeydoğu', 'D. Kuzeydoğu', 'Doğu', 'D. Güneydoğu', 'Güneydoğu', 'G. Güneydoğu', 'Güney', 'G. Güneybatı', 'Güneybatı', 'B. Güneybatı', 'Batı', 'B. Kuzeybatı', 'Kuzeybatı', 'K. Kuzeybatı'];
    return directions[Math.round((deg % 360) / 22.5) % 16];
  }

  return {
    city:      name,
    temp:      Math.round(cw.temperature_2m),
    feels_like: Math.round(cw.apparent_temperature),
    condition: CONDITIONS[code] || 'Bilinmiyor',
    status:    mapWMO(code),
    wind:      Math.round(cw.wind_speed_10m),
    wind_dir:  compassDir(cw.wind_direction_10m || 0),
    humidity:  Math.round(cw.relative_humidity_2m),
    uv:        cw.uv_index || 0,
    forecast,
    source:    'open-meteo',
    is_mock:   false,
  };
}

// ── GET /api/weather ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (weatherCache.data && (now - weatherCache.timestamp < CACHE_DURATION)) {
      return res.json(weatherCache.data);
    }

    const cityRow = await prisma.systemSetting.findUnique({ where: { key: 'weather_city' } });
    // .env'deki DEFAULT_CITY Türkçe karakter içerebilir — DB yoksa Ankara fallback
    let cityRaw = cityRow?.value || 'Ankara';
    // Tırnak, virgül sonrası, boşluk temizle
    const cityClean = cityRaw.replace(/['"]/g, '').split(',')[0].trim() || 'Ankara';

    let result = null;

    // 1. wttr.in dene
    try {
      result = await fetchFromWttr(cityClean);
      console.log(`[Weather] wttr.in OK: ${result.city} ${result.temp}°C`);
    } catch (e1) {
      console.warn('[Weather] wttr.in başarısız:', e1.message);
      // 2. Open-Meteo dene
      try {
        result = await fetchFromOpenMeteo(cityClean);
        console.log(`[Weather] Open-Meteo OK: ${result.city} ${result.temp}°C`);
      } catch (e2) {
        console.warn('[Weather] Open-Meteo başarısız:', e2.message);
      }
    }

    if (result) {
      result.timestamp = now;
      weatherCache = { data: result, timestamp: now };
      return res.json(result);
    }

    // Her iki API de başarısız — cache var mı?
    if (weatherCache.data) {
      console.warn('[Weather] Cache (stale) döndürülüyor');
      return res.json({ ...weatherCache.data, stale: true });
    }

    // Son çare: mock
    res.json({
      city: cityClean, temp: null, condition: 'Bağlantı Yok',
      status: 'cloudy', wind: null, forecast: [], is_mock: true,
    });

  } catch (err) {
    console.error('[Weather]', err.message);
    if (weatherCache.data) return res.json(weatherCache.data);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
