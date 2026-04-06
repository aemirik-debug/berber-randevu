const { startCronJobs } = require('./src/services/cronService');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express(); // ✅ önce app tanımlanmalı
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

const customerRoutes = require('./src/routes/customerRoutes');
app.use('/api/customers', customerRoutes);

const locationsRoutes = require('./src/routes/locationsRoutes');
app.use('/api/locations', locationsRoutes);

const barberRoutes = require('./src/routes/barberRoutes');
app.use('/api/barbers', barberRoutes);

// MongoDB Bağlantı
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB bağlandı'))
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
    connectedBarbers.set(barberId.toString(), socket.id);
    console.log(`✂️ Berber ${barberId} online. Toplam: ${connectedBarbers.size}`);
  });

  socket.on('customer_login', (customerId) => {
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

const PORT = process.env.PORT || 5000;

// Cron job'ları başlat
startCronJobs(io, connectedBarbers);

server.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`📱 Socket.io bağlantıları aktif`);
});
