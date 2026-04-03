# UI Design Prompt — Digital Visitor Management System (Simsoft)

> **Instructions**: Design pixel-perfect, production-ready UI screens for a corporate **Digital Visitor Management System**. Five distinct panels must be designed. Follow the design system and panel specifications precisely.

---

## PART 1 — DESIGN SYSTEM

### Color Palette
*From Simsoft Corporate Identity Guide (KKK 2.0, 01/2024)*

| Role | Hex | Source |
|------|-----|--------|
| **Primary Blue** | `#0057A8` | Pantone 2935 C · CMYK 100/60/0/6 · RAL 5017 |
| **Cool Gray** | `#9EA2A4` | Pantone Cool Gray 6C · CMYK 0/0/0/40 · RAL 7045 |
| **Dark Gray** | `#53565A` | Pantone Cool Gray 11C · CMYK 0/0/0/80 |
| **Black** | `#000000` | Pantone Black C · CMYK 0/0/0/100 |
| **White** | `#FFFFFF` | — |
| **Page BG** | `#F4F6F9` | Derived light surface |
| **Card BG** | `#FFFFFF` | — |
| **Border** | `#DDE3EB` | — |
| **Primary Tint 10%** | `#E6EFF7` | Hover / active bg tint |

Functional status colors (not brand colors — for badges only):
- Success: `#166534` text / `#ECFDF5` bg / `#BBF7D0` border
- Warning: `#C2410C` text / `#FFF7ED` bg / `#FED7AA` border
- Danger: `#991B1B` text / `#FEF2F2` bg / `#FECACA` border
- Planned: `#3730A3` text / `#EEF2FF` bg / `#C7D2FE` border
- Arrived: `#155E75` text / `#ECFEFF` bg / `#A5F3FC` border

### Typography
*From Simsoft KKK 2.0 Section 2-1 — Kurumsal Font Kullanımı*

- **Primary Font**: **FF Meta** (Meta Bold for headings/labels, Meta Book for body text). Fallback: `"Source Sans Pro", "Nunito Sans", Arial, sans-serif`
- **Complementary Font**: **Arial** (Regular 14px body, Bold for emphasis; 11pt standard per KKK). Fallback: `Arial, "Helvetica Neue", sans-serif`

| Scale | Size | Weight | Font | Use |
|-------|------|--------|------|-----|
| Display | clamp(56px,9vw,104px) | Bold | Meta | Lobby visitor name |
| H1 | 28px | Bold | Meta | Page title |
| H2 | 20px | Bold | Meta | Card heading |
| H3 | 16px | Bold | Meta | Topbar panel name |
| Body | 14px | Regular | Arial | General text |
| List item | 13px | Bold | Arial | Visitor name in rows |
| Caption | 12px | Regular | Arial | Timestamps, meta |
| Badge | 11px | Bold | Arial | Status pill labels |

### Spacing, Radius, Shadows
- **Grid**: 8px base — use 4/8/12/16/24/32/48px
- **Radius**: cards & modals `12px` · inputs & buttons `8px` · badges `999px` · avatars `50%`
- **Shadow SM** (cards): `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- **Shadow MD** (modals/banners): `0 10px 25px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06)`
- **Icons**: Outline style, 20×20px, stroke 1.5–2px (Lucide/Heroicons)

---

## PART 2 — SHARED COMPONENTS
*(Present on Secretary, Manager, Personnel, Admin panels)*

### Topbar Strip
60px fixed header · white bg · `border-bottom: 1px solid #DDE3EB`
- **Left**: Logo image (36×36px, 8px radius, white bg, 1px border) + panel name (Meta Bold 16px)
- **Center**: Live clock `HH:MM:SS` (15px Arial, `#53565A`, updates every second)
- **Right**: Context action buttons + bell icon with red unread badge + "Şifre" secondary button + "Çıkış" secondary button

### Status Badges (Pill)
`padding: 3px 8px · border-radius: 999px · font: 11px Arial Bold · border: 1px solid`

| Status (TR) | Background | Border | Text |
|------------|-----------|--------|------|
| Bekliyor | `#FFF7ED` | `#FED7AA` | `#C2410C` |
| İçeride | `#ECFDF5` | `#BBF7D0` | `#166534` |
| Ayrıldı | `#F1F5F9` | `#CBD5E1` | `#334155` |
| İptal | `#FEF2F2` | `#FECACA` | `#991B1B` |
| Planlandı | `#EEF2FF` | `#C7D2FE` | `#3730A3` |
| Geldi | `#ECFEFF` | `#A5F3FC` | `#155E75` |
| Tamamlandı | `#F0FDF4` | `#BBF7D0` | `#166534` |

