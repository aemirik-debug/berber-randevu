const router = require('express').Router();
const express = require('express');
const controller = require('../controllers/barberController');
const authMiddleware = require('../middleware/authMiddleware');
const Barber = require('../models/Barber');
const Customer = require('../models/Customer');

function enrichBarbersWithReviewStats(barbers) {
  return barbers.map((barberDoc) => {
    const barber = barberDoc.toObject();
    const reviews = Array.isArray(barber.reviews) ? barber.reviews : [];
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0
      ? Number((reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviewCount).toFixed(1))
      : 0;
    const latestReview = reviewCount > 0
      ? [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null;

    return {
      ...barber,
      reviewCount,
      avgRating,
      latestReview: latestReview
        ? {
            customerName: latestReview.customerName,
            rating: latestReview.rating,
            comment: latestReview.comment,
            createdAt: latestReview.createdAt,
          }
        : null,
    };
  });
}

function buildReviewStats(reviewsInput) {
  const reviews = Array.isArray(reviewsInput) ? reviewsInput : [];
  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? Number((reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviewCount).toFixed(1))
    : 0;
  const latestReview = reviewCount > 0
    ? [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    : null;

  return { reviewCount, avgRating, latestReview };
}

// Public routes
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/nearby', controller.getNearby);
router.get('/', async (req, res) => {
  try {
    const { district } = req.query;
    const query = district ? { district } : {};
    const barbers = await Barber.find(query);
    res.json(enrichBarbersWithReviewStats(barbers));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:barberId/reviews', async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.barberId).select('reviews');
    if (!barber) {
      return res.status(404).json({ message: 'Berber bulunamadı' });
    }

    const reviews = (barber.reviews || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const { reviewCount, avgRating } = buildReviewStats(reviews);

    res.json({ reviewCount, avgRating, reviews });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:barberId/reviews', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'customer' || !req.customerId) {
      return res.status(403).json({ message: 'Sadece müşteriler yorum yapabilir' });
    }

    const barber = await Barber.findById(req.params.barberId);
    if (!barber) {
      return res.status(404).json({ message: 'Berber bulunamadı' });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const now = new Date();
    const barberNameLc = (barber.name || '').toLowerCase();
    const salonNameLc = (barber.salonName || '').toLowerCase();
    const hasPastService = (customer.appointments || []).some((app) => {
      const statusLc = (app?.status || '').toLowerCase();
      if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
        return false;
      }

      const appDate = app?.date ? new Date(`${app.date}T${app.time || '00:00'}`) : null;
      const isPastAppointment = appDate instanceof Date && !Number.isNaN(appDate.getTime())
        ? appDate < now
        : true;
      if (!isPastAppointment) {
        return false;
      }

      const appBarberNameLc = (app?.barberName || '').toLowerCase();
      return (barberNameLc && appBarberNameLc.includes(barberNameLc))
        || (salonNameLc && appBarberNameLc.includes(salonNameLc));
    });

    if (!hasPastService) {
      return res.status(403).json({ message: 'Yorum yapabilmek için bu berberden daha önce hizmet almış olmalısınız' });
    }

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Puan 1 ile 5 arasında olmalı' });
    }
    if (comment.length > 500) {
      return res.status(400).json({ message: 'Yorum en fazla 500 karakter olabilir' });
    }

    const customerName = [customer.name, customer.surname].filter(Boolean).join(' ') || 'Müşteri';
    const existingIndex = (barber.reviews || []).findIndex((item) => item.customerId === String(req.customerId));
    if (existingIndex >= 0) {
      barber.reviews[existingIndex].rating = rating;
      barber.reviews[existingIndex].comment = comment;
      barber.reviews[existingIndex].updatedAt = new Date();
    } else {
      barber.reviews.push({
        customerId: String(req.customerId),
        customerName,
        rating,
        comment,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await barber.save();

    const reviews = barber.reviews || [];
    const { reviewCount, avgRating, latestReview } = buildReviewStats(reviews);
    const updatedReview = reviews.find((item) => item.customerId === String(req.customerId)) || null;

    res.json({
      message: 'Yorum kaydedildi',
      reviewCount,
      avgRating,
      latestReview,
      updatedReview,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:barberId/reviews/me', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'customer' || !req.customerId) {
      return res.status(403).json({ message: 'Sadece müşteriler yorum silebilir' });
    }

    const barber = await Barber.findById(req.params.barberId);
    if (!barber) {
      return res.status(404).json({ message: 'Berber bulunamadı' });
    }

    const myReviewIndex = (barber.reviews || []).findIndex((item) => item.customerId === String(req.customerId));
    if (myReviewIndex < 0) {
      return res.status(404).json({ message: 'Silinecek yorum bulunamadı' });
    }

    const myReview = barber.reviews[myReviewIndex];
    const createdAt = myReview?.createdAt ? new Date(myReview.createdAt) : null;
    const ageMs = createdAt instanceof Date && !Number.isNaN(createdAt.getTime())
      ? Date.now() - createdAt.getTime()
      : Number.MAX_SAFE_INTEGER;
    const allowedWindowMs = 24 * 60 * 60 * 1000;

    if (ageMs > allowedWindowMs) {
      return res.status(403).json({ message: 'Yorumlar sadece ilk 24 saat içinde silinebilir' });
    }

    barber.reviews.splice(myReviewIndex, 1);
    await barber.save();

    const { reviewCount, avgRating, latestReview } = buildReviewStats(barber.reviews || []);
    res.json({ message: 'Yorum silindi', reviewCount, avgRating, latestReview });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
// Protected routes
router.get('/profile', authMiddleware, controller.getProfile);
router.patch('/profile', authMiddleware, controller.updateProfile);
router.patch('/profile/password', authMiddleware, controller.changePassword);
// services management
router.get('/services', authMiddleware, controller.getServices);
router.post('/services', authMiddleware, controller.addService);
router.put('/services/:serviceId', authMiddleware, controller.updateService);
router.delete('/services/:serviceId', authMiddleware, controller.deleteService);

// Bölgeye göre berber bul (PUBLIC - müşteri booking ekranı için)
router.get('/byDistrict', async (req, res) => {
  try {
    const { city, district } = req.query;
    const barbers = await Barber.find({ city, district });
    res.json(enrichBarbersWithReviewStats(barbers));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;