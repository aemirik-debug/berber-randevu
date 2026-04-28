const express = require('express');
const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
const adminController = require('./src/controllers/adminController');
require('dotenv').config();

const app = express();
app.use(express.json());

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(() => {
  console.log('✅ MongoDB bağlandı');
}).catch(err => {
  console.error('❌ MongoDB hatası:', err.message);
});

// Doğrudan test route
app.post('/test-login', async (req, res) => {
  console.log('🔐 Test login request alındı:', req.body);
  try {
    await adminController.adminLogin(req, res);
  } catch (err) {
    console.error('❌ Kontroller hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`🚀 Test server port ${PORT} üzerinde aktif`);
});
