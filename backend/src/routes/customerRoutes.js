const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

function ensureCustomerAccess(req, res) {
  if (req.user?.role !== 'customer' || req.customerId?.toString() !== req.params.id) {
    res.status(403).json({ message: 'Bu işlem için yetkiniz yok' });
    return false;
  }
  return true;
}

// Kayıt
router.post('/register', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Telefon ve şifre zorunludur' });
    }

    // Aynı telefonla kayıtlı müşteri var mı kontrol et
    const existingCustomer = await Customer.findOne({ phone });
    if (existingCustomer) {
      return res.status(400).json({ success: false, message: 'Bu telefon numarası zaten kayıtlı' });
    }

    const customer = new Customer({ phone, password });
    await customer.save();
    
    const token = jwt.sign({ customerId: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, message: 'Kayıt başarılı', token, customer });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Giriş
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Telefon ve şifre zorunludur' });
    }

    const customer = await Customer.findOne({ phone, password });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Müşteri bulunamadı veya şifre hatalı' });
    }

    const token = jwt.sign({ customerId: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, message: 'Giriş başarılı', token, customer });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Profil güncelleme (PROTECTED)
router.put('/update/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedCustomer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Şifre güncelleme (PROTECTED)
router.put('/update-password/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const { oldPassword, newPassword } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    if (customer.password !== oldPassword) {
      return res.status(400).json({ message: 'Eski şifre yanlış' });
    }

    customer.password = newPassword;
    await customer.save();

    res.json({ message: 'Şifre başarıyla güncellendi' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Müşteri randevularını getir (PROTECTED)
router.get('/appointments/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const customer = await Customer.findById(req.params.id);
    res.json(customer.appointments);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Müşteri randevusu oluştur (PROTECTED)
router.post('/appointments/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const { barberName, date, time, service } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    customer.appointments.push({ barberName, date, time, service, status: 'pending' });
    await customer.save();

    res.json({ message: 'Randevu başarıyla oluşturuldu', appointments: customer.appointments });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Müşteri faturalarını getir (PROTECTED)
router.get('/invoices/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const customer = await Customer.findById(req.params.id);
    res.json(customer.invoices);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// Müşteri favorilerini getir (PROTECTED)
router.get('/favorites/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const customer = await Customer.findById(req.params.id);
    res.json(customer.favorites);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// Favori ekle (PROTECTED)
router.post('/favorites/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const { barberId, barberName, district, phone } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const alreadyExists = customer.favorites.some(f => f.barberId === barberId);
    if (alreadyExists) {
      return res.status(400).json({ message: 'Bu berber zaten favorilerde' });
    }

    const favorite = { barberId, barberName, district, phone };
    customer.favorites.push(favorite);
    await customer.save();

    res.json({ message: 'Favori başarıyla eklendi', favorite });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Favori sil
router.delete('/favorites/:id/:barberId', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    customer.favorites = customer.favorites.filter(
      f => f.barberId !== req.params.barberId
    );
    await customer.save();

    res.json({ message: 'Favori başarıyla silindi' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;