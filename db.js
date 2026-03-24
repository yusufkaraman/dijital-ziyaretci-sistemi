/**
 * db.js — In-Memory SQLite Benzeri Veri Katmanı
 * Gerçek bir SQLite.js entegrasyonu yapılabilir;
 * şimdilik localStorage + örnek seed data kullanıyoruz.
 */

const DB = {
  // ── TABLOLAR ──
  visitors: [],
  appointments: [],
  screens: [],
  hosts: [],
  notifications: [],

  // ── NEXT ID ──
  _id(table) {
    const rows = this[table];
    return rows.length === 0 ? 1 : Math.max(...rows.map(r => r.id)) + 1;
  },

  // ── CRUD ──
  insert(table, record) {
    record.id = this._id(table);
    record.createdAt = new Date().toISOString();
    this[table].push(record);
    this._save(table);
    return record;
  },

  update(table, id, changes) {
    const idx = this[table].findIndex(r => r.id === id);
    if (idx === -1) return null;
    this[table][idx] = { ...this[table][idx], ...changes, updatedAt: new Date().toISOString() };
    this._save(table);
    return this[table][idx];
  },

  delete(table, id) {
    this[table] = this[table].filter(r => r.id !== id);
    this._save(table);
  },

  getAll(table) { return [...this[table]]; },

  getById(table, id) { return this[table].find(r => r.id === id) || null; },

  query(table, predicate) { return this[table].filter(predicate); },

  // ── PERSIST ──
  _save(table) {
    try { localStorage.setItem('dzk_' + table, JSON.stringify(this[table])); } catch(e) {}
  },

  _load(table) {
    try {
      const raw = localStorage.getItem('dzk_' + table);
      if (raw) this[table] = JSON.parse(raw);
    } catch(e) {}
  },

  // ── SEED DATA ──
  init() {
    ['visitors','appointments','screens','hosts','notifications'].forEach(t => this._load(t));

    if (this.hosts.length === 0) this._seedHosts();
    if (this.visitors.length === 0) this._seedVisitors();
    if (this.appointments.length === 0) this._seedAppointments();
    if (this.screens.length === 0) this._seedScreens();
    if (this.notifications.length === 0) this._seedNotifications();
  },

  _seedHosts() {
    const hosts = [
      { name:'Mehmet Kaya',    dept:'Genel Müdürlük',    title:'Genel Müdür',        ext:'101', avatar:'MK', color:'#6366f1', visits:47 },
      { name:'Zeynep Arslan',  dept:'İnsan Kaynakları',  title:'İK Müdürü',           ext:'205', avatar:'ZA', color:'#ec4899', visits:34 },
      { name:'Ali Demir',      dept:'Bilgi Teknolojileri',title:'BT Uzmanı',          ext:'312', avatar:'AD', color:'#06b6d4', visits:28 },
      { name:'Fatma Şahin',    dept:'Muhasebe',           title:'Muhasebe Sm.',       ext:'418', avatar:'FŞ', color:'#10b981', visits:22 },
      { name:'Hasan Yıldız',   dept:'Hukuk',              title:'Hukuk Danışmanı',    ext:'520', avatar:'HY', color:'#f59e0b', visits:19 },
      { name:'Semra Öztürk',   dept:'Satış & Pazarlama',  title:'Satış Direktörü',    ext:'605', avatar:'SÖ', color:'#8b5cf6', visits:41 },
      { name:'Erkan Çelik',    dept:'Operasyon',          title:'Operasyon Müdürü',   ext:'710', avatar:'EÇ', color:'#ef4444', visits:15 },
      { name:'Neslihan Koc',   dept:'Ar-Ge',              title:'Ar-Ge Uzmanı',       ext:'810', avatar:'NK', color:'#14b8a6', visits:12 },
    ];
    hosts.forEach(h => this.insert('hosts', h));
  },

  _seedVisitors() {
    const today = new Date();
    const fmt = (d) => d.toISOString();
    const hm  = (h, m=0) => { const d = new Date(today); d.setHours(h,m,0,0); return fmt(d); };

    const data = [
      { name:'Ahmet Çelik',     tc:'12345678901', phone:'0532 111 2233', company:'Alfa Teknoloji A.Ş.',    reason:'Toplantı',       hostId:1, hostName:'Mehmet Kaya',    checkIn:hm(8,30),  checkOut:hm(9,45),  status:'Çıktı',    badge:'B-001', notes:'' },
      { name:'Sibel Korkmaz',   tc:'23456789012', phone:'0543 222 3344', company:'Beta Danışmanlık',        reason:'İş Görüşmesi',   hostId:2, hostName:'Zeynep Arslan', checkIn:hm(9,0),   checkOut:null,       status:'İçeride',  badge:'B-002', notes:'CV teslim edecek' },
      { name:'Orhan Yılmaz',    tc:'34567890123', phone:'0554 333 4455', company:'Gamma Lojistik',          reason:'Teslimat',       hostId:4, hostName:'Fatma Şahin',   checkIn:hm(9,15),  checkOut:hm(9,30),  status:'Çıktı',    badge:'B-003', notes:'' },
      { name:'Dilek Aydın',     tc:'45678901234', phone:'0505 444 5566', company:'Delta Hukuk Bürosu',      reason:'Danışma',        hostId:5, hostName:'Hasan Yıldız',  checkIn:hm(10,0),  checkOut:null,       status:'İçeride',  badge:'B-004', notes:'Acil duruşma dosyası' },
      { name:'Murat Aksoy',     tc:'56789012345', phone:'0512 555 6677', company:'Epsilon Yazılım Ltd.',    reason:'Teknik Destek',  hostId:3, hostName:'Ali Demir',     checkIn:hm(10,30), checkOut:null,       status:'İçeride',  badge:'B-005', notes:'Sunucu sorunu' },
      { name:'Lale Şener',      tc:'67890123456', phone:'0533 666 7788', company:'Bireysel',               reason:'İş Görüşmesi',   hostId:2, hostName:'Zeynep Arslan', checkIn:hm(11,0),  checkOut:hm(11,55), status:'Çıktı',    badge:'B-006', notes:'' },
      { name:'Kemal Doğan',     tc:'78901234567', phone:'0544 777 8899', company:'Zeta Mühendislik',        reason:'Toplantı',       hostId:6, hostName:'Semra Öztürk',  checkIn:hm(11,30), checkOut:null,       status:'Bekleniyor', badge:'B-007', notes:'3. katta bekliyor' },
      { name:'Aylin Karaca',    tc:'89012345678', phone:'0555 888 9900', company:'Theta Finans',            reason:'Toplantı',       hostId:1, hostName:'Mehmet Kaya',   checkIn:hm(13,0),  checkOut:null,       status:'Bekleniyor', badge:'B-008', notes:'' },
    ];
    data.forEach(v => this.insert('visitors', v));
  },

  _seedAppointments() {
    const today = new Date();
    const ymd = (d) => { const dt = new Date(today); dt.setDate(dt.getDate()+d); return dt.toISOString().split('T')[0]; };

    const data = [
      { name:'Caner Polat',    company:'İnti Yazılım',      hostId:1, hostName:'Mehmet Kaya',    date: ymd(0), time:'10:00', reason:'Strateji Toplantısı', priority:'high',  status:'Onaylı', notes:'Proje sunumu yapılacak' },
      { name:'Suna Demirci',   company:'Pelikan Reklam',     hostId:6, hostName:'Semra Öztürk',   date: ymd(0), time:'11:30', reason:'Teklif Görüşmesi',    priority:'med',   status:'Onaylı', notes:'' },
      { name:'Furkan Acar',    company:'Sigma Yapı',          hostId:4, hostName:'Fatma Şahin',    date: ymd(0), time:'14:00', reason:'Muhasebe Denetimi',   priority:'low',   status:'Onaylı', notes:'2 kişi gelecek' },
      { name:'Esra Kılıç',     company:'Omega Hukuk',         hostId:5, hostName:'Hasan Yıldız',   date: ymd(0), time:'15:30', reason:'Duruşma Hazırlığı',   priority:'high',  status:'Beklemede', notes:'' },
      { name:'Tolga Ersoy',    company:'Nova Teknoloji',       hostId:3, hostName:'Ali Demir',      date: ymd(1), time:'09:00', reason:'Ağ Kurulumu',         priority:'med',   status:'Onaylı', notes:'Ekipman getirecek' },
      { name:'Yıldız Güven',   company:'Atlas Eğitim',         hostId:2, hostName:'Zeynep Arslan',  date: ymd(1), time:'10:30', reason:'İşe Alım',            priority:'low',   status:'Onaylı', notes:'' },
      { name:'Emre Taş',       company:'Bireysel',            hostId:8, hostName:'Neslihan Koc',   date: ymd(2), time:'14:00', reason:'Ar-Ge İş Birliği',    priority:'med',   status:'Beklemede', notes:'Akademik proje' },
      { name:'Gülsüm Yıldız',  company:'Anka Medya',           hostId:6, hostName:'Semra Öztürk',   date: ymd(2), time:'16:00', reason:'Reklam Ajansı',       priority:'low',   status:'Onaylı', notes:'' },
      { name:'Serkan Okay',    company:'Delta İnşaat',         hostId:7, hostName:'Erkan Çelik',    date: ymd(3), time:'11:00', reason:'Operasyon Görüşmesi', priority:'high',  status:'Onaylı', notes:'' },
    ];
    data.forEach(a => this.insert('appointments', a));
  },

  _seedScreens() {
    const data = [
      { name:'Giriş Ekranı Ana', location:'1. Kat - Resepsiyon',  status:'online',  content:'Hoş Geldiniz | Dijital Ziyaretçi Sistemi', type:'karşılama', lastPing:'az önce' },
      { name:'Bekleme Salonu A', location:'2. Kat - Sol Koridor', status:'online',  content:'Güncel haberler + Bekleme listesi',         type:'bilgi',     lastPing:'1 dk önce' },
      { name:'Toplantı Rehberi', location:'3. Kat - Orta Alan',   status:'online',  content:'Bugünkü toplantı takvimi',                   type:'takvim',    lastPing:'2 dk önce' },
      { name:'Asansör Ekranı',   location:'Tüm Katlar',            status:'online',  content:'Kurumsal duyurular + saat',                 type:'duyuru',    lastPing:'az önce' },
      { name:'Kafeterya Menü',   location:'Bodrum - Kafeterya',    status:'offline', content:'Günlük menü',                               type:'menü',      lastPing:'18 dk önce' },
      { name:'Çıkış Yönlendirme',location:'4. Kat - Koridoru',    status:'online',  content:'Acil çıkış planı + rehber',                 type:'güvenlik',  lastPing:'az önce' },
    ];
    data.forEach(s => this.insert('screens', s));
  },

  _seedNotifications() {
    const data = [
      { icon:'👤', title:'Yeni ziyaretçi: Kemal Doğan — bekleme salonunda', time:'5 dk önce', color:'purple', read:false },
      { icon:'📅', title:'Randevu hatırlatma: Caner Polat — 10:00\'da',     time:'15 dk önce', color:'blue',   read:false },
      { icon:'🖥️', title:'Kafeterya Menü ekranı çevrimdışı',             time:'18 dk önce', color:'red',    read:false },
    ];
    data.forEach(n => this.insert('notifications', n));
  },
};