### Visitor List Row (vitem)
Horizontal card: `border: 1px solid #DDE3EB · border-radius: 10px · padding: 10px · bg white`
1. **Avatar** 34×34px circle · `#0057A8` bg · white bold initials · 13px
2. **Info** flex:1 · Name (13px Meta Bold `#111827`) + Company · Reason · Host (12px Arial `#6B7280`)
3. **Status badge**
4. **Action buttons** 32px icon buttons (approve ✓ green / reject ✗ red / checkout 🚪) — shown per role

### KPI Cards (row of 4)
Equal-width cards · `padding:16px · border-radius:12px · white bg · shadow-sm`
Left accent border 4px solid: Blue `#0057A8` · Cyan `#0891B2` · Green `#166534` · Orange `#EA580C`
Contents: 11px uppercase label `#6B7280` + 30px Meta Bold value in accent color

### Modal / Dialog
Full-screen backdrop `rgba(0,0,0,0.45)` · container: white `max-width:760px · border-radius:12px · shadow-md`
- Header: 16px Meta Bold title + × close btn · `border-bottom:1px solid #DDE3EB`
- Body: `padding:20px` scrollable
- Footer: Cancel (secondary) + Save (primary), right-aligned · `border-top:1px solid #DDE3EB`
- Animation: opacity 0→1 + translateY(-12px→0), 200ms ease

### Form Fields
- Label: 12px Arial Bold `#374151`, 4px gap below
- Input/Select: `height:40px · padding:0 12px · border:1px solid #DDE3EB · border-radius:8px · font:14px Arial`
- Focus: `border-color:#0057A8 · box-shadow:0 0 0 3px rgba(0,87,168,0.12)`
- Textarea: same styling, `min-height:80px`

### Buttons
| Type | Bg | Border | Text |
|------|----|--------|------|
| Primary | `#0057A8` | — | white |
| Secondary | white | `1px solid #DDE3EB` | `#374151` |
| Danger | `#DC2626` | — | white |
| Ghost | transparent | — | `#0057A8` |
| Icon | white | `1px solid #DDE3EB` | `#374151`, 36px sq |

All: `border-radius:8px · font:14px Meta Bold · padding:8px 16px`

### Toast Notification
Fixed bottom-right · `border-radius:10px · border-left:4px solid · shadow-md · min-width:280px`
Variants: success (green) / error (red) / info (`#0057A8`) · Auto-dismiss 4s

### Arrival Banner
Fixed top-center, slides down from top when new visitor awaits approval.
`max-width:820px · border-radius:12px · shadow-md · border:1px solid #DDE3EB · padding:14px 16px`
- Visitor name (14px Meta Bold) + Company · Reason · Host (12px gray)
- Action row: **Manager**: "Onayla" primary + "Reddet" danger + "Kapat" ghost · **Personnel**: "Kapat" ghost only

---

## PART 3 — PANEL SPECIFICATIONS

---

### PANEL 1 — LOBBY SCREEN (Lobi Ekranı) · `/lobi`

**Context**: Always-on public display screen, 1080p+ monitor in building entrance. No interaction. View distance 2–5m.

**Full-viewport dark theme. No scroll.**

#### Background
- Base: `linear-gradient(180deg, #060D1E, #0A1228)`
- Layered radial glows: top-center `rgba(0,87,168,0.30)` · bottom-right `rgba(8,145,178,0.18)`
- Animated particles: 8–12 circles 4–10px, `rgba(99,179,237,0.25)`, rise bottom→top, 18–28s staggered, pointer-events none

#### Header Bar (80px, transparent bg, `border-bottom:1px solid rgba(255,255,255,0.06)`)
- **Left**: 44×44px logo container `border-radius:10px · bg:linear-gradient(135deg,#0057A8,#0891B2)` + white SVG icon + company name (Meta Bold 20px white) + subtitle (12px `rgba(255,255,255,0.45)`)
- **Center**: Clock `HH:MM:SS` in 44px Meta Bold white `letter-spacing:-1px` · date below (14px `rgba(255,255,255,0.50)`)
- **Right**: 8px status dot (green pulsing `#10B981` = live / red `#EF4444` = disconnected) + label (13px `rgba(255,255,255,0.50)`)

#### Main Content (flex:1, centered) — Two states, 600ms cross-fade

