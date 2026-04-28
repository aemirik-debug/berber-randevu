const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const Customer = require('../models/Customer');
const Barber = require('../models/Barber');

// Upload dizinini oluştur
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config — memory storage (sharp ile işleyeceğiz)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece JPG, PNG, WebP formatları desteklenir'));
  }
});

// ─── Müşteri Profil Fotoğrafı ────────────────────
router.post('/customer/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (req.user?.role !== 'customer' || !req.customerId) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fotoğraf seçilmedi' });
    }

    const filename = `customer_${req.customerId}_${Date.now()}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Sharp ile optimize et (400x400, webp, %80 kalite)
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    const photoUrl = `/uploads/${filename}`;

    // Eski fotoğrafı sil
    const customer = await Customer.findById(req.customerId);
    if (customer?.profilePhoto) {
      const oldPath = path.join(__dirname, '../..', customer.profilePhoto);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await Customer.findByIdAndUpdate(req.customerId, { profilePhoto: photoUrl });

    res.json({ success: true, message: 'Profil fotoğrafı güncellendi', photoUrl });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Müşteri Profil Fotoğrafı Silme ────────────────────
router.delete('/customer/photo', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'customer' || !req.customerId) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok' });
    }

    const customer = await Customer.findById(req.customerId);
    if (customer?.profilePhoto) {
      const oldPath = path.join(__dirname, '../..', customer.profilePhoto);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await Customer.findByIdAndUpdate(req.customerId, { profilePhoto: '' });
    res.json({ success: true, message: 'Profil fotoğrafı silindi' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Berber Profil Fotoğrafı ────────────────────
router.post('/barber/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    if (req.user?.role !== 'barber' || !req.barberId) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fotoğraf seçilmedi' });
    }

    const filename = `barber_${req.barberId}_${Date.now()}.webp`;
    const filepath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    const photoUrl = `/uploads/${filename}`;

    const barber = await Barber.findById(req.barberId);
    if (barber?.profilePhoto) {
      const oldPath = path.join(__dirname, '../..', barber.profilePhoto);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await Barber.findByIdAndUpdate(req.barberId, { profilePhoto: photoUrl });

    res.json({ success: true, message: 'Profil fotoğrafı güncellendi', photoUrl });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Berber Galeri Fotoğrafı Ekleme (Portfolio) ────────────────────
router.post('/barber/gallery', authMiddleware, upload.array('photos', 10), async (req, res) => {
  try {
    if (req.user?.role !== 'barber' || !req.barberId) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Fotoğraf seçilmedi' });
    }

    const urls = [];
    for (const file of req.files) {
      const filename = `gallery_${req.barberId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`;
      const filepath = path.join(uploadDir, filename);

      await sharp(file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filepath);

      urls.push(`/uploads/${filename}`);
    }

    await Barber.findByIdAndUpdate(req.barberId, { $push: { gallery: { $each: urls } } });

    res.json({ success: true, message: `${urls.length} fotoğraf eklendi`, urls });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Berber Galeri Fotoğrafı Silme ────────────────────
router.delete('/barber/gallery', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'barber' || !req.barberId) {
      return res.status(403).json({ success: false, message: 'Yetkiniz yok' });
    }

    const { photoUrl } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ success: false, message: 'Silinecek fotoğraf belirtilmedi' });
    }

    const oldPath = path.join(__dirname, '../..', photoUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    await Barber.findByIdAndUpdate(req.barberId, { $pull: { gallery: photoUrl } });

    res.json({ success: true, message: 'Fotoğraf silindi' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
