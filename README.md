# Dijital Ziyaretçi Sistemi | Digital Visitor System

[🇬🇧 English](#english) | [🇹🇷 Türkçe](#turkce)

<a name="english"></a>
## 🇬🇧 English

### Description
A Digital Visitor Management and Lobby Screen System built with Node.js, Express, and Prisma.

### Features
- **Visitor Management:** Track visitor arrivals, approvals, and checkout times.
- **Room Reservations:** Manage meeting room statuses and availability.
- **Appointments System:** Schedule and track planned visits and appointments.
- **Lobby Screen Display (WebSocket):** Real-time lobby screen content syncing and display using Socket.io.
- **Role-based Access Control:** Different permissions for Admin, Manager, Secretary, and Personnel.
- **Content & Media Management:** Upload and sequence media content (images/video) for lobby displays.
- **Blacklist System:** Prevent entry of blacklisted individuals.
- **News and Weather API Integration:** Display up-to-date information on the lobby screens.
- **Push Notifications:** Web Push subscription integration for system updates.

### Tech Stack
| Technology | Description |
|---|---|
| **Node.js** & **Express** | Backend server and RESTful API framework |
| **PostgreSQL** | Relational Database System |
| **Prisma** | Modern ORM for database modeling and migrations |
| **Socket.io** | Real-time bi-directional communication for lobby screens |
| **Vanilla JS & HTML/CSS**| Frontend interface (Admin panel, Lobby screen) |
| **Docker & Docker Compose**| Containerization and isolated service running |

### Setup and Installation

#### 1. Requirements
- Node.js (v18 or higher recommended)
- PostgreSQL
- Docker & Docker Compose (optional but recommended for easy deployment)

#### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
Ensure `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are configured correctly. Set a strong `JWT_SECRET` (at least 32 characters).

#### 3. Start with Docker (Recommended)
You can start the PostgreSQL database and Node.js server using Docker Compose:
```bash
docker-compose up -d
```
*Note: If you are on Windows, you can simply run the provided `baslat.bat` script.*

#### 4. Manual Setup
If you want to run the application manually (without Node in Docker):
```
# Start PostgreSQL database (using docker-compose for just DB)
docker-compose up -d postgres

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# (Optional) Seed the database with initial admin data
npm run seed

# Start the application
node server/index.js
```

### Build & Package
PowerShell scripts are provided in the `scripts/` directory to help package the application for production deployment:
- `npm run backup:db` - Exports a SQL dump of the database.
- `npm run package:code` - Zips the source code (excluding node_modules and uploads).
- `npm run package:uploads` - Zips user uploaded media content.

---

<a name="turkce"></a>
## 🇹🇷 Türkçe

### Açıklama
Node.js, Express ve Prisma kullanılarak geliştirilmiş Dijital Ziyaretçi Karşılama ve Lobi Ekranı Yönetim Sistemi.

### Özellikler
- **Ziyaretçi Yönetimi:** Ziyaretçi girişlerini, onaylarını ve çıkış zamanlarını takip edin.
- **Oda Rezervasyonları:** Toplantı odalarının durumunu ve uygunluğunu yönetin.
- **Randevu Sistemi:** Planlanmış ziyaretleri ve randevuları oluşturup izleyin.
- **Lobi Ekranı (WebSocket):** Socket.io kullanarak lobi ekranı içeriklerini eşzamanlı olarak yansıtın.
- **Rol Bazlı Yetkilendirme:** Yönetici, Müdür, Sekreter ve Personel için farklı erişim izinleri.
- **İçerik ve Medya Yönetimi:** Lobi ekranları için resim/video yükleme ve sıralama işlemleri.
- **Kara Liste (Blacklist):** İstenmeyen kişilerin tesise girişini engelleyin.
- **Haber ve Hava Durumu:** Lobi ekranlarında güncel bilgilerin API ile gösterimi.
- **Anlık Bildirimler:** Sistem güncellemeleri için Web Push (bildirim) entegrasyonu.

### Teknoloji Yığını
| Teknoloji | Açıklama |
|---|---|
| **Node.js** & **Express** | Sunucu altyapısı ve RESTful API çatısı |
| **PostgreSQL** | İlişkisel Veritabanı Sistemi |
| **Prisma** | Veritabanı modellemesi ve migrasyon işlemleri için modern ORM |
| **Socket.io** | Lobi ekranları için gerçek zamanlı çift yönlü iletişim |
| **Vanilla JS & HTML/CSS**| Ön yüz arayüzü (Yönetim paneli, Lobi ekranı vb.) |
| **Docker & Docker Compose**| Konteyner mimarisi ve izolasyonlu çalışma ortamı |

### Kurulum

#### 1. Gereksinimler
- Node.js (v18 veya üzeri önerilir)
- PostgreSQL
- Docker & Docker Compose (Kolay kurulum için önerilir)

#### 2. Çevresel Değişkenler
`.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değerleri doldurun:
```bash
cp .env.example .env
```
`POSTGRES_USER`, `POSTGRES_PASSWORD`, ve `POSTGRES_DB` ayarlarının doğru yapıldığından emin olun. Ayrıca `JWT_SECRET` için en az 32 karakterlik güçlü bir anahtar belirleyin.

#### 3. Docker ile Başlatma (Önerilen)
PostgreSQL veritabanını ve Node.js sunucusunu Docker Compose kullanarak başlatabilirsiniz:
```bash
docker-compose up -d
```
*Not: Windows kullanıyorsanız, dizindeki `baslat.bat` dosyasını çalıştırarak kolayca başlatabilirsiniz.*

#### 4. Manuel Kurulum
Uygulamayı Docker dışında (yerel Node.js ile) çalıştırmak isterseniz:
```
# PostgreSQL veritabanını başlatın
docker-compose up -d postgres

# Gerekli kütüphaneleri kurun
npm install

# Veritabanı migrasyonlarını (yapılandırmalarını) çalıştırın
npm run db:migrate

# (İsteğe bağlı) Başlangıç admin kullanıcı verisini oluşturun
npm run seed

# Uygulamayı başlatın
node server/index.js
```

### Derleme ve Paketleme
Uygulamayı canlı ortama taşımaya hazırlamak için `scripts/` klasöründe çeşitli PowerShell betikleri bulunmaktadır:
- `npm run backup:db` - Veritabanının SQL yedeğini dışa aktarır.
- `npm run package:code` - node_modules ve uploads haricindeki tüm kod dosyalarını zip'ler.
- `npm run package:uploads` - Yüklenen medya dosyalarını zip'ler.