**STATE A — Welcome** (shown 30s after visitor checks in)
- "HOŞ GELDİNİZ" — 18px uppercase, `letter-spacing:4px`, `rgba(255,255,255,0.50)`
- Visitor name — `clamp(56px,9vw,104px)` Meta Bold 900, white gradient text
- Company name — `clamp(20px,3.5vw,36px)` `rgba(255,255,255,0.60)`
- Visit purpose — `clamp(14px,2vw,22px)` `rgba(255,255,255,0.40)`
- Divider line — `120px × 3px, border-radius:2px, bg:linear-gradient(90deg,#0057A8,#0891B2)`, `margin:32px auto`
- "Görüşeceğiniz Kişi" label — 14px uppercase `letter-spacing:2px` `rgba(255,255,255,0.35)`
- Host name — `clamp(18px,2.5vw,28px)` `rgba(255,255,255,0.65)`

**STATE B — Idle Default** (when no recent check-in)
- "Hoş **Geldiniz**" — `clamp(40px,7vw,88px)` Meta Bold 900, "Geldiniz" uses gradient text `linear-gradient(135deg,#60A5FA,#818CF8,#A78BFA)`
- Subtitle — "Lütfen resepsiyona başvurunuz" `clamp(14px,2vw,24px)` `rgba(255,255,255,0.40)`
- Stats row (3 items, centered, `gap:56px`): each has large value `clamp(32px,5vw,60px)` Meta Bold `#60A5FA` + uppercase label `13px rgba(255,255,255,0.40)`
  - **İçeride** · **Bugünkü Ziyaret** · **Randevu**

#### Footer (52px, transparent, `border-top:1px solid rgba(255,255,255,0.06)`)
- Left: system brand text (12px `rgba(255,255,255,0.30)`)
- Center: scrolling ticker marquee — `overflow:hidden`, inner row animates 30s linear infinite, announcement items 13px `rgba(255,255,255,0.40)` with emoji prefixes
- Right: short date (12px `rgba(255,255,255,0.30)`)

#### Fullscreen Button
Fixed `bottom:24px right:24px` · 40×40px · `border-radius:10px` · `bg:rgba(255,255,255,0.08)` · `border:1px solid rgba(255,255,255,0.12)` · `backdrop-filter:blur(8px)` · ⛶ icon

---

### PANEL 2 — SECRETARY / RECEPTIONIST PANEL (Sekreter Paneli) · `/panel`

**Context**: Primary daily-use panel for front-desk receptionist. Full-featured management interface.

**Layout**: 260px fixed sidebar + topbar + scrollable content area.

#### Sidebar (260px, fixed, full-height, white, `border-right:1px solid #DDE3EB`)
- **Top logo zone** `padding:20px 16px`: logo 40×40px (8px radius, white bg, 1px border) + company name (Meta Bold 14px `#111827`) + "Yönetim ve Danışma Paneli" (11px `#9EA2A4`)
- **Nav groups** `padding:8px`:
  - Group labels: 10px Arial Bold uppercase `#9EA2A4 · padding:16px 12px 6px · letter-spacing:0.8px`
  - Nav items: `flex · gap:10px · padding:9px 12px · border-radius:8px · font:14px Arial · color:#374151`
  - **Active**: `bg:#E6EFF7 · color:#0057A8 · border-left:3px solid #0057A8 · font-weight:700`
  - Hover: `bg:#F4F6F9`
  - **ANA MENÜ**: Dashboard · Misafir Kayıtları · Hızlı Giriş Kaydı (+YENİ green badge) · Randevu Takvimi
  - **YÖNETİM**: Oda Rezervasyonları · Ekran Yönetimi · Personel Listesi · Kara Liste (+! red badge)
  - **SİSTEM** (admin-only, hidden otherwise): Ayarlar
- **User zone** (bottom, `border-top:1px solid #DDE3EB · padding:12px 16px`): 36px avatar circle (`#0057A8` bg, white initials) + name (13px bold `#111827`) + role (11px `#9EA2A4`) + 8px green online dot (right). Full row = logout on click.

#### Topbar (secretary)
Standard 60px · left: hamburger toggle + breadcrumb page title (Meta Bold 16px) + live clock · right: "Şifre Değiştir" ghost button + global search box (240px, 36px height, icon + input, `bg:#F4F6F9 · border-radius:8px`)

#### Dashboard Page
- KPI row: Onay Bekleyen · İçeride · Bugünkü Randevu · Toplam Giriş
- 2-col grid: Onay Bekleyen list (approve/reject buttons) · İçerideki Misafirler list (checkout button)
- 2-col grid below: Randevu mini-calendar + today list · Bugün Tüm Kayıtlar log

#### Visitor Records Page
- Filter bar: date-from/to pickers + status dropdown + search input + Export CSV button
- Sortable data table: # · Name+Avatar · Company · TC (masked ****1234) · Phone · Host · Check-in · Check-out · Status · Actions (view/edit/delete)
- Pagination: page buttons + per-page selector + total count

