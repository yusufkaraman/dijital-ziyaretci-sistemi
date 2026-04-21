const express = require('express');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const authMiddleware = require('../middleware/auth');
const prisma = require('../prisma');
const { canUseOutlook } = require('../policies/permissions');
const router = express.Router();

// Not: Gerçek Outlook entegrasyonu için .env içerisine aşağıdaki değişkenler eklenmelidir:
// AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
// REDIRECT_URI (Örn: http://localhost:3000/api/outlook/callback)
// Şimdilik bu değişkenlerin yokluğu ihtimaline karşı yapılandırmayı loglayarak bir taslak(mock) modunda çalışacak.

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'mock_client_id',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || 'mock_client_secret'
  }
};
const pca = new ConfidentialClientApplication(msalConfig);
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/api/outlook/callback';

// Yönetici Outlook bağlama başlatma
router.get('/login', authMiddleware, async (req, res) => {
  if (!process.env.AZURE_CLIENT_ID) {
    return res.status(503).json({ error: 'Azure AD yapılandırması (.env) eksik. Bu özellik şu anda taslak modundadır.' });
  }

  const authCodeUrlParameters = {
    scopes: ['user.read', 'calendars.readwrite'],
    redirectUri: REDIRECT_URI,
    state: req.user.id.toString() // Hangi kullanıcının bağlandığını takip etmek için
  };

  try {
    const response = await pca.getAuthCodeUrl(authCodeUrlParameters);
    res.json({ url: response });
  } catch (error) {
    console.error('MSAL auth url hatası:', Math.random());
    res.status(500).json({ error: 'Oturum açma URLsi oluşturulamadı' });
  }
});

// OAuth Callback
router.get('/callback', async (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ['user.read', 'calendars.readwrite'],
    redirectUri: REDIRECT_URI,
  };
  
  const userId = req.query.state;

  try {
    const response = await pca.acquireTokenByCode(tokenRequest);
    // Gerçek sistemde tokens (response.accessToken, response.refreshToken) users tablosunda saklanır.
    // Şimdilik mock: Outlook bağlantısını department alanına not düş
    await prisma.user.updateMany({
      where: { id: Number(userId) },
      data: { department: { set: undefined } }, // TODO: gerçek token storage
    }).catch(() => {});
    
    // Yönlendirme
    res.redirect('/yonetici?outlook=success');
  } catch (error) {
    console.error(error);
    res.redirect('/yonetici?outlook=error');
  }
});

// Outlook'dan çekilen etkinlikleri Senkronize Etme
router.post('/sync', authMiddleware, async (req, res) => {
  if (!canUseOutlook(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  
  if (!process.env.AZURE_CLIENT_ID) {
    return res.status(200).json({ mock: true, message: 'Azure ayarları eksik. Mock modunda senkronize ediliyor', added: 0 });
  }

  // Gerçek entegrasyon varsa: Veritabanından kullanıcı accessToken'i alınarak MS Graph Client oluşturulur.
  // const client = Client.init({ authProvider: (done) => { done(null, userAccessToken); } });
  // let events = await client.api('/me/events').filter("location/displayName eq 'ODTÜ Merkez'").get();
  // events.value.forEach(...) // Ziyaretçiler tablosuna veya randevulara ekle

  res.json({ success: true, message: 'Senkronizasyon (taslak) tamamlandı.', added: 0 });
});

module.exports = router;
