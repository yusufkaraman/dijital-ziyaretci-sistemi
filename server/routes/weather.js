const express = require('express');
const router = express.Router();
const fetch = require('isomorphic-fetch');
const { db } = require('../database');

// Basit Bellek İçi Cache (15 dakika)
let weatherCache = {
  data: null,
  timestamp: 0
};
const CACHE_DURATION = 15 * 60 * 1000;

// WMO Weather Interpretation Codes (WW) mapping
function mapWMOCode(code) {
  if (code === 0) return 'sunny';
  if ([1, 2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'foggy';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowy';
  if ([95, 96, 99].includes(code)) return 'stormy';
  return 'cloudy'; // default
}

function getConditionText(code) {
  const mapping = {
    0: 'Güneşli',
    1: 'Açık', 2: 'Parçalı Bulutlu', 3: 'Bulutlu',
    45: 'Sisli', 48: 'Kırağı Sis',
    51: 'Hafif Çiseleme', 53: 'Çiseleme', 55: 'Yoğun Çiseleme',
    61: 'Hafif Yağmur', 63: 'Yağmurlu', 65: 'Şiddetli Yağmur',
    71: 'Hafif Kar', 73: 'Kar Yağışlı', 75: 'Yoğun Kar',
    77: 'Kar Taneleri',
    80: 'Hafif Sağanak', 81: 'Sağanak Yağış', 82: 'Şiddetli Sağanak',
    85: 'Hafif Kar Sağanağı', 86: 'Yoğun Kar Sağanağı',
    95: 'Fırtına', 96: 'Dolu ve Fırtına', 99: 'Şiddetli Fırtına'
  };
  return mapping[code] || 'Bilinmiyor';
}

router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (weatherCache.data && (now - weatherCache.timestamp < CACHE_DURATION)) {
      return res.json(weatherCache.data);
    }

    // Şehir ayarını DB'den al
    const cityRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('weather_city');
    const city = cityRow ? cityRow.value : (process.env.DEFAULT_CITY || 'Ankara');

    // 1. Geocoding (Şehri koordinata çevir)
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`;
    const geoRes = await fetch(geoUrl, { timeout: 5000 });
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('Şehir bulunamadı');
    }

    const { latitude, longitude, name } = geoData.results[0];

    // 2. Weather Fetch (Koordinatlar üzerinden çek + 3 günlük tahmin)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const weatherRes = await fetch(weatherUrl, { timeout: 5000 });
    const data = await weatherRes.json();

    if (!data.current_weather || !data.daily) {
      throw new Error('Hava durumu verisi alınamadı');
    }

    const cw = data.current_weather;
    const daily = data.daily;
    
    // Tahmin verisini işle (Bugün dahil sonrakiler)
    const forecast = [];
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    for (let i = 1; i <= 3; i++) { // Gelecek 3 gün
      if (!daily.time[i]) break;
      const d = new Date(daily.time[i]);
      forecast.push({
        day: dayNames[d.getDay()],
        max: Math.round(daily.temperature_2m_max[i]),
        min: Math.round(daily.temperature_2m_min[i]),
        condition: getConditionText(daily.weathercode[i]),
        status: mapWMOCode(daily.weathercode[i])
      });
    }

    const weatherData = {
      city: name,
      temp: Math.round(cw.temperature),
      condition: getConditionText(cw.weathercode),
      status: mapWMOCode(cw.weathercode),
      wind: Math.round(cw.windspeed),
      forecast: forecast,
      is_mock: false,
      timestamp: now
    };

    weatherCache = { data: weatherData, timestamp: now };
    res.json(weatherData);

  } catch (error) {
    console.warn('Weather fetch failed, return fallback:', error.message);
    
    if (weatherCache.data) return res.json(weatherCache.data);
    
    res.json({
      city: 'Ankara',
      temp: 20,
      condition: 'Sistem Çevrimdışı',
      status: 'cloudy',
      forecast: [
        { day: 'Yarın', max: 22, min: 12, status: 'sunny' },
        { day: 'Sonraki', max: 19, min: 10, status: 'cloudy' }
      ],
      is_mock: true,
      offline: true
    });
  }
});

module.exports = router;