#### Quick Check-in Page
Max-width 640px centered white card · large heading · 2-col form · TC blacklist check (amber warning banner inline if TC matches) · full-width primary submit button

#### Appointment Calendar Page
Month/week toggle + navigation arrows + current month label + "Yeni Randevu" button · 7-col calendar grid with appointment dot indicators · selected-day side panel (280px) showing time/visitor/status/actions

#### Room Reservations Page
Card grid (2–3 cols): room name + capacity (icon+number) + status badge (Müsait green / Meşgul red / Yakında Dolacak amber) + "Rezerve Et" button (disabled when occupied) · Reservation modal with date-time range picker

#### Screen Management Page
Table of lobby screens: name · IP · last-seen · status dot · "Mesajları Düzenle" button · Below: ticker message editor — editable row list with delete × per row + "Mesaj Ekle" + Save

#### Staff List Page
Card or table list: avatar · name · department · role badge · email · extension · today's visitor count · active toggle (admin only) · admin: "Yeni Kullanıcı Oluştur" button top-right

#### Blacklist Page
Amber warning header banner (`bg:#FFF7ED · border-left:4px solid #D97706`) · filter/search + "Ekle" danger button · table: TC · Name · Reason · Added By · Date · Active toggle · Delete

#### Settings Page (Admin-only)
- **Kurumsal Kimlik**: logo upload (drag-drop zone, dashed border, preview) + company name input + Save
- **Lobi Mesajları**: editable ticker message list + "Mesaj Ekle" + Save
- **Sistem Ayarları**: language selector + session timeout + notification sound toggle

---

### PANEL 3 — MANAGER PANEL (Yönetici Paneli) · `/yonetici`

**Context**: Department managers monitor and approve visitors assigned to them. No sidebar. Compact single-page layout.

**Layout**: Fixed topbar + scrollable main `padding:16px 24px 32px` · 2-col card grid

#### Topbar (manager-specific)
- Left: Logo (36px) + "Yönetici Paneli" (Meta Bold 16px) + live clock
- Right: "Yeni Kayıt" primary · Bell icon (red badge) · "Şifre" secondary · "Çıkış" secondary
- **Notification dropdown**: absolute below bell · `width:320px · border-radius:12px · shadow-md · border:1px solid #DDE3EB` · header "Bildirimler" + "Temizle" ghost btn · notification items: name bold + timestamp 11px gray + dismiss × · empty state "Bildirim yok" 12px gray

#### User Identity Bar (below topbar)
- User chip: avatar 34px + full name (Meta Bold 14px) + role badge
- Right: "Yenile" secondary + "Oda Rezerve Et" secondary

#### KPI Row
4 cards: Onay Bekleyen (blue) · İçeride (cyan) · Bugünkü Randevu (green) · Toplam Giriş (orange)

#### Section 1 — 2-col grid
- **Onay Bekleyen Misafirler**: visitor rows + approve (green) / reject (red) 32px icon buttons + arrival time badge. Empty state "Bekleyen misafir yok."
- **İçerideki Misafirler (N)**: visitor rows + checkout button + check-in timestamp. Dynamic count in card header `<h3>`.

#### Section 2 — 2-col grid
- **Randevular**: mini calendar widget (`grid 7 cols`, day-name headers 11px bold gray, day cells `border:1px solid #DDE3EB · border-radius:6px · font:12px`, active day `bg:#E6EFF7 · border-color:#93C5FD · color:#0057A8 font-weight:700`) + appointment list below (time · visitor name · status badge)
- **Bugün Tüm Kayıtlar**: chronological all-records log with status badges

#### Section 3 — 2-col grid
- **Toplantı Odaları**: compact room status grid — room name + status badge + "Rezerve Et" button
- **Haftalık Yoğunluk**: bar/line chart `height:220px` — 7 days Mon–Sun, Y=visitor count, `#0057A8` bars, minimal Chart.js style

#### Arrival Banner
Slides down from top on new visitor awaiting approval · Buttons: "Onayla" primary + "Reddet" danger + "Kapat" ghost

#### Add Visitor/Appointment Modal
Tab switcher: Misafir / Randevu · 2-col form grid:
Ad Soyad* · TC No · Telefon · E-posta · Firma · Personel* (dropdown) · Sebep* · Plaka · Kişi Sayısı · Zaman (datetime-local, appointment tab only) · Notes (full-width textarea) · Footer: İptal secondary + Kaydet primary

---

