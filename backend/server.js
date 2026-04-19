const { startCronJobs } = require('./src/services/cronService');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

function parseAllowedOrigins() {
  const raw = String(process.env.CORS_ORIGINS || '').trim();
  if (!raw) {
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://berbergo.com.tr',
      'https://www.berbergo.com.tr'
    ];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = new Set(parseAllowedOrigins());

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }
  return allowedOrigins.has(origin);
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Socket origin izni yok'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  }
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin izni yok'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,
}));

app.use(express.json({ limit: '200kb' }));

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

app.use('/api', globalLimiter);
app.use('/api/barbers/login', authLimiter);
app.use('/api/barbers/master/login', authLimiter);
app.use('/api/customers/login', authLimiter);
app.use('/api/customers/register', authLimiter);

const customerRoutes = require('./src/routes/customerRoutes');
app.use('/api/customers', customerRoutes);

const locationsRoutes = require('./src/routes/locationsRoutes');
app.use('/api/locations', locationsRoutes);

const barberRoutes = require('./src/routes/barberRoutes');
app.use('/api/barbers', barberRoutes);

async function ensureSlotIndexes() {
  try {
    const Slot = require('./src/models/Slot');
    const existingIndexes = await Slot.collection.indexes();
    const hasLegacyUnique = existingIndexes.some((idx) => idx && idx.name === 'barber_1_date_1_time_1');

    if (hasLegacyUnique) {
      await Slot.collection.dropIndex('barber_1_date_1_time_1');
      console.log('🧹 Eski slot indexi kaldırıldı: barber_1_date_1_time_1');
    }

    await Slot.createIndexes();
    console.log('✅ Slot indexleri doğrulandı');
  } catch (error) {
    console.warn('⚠️ Slot index migration atlandı:', error.message);
  }
}

async function repairLegacySlotPricing() {
  try {
    const Slot = require('./src/models/Slot');
    const Barber = require('./src/models/Barber');

    const slots = await Slot.find({
      status: { $in: ['booked', 'confirmed', 'completed'] },
      $or: [
        { manualPrice: { $in: [null, 0] } },
        { 'payment.amount': { $in: [null, 0] } },
      ],
    });

    if (!slots.length) {
      return;
    }

    const barberIds = [...new Set(slots.map((slot) => String(slot.barber)).filter(Boolean))];
    const barbers = await Barber.find({ _id: { $in: barberIds } }).select('services');
    const barberMap = new Map(barbers.map((barber) => [String(barber._id), barber]));

    let repairedCount = 0;

    for (const slot of slots) {
      const barber = barberMap.get(String(slot.barber));
      const services = Array.isArray(barber?.services) ? barber.services : [];
      const serviceRecord = slot.service
        ? services.id(slot.service)
        : (slot.customer?.service
          ? services.find((item) => String(item.name || '').trim().toLowerCase() === String(slot.customer.service || '').trim().toLowerCase())
          : null);
      const resolvedPrice = Number(serviceRecord?.price || 0);

      if (resolvedPrice <= 0) {
        continue;
      }

      const currentPaymentAmount = Number(slot.payment?.amount || 0);
      const currentManualPrice = Number(slot.manualPrice || 0);
      const shouldRepair = currentPaymentAmount <= 0 || currentManualPrice <= 0 || slot.payment?.isPaid !== true;

      if (!shouldRepair) {
        continue;
      }

      slot.manualPrice = resolvedPrice;
      slot.payment = {
        ...(slot.payment || {}),
        isPaid: true,
        amount: resolvedPrice,
      };
      if (slot.customer && typeof slot.customer === 'object' && slot.customer.totalPrice == null) {
        slot.customer.totalPrice = resolvedPrice;
      }
      if (!slot.service && serviceRecord?._id) {
        slot.service = serviceRecord._id;
      }

      await slot.save();
      repairedCount += 1;
    }

    console.log(`💸 Legacy slot fiyatları onarıldı: ${repairedCount}/${slots.length}`);
  } catch (error) {
    console.warn('⚠️ Legacy slot fiyat onarımı atlandı:', error.message);
  }
}

// MongoDB Bağlantı
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB bağlandı');
    await ensureSlotIndexes();
    await repairLegacySlotPricing();
  })
  .catch(err => {
    console.error('❌ MongoDB hatası:', err.message);
    process.exit(1);
  });

// Socket.io - Bağlı berberleri tut
const connectedBarbers = new Map();

// ayrıca müşterilerin socket bağlantılarını tut
const connectedCustomers = new Map();

// Global erişim için app'e ata
app.set('io', io);
app.set('connectedBarbers', connectedBarbers);
app.set('connectedCustomers', connectedCustomers);

io.on('connection', (socket) => {
  console.log('🔌 Yeni bağlantı:', socket.id);

  socket.on('barber_login', (barberId) => {
    if (!barberId) {
      return;
    }
    connectedBarbers.set(barberId.toString(), socket.id);
    console.log(`✂️ Berber ${barberId} online. Toplam: ${connectedBarbers.size}`);
  });

  socket.on('customer_login', (customerId) => {
    if (!customerId) {
      return;
    }
    connectedCustomers.set(customerId.toString(), socket.id);
    console.log(`👤 Müşteri ${customerId} online. Toplam: ${connectedCustomers.size}`);
  });

  socket.on('new_request', (data) => {
    const { requestId, barberId, customer, services, estimatedPrice } = data;
    const barberSocketId = connectedBarbers.get(barberId.toString());
    
    if (barberSocketId) {
      io.to(barberSocketId).emit('incoming_request', {
        requestId,
        customer,
        services,
        estimatedPrice,
        expiresAt: Date.now() + 30000
      });
      console.log(`📱 Bildirim gönderildi: Berber ${barberId}`);
    } else {
      console.log(`⚠️ Berber ${barberId} çevrimdışı`);
    }
  });

  socket.on('request_response', (data) => {
    const { requestId, status } = data;
    io.emit(`request_${requestId}_status`, { 
      status, 
      message: status === 'accepted' ? 'Berber onayladı!' : 'Berber müsait değil.'
    });
  });

  socket.on('disconnect', () => {
    for (let [barberId, socketId] of connectedBarbers.entries()) {
      if (socketId === socket.id) {
        connectedBarbers.delete(barberId);
        console.log(`❌ Berber ${barberId} offline`);
        break;
      }
    }
    for (let [custId, socketId] of connectedCustomers.entries()) {
      if (socketId === socket.id) {
        connectedCustomers.delete(custId);
        console.log(`❌ Müşteri ${custId} offline`);
        break;
      }
    }
  });
});

// Diğer Routes
app.use('/api/requests', require('./src/routes/requestRoutes'));
app.use('/api/subscription', require('./src/routes/subscriptionRoutes'));
app.use('/api/slots', require('./src/routes/slotRoutes'));

// Basit test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Berber Randevu API çalışıyor 🚀',
    endpoints: {
      register: 'POST /api/barbers/register',
      login: 'POST /api/barbers/login',
      nearby: 'GET /api/barbers/nearby?longitude=29.0&latitude=41.0',
      createRequest: 'POST /api/requests'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint bulunamadı' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Hata:', err);
  res.status(500).json({ success: false, error: 'Sunucu hatası' });
});

const PORT = process.env.PORT || 5001;

// Cron job'ları başlat
startCronJobs(io, connectedBarbers);

server.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`📱 Socket.io bağlantıları aktif`);
});
