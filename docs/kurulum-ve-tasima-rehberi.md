# Kurulum ve Tasima Rehberi

Bu rehber basit dilde yazildi.

Amac:

- veritabani yedegi almak
- kodlari zip yapmak
- medya dosyalarini ayri almak
- sunucuya tasirken neyin gerekli oldugunu karistirmamak

## Benim sizin icin simdi hazirladigim seyler

Projeye 3 komut dosyasi eklendi:

- `scripts/export-db.ps1`
- `scripts/package-project.ps1`
- `scripts/package-uploads.ps1`

## Burada, Su An Yapabilecekleriniz

Bu bolumdeki her seyi kendi bilgisayarinizda simdi yapabilirsiniz.

### 1. Veritabani SQL dosyasi al

Terminalde proje klasorundeyken sunu yaz:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-db.ps1
```

Bu komut calisirsa proje klasorunde su tipte bir dosya olusur:

```text
backup-dijital_ziyaretci-YYYY-MM-DD_HH-mm.sql
```

Bu dosya cok onemli. Kullanici, sirket, ayar, ziyaretci gibi veriler bunun icinde olur.

### 2. Sadece kodlari zip yap

Sunu calistir:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-project.ps1
```

Bu zip'in icinde sunlar olmayacak:

- `node_modules`
- `.git`
- `.env`
- `server/uploads`
- test klasorleri

Yani sadece ana kodlar paketlenecek.

### 3. Foto ve videolari ayri zip yap

Sunu calistir:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-uploads.ps1
```

Bu zip cok onemli. Cunku lobi ekrani medya dosyalari burada.

### 4. Tasirken hangi dosyalar lazim

Asagidaki 4 sey sizde hazir olmali:

- proje kod zip'i
- SQL dump dosyasi
- uploads zip'i
- production `.env` dosyasi

### 5. Burada isi bitince elinizde ne olacak

Bu asamadan sonra elinizde su dosyalar olacak:

- kod zip dosyasi
- SQL dump dosyasi
- uploads zip dosyasi
- production env taslagi

Bu noktaya kadar olan kismi ben sizin icin kolaylastirdim ve siz su an bunu yapabilirsiniz.

## Sadece Sunucu Basinda Yapilacaklar

Bu bolumdeki adimlar benim buradan yapabilecegim seyler degil.
Bunlar sirket sunucusuna baglaninca yapilacak.

### 1. Sunucuyu hazirla

Sunucuda su seyler hazir olmali:

- Docker
- Docker Compose
- proje klasoru
- domain veya sunucu IP bilgisi

### 2. Dosyalari sunucuya yukle

Sunucuya su dosyalari atacaksiniz:

- kod zip dosyasi
- SQL dump dosyasi
- uploads zip dosyasi
- production `.env` dosyasi

### 3. Production `.env` dosyasini doldur

Sunucuda kullanilacak ayarlar ayri olmali.

Burada dikkat:

- local `.env` dosyanizi bozmayin
- sunucu icin ayri env kullanin
- domain varsa `ALLOWED_ORIGINS` ona gore yazin
- production veritabani sifresini burada belirleyin

### 4. Sunucuda veritabanini ve uygulamayi kur

Sunucu tarafinda genel sira su olacak:

1. PostgreSQL container baslatilir
2. migration calistirilir
3. SQL dump geri yuklenir
4. uploads dosyalari kopyalanir
5. uygulama baslatilir

### 5. Canli kontrol yap

Sunucu kurulduktan sonra sunlari test edeceksiniz:

- giris sayfasi aciliyor mu
- admin ile login oluyor mu
- sirketler gorunuyor mu
- lobi ekraninda foto/video aciliyor mu
- `/api/health` calisiyor mu

## Ben Su Anda Neyi Yapabildim

Yapabildiklerim:

- `.env` icindeki eski `DB_PATH` satirini temizledim
- PostgreSQL baglanti satirlarini duzelttim
- production icin ornek env dosyasi hazirladim
- veritabani dump alma komutu ekledim
- kod paketleme komutu ekledim
- uploads paketleme komutu ekledim

Benim buradan yapamayacaklarim:

- sirket sunucusuna baglanmak
- domain tanimlamak
- SSL kurmak
- Docker'i sirket sunucusuna kurmak
- production sunucuda komut calistirmak

## En Kolay Sonraki Adim

Siz once sadece bunlari calistirin:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-db.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\package-project.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\package-uploads.ps1
```

Bunlar tamam olunca elinizde sunlar olmus olacak:

- kod zip
- medya zip
- SQL dosyasi

Ondan sonra birlikte sunucu kurulum adimina geceriz.