### PANEL 4 — PERSONNEL PANEL (Personel Paneli) · `/personel`

**Context**: Focused limited-scope dashboard for regular employees to monitor their own incoming visitors only. No sidebar.

**Layout**: Same structure as Manager panel — fixed topbar + scrollable content + 2-col card grid.

#### Topbar (personnel-specific)
- Left: Logo + "Personel Paneli" (Meta Bold 16px) + live clock
- Right: "Misafir Kaydı" primary · Bell (red badge) · "Şifre" secondary · "Çıkış" secondary

#### User Identity Bar
- User chip: avatar + name bold + department/company line below (12px `#9EA2A4`)
- Right: "Yenile" + "Oda Rezerve Et" buttons

#### KPI Row
4 cards: Bekleyen (blue) · İçeride (cyan) · Bugünkü Toplam (green) · Randevular (orange, shows "—" if none)

#### Section 1 — 2-col grid
- **Bugün Tüm Misafirlerim**: visitor rows · name/company/check-in time/status badge · **No approve/reject** (personnel cannot approve — approval is handled by secretary/manager)
- **Randevularım**: scheduled appointments · visitor name · appointment time · status badge · "İptal Et" ghost button on future planned appointments

#### Section 2 — Full-width card
- **Toplantı Odaları**: same room status grid as manager panel · "Rezerve Et" per available room

#### Arrival Banner
Same slide-down banner — **personnel version**: show-only, **only "Kapat" button**, no approve/reject

#### Add Visitor/Appointment Modal
Identical form to manager panel with one addition: blue info box at top of modal body:
`bg:#EFF6FF · border:1px solid #BAE6FD · border-radius:8px · padding:8px 10px · font:12px · color:#1E3A8A`
Text: "Anlık misafir kaydı oluşturup danışma onayına gönderebilirsiniz."

---

### PANEL 5 — ADMIN PANEL (within Secretary Panel) · `/panel` — role-gated

**Context**: Extended capabilities for `admin` role users within the secretary panel. Not a separate URL. The "Ayarlar" sidebar nav item is hidden unless `vd_role === 'admin'`.

#### Admin-Only Settings Page (Ayarlar)

**Kurumsal Kimlik Section**
- Logo upload: dashed-border drag-drop zone (`border:2px dashed #DDE3EB · border-radius:12px · padding:32px · text-align:center`), cloud-upload icon `#9EA2A4` 32px + "Logo yükleyin veya sürükleyin" 14px + accepted formats note 11px gray · live preview 60×60px rounded · Save button
- Company name input + Save

**Lobi Mesajları Section**
- Editable list of ticker messages: each row = message text + delete × button (`color:#DC2626`)
- "Mesaj Ekle" secondary button + text input inline · Save button

**Sistem Ayarları Section**
- Language selector (TR / EN) dropdown
- Session timeout number input (minutes)
- Notification sound toggle switch (`#0057A8` when on)

#### Admin-Elevated Visitor Records
In Visitor Records table: trash icon delete column visible (red `#DC2626`) — hidden for non-admin roles

#### Admin-Elevated Staff List
Enable/Disable toggle per user row (visible only for admin) · "Yeni Kullanıcı Oluştur" primary button in page header

#### Create User Modal (admin only)
2-col form: Full Name · Username · Password (with show/hide toggle) · Role selector (admin/secretary/manager/personnel) · Department · Email · Footer: İptal + Kaydet

---

## PART 4 — GLOBAL INTERACTION PATTERNS

### Real-Time Updates
All internal panels connect via Socket.IO. When an event fires (new visitor, status change, check-out), the relevant card/list section auto-refreshes. Visual feedback: updated row briefly flashes `bg:#E6EFF7` for 800ms then returns to white.

### Loading States
While data fetches: skeleton shimmer loaders (animated `bg:linear-gradient(90deg,#F0F0F0,#E8E8E8,#F0F0F0)` moving left-to-right) replace list and KPI areas. KPI values show "—" placeholder.

### Empty States
Centered placeholder: muted icon (32px, `#D1D5DB`) + short message "Henüz kayıt yok" (14px `#9EA2A4`). No background color change.

### Responsive Breakpoints
- ≥1280px: full 2-col layouts, sidebar expanded
- 768–1279px: 1-col stacked grid, sidebar collapses to icon-only or hamburger overlay
- <768px: single column, modals go full-screen, topbar wraps

### Accessibility
- Minimum contrast ratio 4.5:1 for body text, 3:1 for large text
- Focus rings visible on all interactive elements (`outline:2px solid #0057A8 · outline-offset:2px`)
- ARIA labels on icon-only buttons
