const { startCronJobs } = require('./src/services/cronService');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();

// --- GÜNCEL CORS LİSTESİ ---
const allowedOrigins = [
  'https://berbergo.com.tr',         // Ana domain
  'https://www.berbergo.com.tr',     // www versiyonu
  'https://berber-go-493906.web.app', // Eski adres (yedek olarak kalsın)
  'http://localhost:3000',
  'http://localhost:8081',            // Expo web (mobile dev)
  'http://localhost:19006'            // Expo DevTools
];

// Middleware & Güvenlik
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static dosyalar (profil fotoğrafları, galeri)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 1. Web İçin CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("CORS Engeline Takılan Adres:", origin);
      callback(new Error('CORS origin izni yok'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  maxAge: 600,
}));

// 2. Socket.io Ayarları
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Çok fazla istek, lütfen daha sonra tekrar deneyin.' },
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Çok fazla giriş denemesi, lütfen sonra tekrar deneyin.' },
});

// Routes
app.use('/api', globalLimiter);
app.use('/api/barbers/login', authLimiter);
app.use('/api/barbers/master/login', authLimiter);
app.use('/api/customers/login', authLimiter);
app.use('/api/customers/register', authLimiter);

// Route Tanımlamaları
app.use('/api/customers', require('./src/routes/customerRoutes'));
app.use('/api/locations', require('./src/routes/locationsRoutes'));
app.use('/api/barbers', require('./src/routes/barberRoutes'));
app.use('/api/requests', require('./src/routes/requestRoutes'));
app.use('/api/subscription', require('./src/routes/subscriptionRoutes'));
app.use('/api/slots', require('./src/routes/slotRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));

// --- WHATSAPP WEBHOOK (Berberden gelen yanıtı yakalar) ---
app.post('/webhook/whatsapp-reply', async (req, res) => {
  const { phone, action } = req.body;

  try {
    console.log(`📱 WhatsApp Yanıtı Geldi: ${phone} -> ${action}`);

    if (!phone || !action) {
      console.log('⚠️ Eksik parametreler:', { phone, action });
      return res.status(400).json({ error: 'phone ve action zorunlu' });
    }

    // 1. Berberi bul
    const Barber = require('./src/models/Barber');
    const barber = await Barber.findOne({ phone: phone });
    
    if (!barber) {
      console.log('⚠️ Berber bulunamadı, telefon:', phone);
      return res.status(404).json({ error: 'Berber bulunamadı' });
    }

    // 2. Berbere ait en son "pending" randevuyu bul
    const Request = require('./src/models/Request');
    const request = await Request.findOne({ 
      barber: barber._id, 
      status: 'pending' 
    }).sort({ createdAt: -1 });

    if (!request) {
      console.log('⚠️ Berberin bekleyen randevusu yok:', phone);
      return res.status(404).json({ error: 'Bekleyen randevu yok' });
    }

    // 3. Durumu güncelle
    const oldStatus = request.status;
    // 'accept' ve 'onayla' ikisini destekle, geri kalanı reject/iptal
    const isAccepted = action === 'accept' || action === 'onayla';
    request.status = isAccepted ? 'accepted' : 'rejected';
    if (isAccepted) {
      request.acceptedAt = new Date();
    }
    await request.save();
    console.log(`✅ Randevu: ${oldStatus} -> ${request.status}`);

    // 4. Socket.io ile tarayıcıdaki berbere anlık haber ver
    const barberSocketId = connectedBarbers.get(barber._id.toString());
    if (barberSocketId && io) {
      io.to(barberSocketId).emit('request_responded', { 
        requestId: request._id, 
        status: request.status,
        action: action
      });
      console.log('📡 Socket.io bildirimi gönderildi berbere');
    }

    // 5. Müşteriye WhatsApp bildirim gönder
    try {
      const { sendWhatsappToCustomer } = require('./src/services/whatsappService');
      
      // Tarih ve saat format et
      let dateTimeStr = '';
      if (request.scheduledAt) {
        const date = new Date(request.scheduledAt);
        const gunAdlari = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const gunAdi = gunAdlari[date.getDay()];
        const gun = String(date.getDate()).padStart(2, '0');
        const ay = String(date.getMonth() + 1).padStart(2, '0');
        const yil = date.getFullYear();
        const saat = String(date.getHours()).padStart(2, '0');
        const dakika = String(date.getMinutes()).padStart(2, '0');
        dateTimeStr = `\nTarih: ${gun}.${ay}.${yil} ${gunAdi}\nSaat: ${saat}:${dakika}`;
      }
      
      const serviceList = request.serviceNames && request.serviceNames.length > 0 
        ? request.serviceNames.join(', ') 
        : request.services.join(', ');
      
      const statusText = isAccepted ? 'KABUL EDILDI ✅' : 'REDDEDİLDİ ❌';
      const customerMsg = `Randevu talebi ${statusText}\n\nBerber: ${barber.name || barber.salonName}\nHizmetler: ${serviceList}\nFiyat: ${request.estimatedPrice} TL${dateTimeStr}`;
      
      console.error('📨 MÜŞTERI MESAJI START 📨');
      console.error(customerMsg);
      console.error('📨 MÜŞTERI MESAJI END 📨');
      
      await sendWhatsappToCustomer(request.customerPhone, customerMsg);
      console.log('📱 Müşteriye WhatsApp bildirim gönderildi');
    } catch (whatsappErr) {
      console.error('⚠️ Müşteriye bildirim gönderilemedi:', whatsappErr.message);
      // Devam et, önemli değil
    }

    res.status(200).json({ success: true, message: 'Randevu güncellendi ve müşteri bilgilendirildi' });

  } catch (err) {
    console.error('❌ Webhook Hatası (Stack):', err);
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});


// Veritabanı Yardımcı Fonksiyonları (Olduğu gibi korundu)
async function ensureSlotIndexes() {
  try {
    const Slot = require('./src/models/Slot');
    const existingIndexes = await Slot.collection.indexes();
    const hasLegacyUnique = existingIndexes.some((idx) => idx && idx.name === 'barber_1_date_1_time_1');
    if (hasLegacyUnique) {
      await Slot.collection.dropIndex('barber_1_date_1_time_1');
      console.log('🧹 Eski slot indexi kaldırıldı');
    }
    await Slot.createIndexes();
    console.log('✅ Slot indexleri doğrulandı');
  } catch (error) {
    console.warn('⚠️ Slot index hatası:', error.message);
  }
}

// MongoDB Bağlantı
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
})
  .then(async () => {
    console.log('✅ MongoDB bağlandı');
    await ensureSlotIndexes();
  })
  .catch(err => {
    console.error('❌ MongoDB hatası:', err.message);
    // Prod'de exit etme, dev'de devam et
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

// Socket.io Mantığı
const connectedBarbers = new Map();
const connectedCustomers = new Map();

app.set('io', io);
app.set('connectedBarbers', connectedBarbers);
app.set('connectedCustomers', connectedCustomers);

io.on('connection', (socket) => {
  console.log('🔌 Yeni bağlantı:', socket.id);

  socket.on('barber_login', (barberId) => {
    if (barberId) {
      connectedBarbers.set(barberId.toString(), socket.id);
      console.log(`✂️ Berber ${barberId} online`);
    }
  });

  socket.on('customer_login', (customerId) => {
    if (customerId) {
      connectedCustomers.set(customerId.toString(), socket.id);
      console.log(`👤 Müşteri ${customerId} online`);
    }
  });

  socket.on('disconnect', () => {
    for (let [id, sid] of connectedBarbers.entries()) {
      if (sid === socket.id) connectedBarbers.delete(id);
    }
    for (let [id, sid] of connectedCustomers.entries()) {
      if (sid === socket.id) connectedCustomers.delete(id);
    }
  });
});

// Test Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Berber Randevu API çalışıyor 🚀' });
});

// 404 & Error Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint bulunamadı' });
});

app.use((err, req, res, next) => {
  console.error('🔴 HATA DETAYI:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({ success: false, error: err.message || 'Sunucu hatası' });
});

// --- GOOGLE CLOUD İÇİN KRİTİK PORT AYARI ---
const PORT = process.env.PORT || 8080;

// TODO: Cron jobs temporarily disabled due to MongoDB connection timeout in testing
// startCronJobs(io, connectedBarbers);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server port ${PORT} üzerinde aktif`);
});