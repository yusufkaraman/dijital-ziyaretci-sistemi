# Yarin Kontrol Listesi

Bu liste basit tutuldu.
Amac: sirayla gitmek ve bir seyi atlamamak.

## 1. Gune Baslamadan Once

- [ ] Proje su an localde aciliyor mu kontrol et
- [ ] Admin hesabi ile giris yapilabiliyor mu kontrol et
- [ ] Lobi ekraninda foto ve videolar aciliyor mu kontrol et
- [ ] `server/uploads` klasoru bos mu degil mi kontrol et
- [ ] SQL dump dosyasi olustu mu kontrol et
- [ ] Kod zip dosyasi hazir mi kontrol et
- [ ] Uploads zip dosyasi hazir mi kontrol et
- [ ] `.env.production.example` dosyasi elinde mi kontrol et

## 2. Sirketten Ogrenmen Gerekenler

- [ ] Sunucu Linux mu Windows mu sor
- [ ] Domain var mi sor
- [ ] Sunucuya kim erisim verecek sor
- [ ] Docker kurulu mu sor
- [ ] Dis IP veya domain bilgisi nedir ogren

## 3. Sunucuya Gecmeden Once Elinde Hazir Olmasi Gerekenler

- [ ] Kod zip dosyasi
- [ ] SQL dump dosyasi
- [ ] Uploads zip dosyasi
- [ ] Production env dosyasi

## 4. Sunucu Basinda Yapilacaklar

- [ ] Proje dosyalarini sunucuya at
- [ ] Production env dosyasini yerlestir
- [ ] PostgreSQL calisiyor mu kontrol et
- [ ] Veritabanini kur / bagla
- [ ] SQL dump dosyasini geri yukle
- [ ] Uploads dosyalarini dogru klasore koy
- [ ] Uygulamayi baslat

## 5. Ilk Kontroller

- [ ] Giris sayfasi aciliyor mu
- [ ] Admin ile login oluyor mu
- [ ] Sirketler gorunuyor mu
- [ ] Lobi ekraninda mevcut medya gorunuyor mu
- [ ] `/api/health` calisiyor mu

## 6. Kritik Uyari

- [ ] Local `.env` dosyasini bozma
- [ ] Production icin ayri env kullan
- [ ] Veritabani sifresi ile `DATABASE_URL` ayni olmali
- [ ] `uploads` klasorunu tasimayi unutma
- [ ] Tek tek ilerle, toplu degisiklik yapma

## 7. Takilirsan Ilk Bakacagin Seyler

- [ ] Uygulama acilmiyorsa `.env` degerlerini kontrol et
- [ ] Veriler yoksa SQL dump geri yuklendi mi kontrol et
- [ ] Foto/video yoksa `uploads` klasoru kopyalandi mi kontrol et
- [ ] Tarayicida hata varsa `ALLOWED_ORIGINS` dogru mu kontrol et
