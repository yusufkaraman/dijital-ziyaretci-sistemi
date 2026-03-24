/**
 * db.js — In-Memory Veri Katmanı + Seed Data
 */
const DB = {
  visitors: [], appointments: [], screens: [],
  hosts: [], notifications: [], blacklist: [],
  rooms: [], smsLog: [],

  _id(t){ const r=this[t]; return r.length===0?1:Math.max(...r.map(x=>x.id))+1; },

  insert(t,rec){ rec.id=this._id(t); rec.createdAt=new Date().toISOString(); this[t].push(rec); this._save(t); return rec; },
  update(t,id,ch){ const i=this[t].findIndex(r=>r.id===id); if(i===-1)return null; this[t][i]={...this[t][i],...ch,updatedAt:new Date().toISOString()}; this._save(t); return this[t][i]; },
  delete(t,id){ this[t]=this[t].filter(r=>r.id!==id); this._save(t); },
  getAll(t){ return [...this[t]]; },
  getById(t,id){ return this[t].find(r=>r.id===id)||null; },
  query(t,fn){ return this[t].filter(fn); },

  _save(t){ try{ localStorage.setItem('dzk_'+t,JSON.stringify(this[t])); }catch(e){} },
  _load(t){ try{ const r=localStorage.getItem('dzk_'+t); if(r)this[t]=JSON.parse(r); }catch(e){} },

  init(){
    ['visitors','appointments','screens','hosts','notifications','blacklist','rooms','smsLog'].forEach(t=>this._load(t));
    if(!this.hosts.length)       this._seedHosts();
    if(!this.visitors.length)    this._seedVisitors();
    if(!this.appointments.length)this._seedAppointments();
    if(!this.screens.length)     this._seedScreens();
    if(!this.notifications.length)this._seedNotifications();
    if(!this.blacklist.length)   this._seedBlacklist();
    if(!this.rooms.length)       this._seedRooms();
    if(!this.smsLog.length)      this._seedSmsLog();
  },

  _seedHosts(){
    [
      {name:'Mehmet Kaya',    dept:'Genel Müdürlük',     title:'Genel Müdür',        ext:'101',avatar:'MK',color:'#1e40af',visits:47},
      {name:'Zeynep Arslan',  dept:'İnsan Kaynakları',   title:'İK Müdürü',           ext:'205',avatar:'ZA',color:'#7c3aed',visits:34},
      {name:'Ali Demir',      dept:'Bilgi Teknolojileri',title:'BT Uzmanı',           ext:'312',avatar:'AD',color:'#0369a1',visits:28},
      {name:'Fatma Şahin',    dept:'Muhasebe',            title:'Muhasebe Sm.',        ext:'418',avatar:'FŞ',color:'#16a34a',visits:22},
      {name:'Hasan Yıldız',   dept:'Hukuk',               title:'Hukuk Danışmanı',     ext:'520',avatar:'HY',color:'#d97706',visits:19},
      {name:'Semra Öztürk',   dept:'Satış & Pazarlama',   title:'Satış Direktörü',     ext:'605',avatar:'SÖ',color:'#dc2626',visits:41},
      {name:'Erkan Çelik',    dept:'Operasyon',           title:'Operasyon Müdürü',    ext:'710',avatar:'EÇ',color:'#0891b2',visits:15},
      {name:'Neslihan Koç',   dept:'Ar-Ge',               title:'Ar-Ge Uzmanı',        ext:'810',avatar:'NK',color:'#059669',visits:12},
    ].forEach(h=>this.insert('hosts',h));
  },

  _seedVisitors(){
    const hm=(h,m=0)=>{ const d=new Date(); d.setHours(h,m,0,0); return d.toISOString(); };
    [
      {name:'Ahmet Çelik',   tc:'12345678901',phone:'0532 111 2233',company:'Alfa Teknoloji',  reason:'Toplantı',      hostId:1,hostName:'Mehmet Kaya',   checkIn:hm(8,30), checkOut:hm(9,45), status:'Çıktı',      badge:'B-001',plate:'34 AHM 01',count:'1',notes:''},
      {name:'Sibel Korkmaz', tc:'23456789012',phone:'0543 222 3344',company:'Beta Danışmanlık',reason:'İş Görüşmesi', hostId:2,hostName:'Zeynep Arslan', checkIn:hm(9,0),  checkOut:null,     status:'İçeride',    badge:'B-002',plate:'',count:'1',notes:'CV teslim edecek'},
      {name:'Orhan Yılmaz',  tc:'34567890123',phone:'0554 333 4455',company:'Gamma Lojistik',  reason:'Teslimat',      hostId:4,hostName:'Fatma Şahin',   checkIn:hm(9,15), checkOut:hm(9,30), status:'Çıktı',      badge:'B-003',plate:'06 ORH 34',count:'1',notes:''},
      {name:'Dilek Aydın',   tc:'45678901234',phone:'0505 444 5566',company:'Delta Hukuk',      reason:'Danışma',       hostId:5,hostName:'Hasan Yıldız',  checkIn:hm(10,0), checkOut:null,     status:'İçeride',    badge:'B-004',plate:'',count:'2',notes:'Acil dosya'},
      {name:'Murat Aksoy',   tc:'56789012345',phone:'0512 555 6677',company:'Epsilon Yazılım',  reason:'Teknik Destek',hostId:3,hostName:'Ali Demir',     checkIn:hm(10,30),checkOut:null,     status:'İçeride',    badge:'B-005',plate:'34 MUR 55',count:'1',notes:'Sunucu sorunu'},
      {name:'Lale Şener',    tc:'67890123456',phone:'0533 666 7788',company:'Bireysel',          reason:'İş Görüşmesi', hostId:2,hostName:'Zeynep Arslan', checkIn:hm(11,0), checkOut:hm(11,55),status:'Çıktı',      badge:'B-006',plate:'',count:'1',notes:''},
      {name:'Kemal Doğan',   tc:'78901234567',phone:'0544 777 8899',company:'Zeta Mühendislik', reason:'Toplantı',      hostId:6,hostName:'Semra Öztürk', checkIn:hm(11,30),checkOut:null,     status:'Bekleniyor', badge:'B-007',plate:'41 KEM 99',count:'3',notes:'3. katta bekliyor'},
      {name:'Aylin Karaca',  tc:'89012345678',phone:'0555 888 9900',company:'Theta Finans',      reason:'Toplantı',      hostId:1,hostName:'Mehmet Kaya',   checkIn:hm(13,0), checkOut:null,     status:'Bekleniyor', badge:'B-008',plate:'',count:'1',notes:''},
    ].forEach(v=>this.insert('visitors',v));
  },

  _seedAppointments(){
    const ymd=(d)=>{ const dt=new Date(); dt.setDate(dt.getDate()+d); return dt.toISOString().split('T')[0]; };
    [
      {name:'Caner Polat',   company:'İnti Yazılım',   hostId:1,hostName:'Mehmet Kaya',   date:ymd(0),time:'10:00',reason:'Strateji Toplantısı', priority:'high',status:'Onaylı',   notes:'Proje sunumu'},
      {name:'Suna Demirci',  company:'Pelikan Reklam', hostId:6,hostName:'Semra Öztürk',  date:ymd(0),time:'11:30',reason:'Teklif Görüşmesi',    priority:'med', status:'Onaylı',   notes:''},
      {name:'Furkan Acar',   company:'Sigma Yapı',     hostId:4,hostName:'Fatma Şahin',   date:ymd(0),time:'14:00',reason:'Muhasebe Denetimi',   priority:'low', status:'Onaylı',   notes:'2 kişi'},
      {name:'Esra Kılıç',    company:'Omega Hukuk',    hostId:5,hostName:'Hasan Yıldız',  date:ymd(0),time:'15:30',reason:'Duruşma Hazırlığı',   priority:'high',status:'Beklemede',notes:''},
      {name:'Tolga Ersoy',   company:'Nova Teknoloji', hostId:3,hostName:'Ali Demir',     date:ymd(1),time:'09:00',reason:'Ağ Kurulumu',         priority:'med', status:'Onaylı',   notes:'Ekipman getirecek'},
      {name:'Yıldız Güven',  company:'Atlas Eğitim',   hostId:2,hostName:'Zeynep Arslan', date:ymd(1),time:'10:30',reason:'İşe Alım',            priority:'low', status:'Onaylı',   notes:''},
      {name:'Emre Taş',      company:'Bireysel',       hostId:8,hostName:'Neslihan Koç',  date:ymd(2),time:'14:00',reason:'Ar-Ge İş Birliği',    priority:'med', status:'Beklemede',notes:'Akademik proje'},
      {name:'Gülsüm Yıldız', company:'Anka Medya',     hostId:6,hostName:'Semra Öztürk',  date:ymd(2),time:'16:00',reason:'Reklam Ajansı',       priority:'low', status:'Onaylı',   notes:''},
    ].forEach(a=>this.insert('appointments',a));
  },

  _seedScreens(){
    [
      {name:'Giriş Ekranı Ana',  location:'1. Kat - Resepsiyon',   status:'online', content:'Hoş Geldiniz | Dijital Ziyaretçi Sistemi',type:'karşılama',lastPing:'az önce'},
      {name:'Bekleme Salonu A',  location:'2. Kat - Sol Koridor',  status:'online', content:'Güncel haberler + Bekleme listesi',       type:'bilgi',    lastPing:'1 dk önce'},
      {name:'Toplantı Rehberi',  location:'3. Kat - Orta Alan',    status:'online', content:'Bugünkü toplantı takvimi',                type:'takvim',   lastPing:'2 dk önce'},
      {name:'Asansör Ekranı',    location:'Tüm Katlar',             status:'online', content:'Kurumsal duyurular + saat',               type:'duyuru',   lastPing:'az önce'},
      {name:'Kafeterya Menü',    location:'Bodrum - Kafeterya',     status:'offline',content:'Günlük menü',                            type:'menü',     lastPing:'18 dk önce'},
      {name:'Çıkış Yönlendirme', location:'4. Kat - Koridoru',     status:'online', content:'Acil çıkış planı + rehber',               type:'güvenlik', lastPing:'az önce'},
    ].forEach(s=>this.insert('screens',s));
  },

  _seedNotifications(){
    [
      {icon:'👤',title:'Yeni ziyaretçi: Kemal Doğan — bekleme salonunda',time:'5 dk önce', read:false},
      {icon:'📅',title:"Randevu hatırlatma: Caner Polat — 10:00'da",     time:'15 dk önce',read:false},
      {icon:'🖥️',title:'Kafeterya Menü ekranı çevrimdışı',               time:'18 dk önce',read:false},
    ].forEach(n=>this.insert('notifications',n));
  },

  _seedBlacklist(){
    [
      {name:'Cem Yıldırım',   tc:'11122233344',company:'Eski Tedarikçi', reason:'Güvenlik ihlali',   addedAt:'2025-12-01'},
      {name:'Serdar Kaya',    tc:'22233344455',company:'Rakip Firma',    reason:'Ticari casusluk girişimi', addedAt:'2026-01-15'},
    ].forEach(b=>this.insert('blacklist',b));
  },

  _seedRooms(){
    [
      {name:'Boğaz Toplantı Salonu',  capacity:20, floor:'3. Kat', status:'occupied',  event:'Yönetim Kurulu Toplantısı', time:'09:00-12:00', features:['Projeksiyon','Video Konf','Sunum']},
      {name:'Fatih Konferans Odası',  capacity:50, floor:'2. Kat', status:'available', event:'',                          time:'',            features:['Sahne','Ses Sistemi','Kayıt']},
      {name:'A Toplantı Odası',       capacity:8,  floor:'4. Kat', status:'reserved',  event:'IT Proje Toplantısı',       time:'14:00-15:00', features:['TV Ekranı','Beyaz Tahta']},
      {name:'B Toplantı Odası',       capacity:8,  floor:'4. Kat', status:'available', event:'',                          time:'',            features:['TV Ekranı','Beyaz Tahta']},
      {name:'VIP Müzakere Odası',     capacity:12, floor:'5. Kat', status:'reserved',  event:'Müşteri Görüşmesi',         time:'15:30-17:00', features:['Projeksiyon','İkram','Ses İzolasyonu']},
      {name:'Eğitim Salonu',          capacity:30, floor:'1. Kat', status:'available', event:'',                          time:'',            features:['Projeksiyon','Bilgisayarlar','İnternet']},
    ].forEach(r=>this.insert('rooms',r));
  },

  _seedSmsLog(){
    [
      {to:'Mehmet Kaya',   msg:'Ziyaretçiniz Ahmet Çelik girişini yaptı — Rozet: B-001',time:'08:31',type:'sms',   icon:'📱'},
      {to:'Zeynep Arslan', msg:'Ziyaretçiniz Sibel Korkmaz bekleme salonunda',           time:'09:02',type:'email', icon:'📧'},
      {to:'Ali Demir',     msg:'Teknik destek için Murat Aksoy geldi — Rozet: B-005',    time:'10:31',type:'sms',   icon:'📱'},
    ].forEach(s=>this.insert('smsLog',s));
  },
};
