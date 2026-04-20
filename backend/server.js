const { startCronJobs } = require('./src/services/cronService');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();

// --- GÜNCEL CORS LİSTESİ ---
const allowedOrigins = [
  'https://berbergo.com.tr',         // Ana domain
  'https://www.berbergo.com.tr',     // www versiyonu
  'https://berber-go-493906.web.app', // Eski adres (yedek olarak kalsın)
  'http://localhost:3000'
];

// Middleware & Güvenlik
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

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
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB bağlandı');
    await ensureSlotIndexes();
  })
  .catch(err => {
    console.error('❌ MongoDB hatası:', err.message);
    process.exit(1);
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
  console.error('Hata:', err);
  res.status(500).json({ success: false, error: 'Sunucu hatası' });
});

// --- GOOGLE CLOUD İÇİN KRİTİK PORT AYARI ---
const PORT = process.env.PORT || 8080;

startCronJobs(io, connectedBarbers);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server port ${PORT} üzerinde aktif`);
});