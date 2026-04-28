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

    const safeMasters = Array.isArray(barber.masters)
      ? barber.masters
          .filter((master) => master && master.isActive !== false)
          .map((master) => ({
            _id: master._id,
            name: master.name,
            specialty: master.specialty || '',
            isActive: master.isActive !== false,
          }))
      : [];

    return {
      _id: barber._id,
      barberType: barber.barberType,
      salonName: barber.salonName,
      name: barber.name,
      phone: barber.phone,
      email: barber.email,
      address: barber.address,
      city: barber.city,
      district: barber.district,
      facebookUrl: barber.facebookUrl || '',
      instagramUrl: barber.instagramUrl || '',
      workingHours: barber.workingHours || null,
      services: Array.isArray(barber.services) ? barber.services : [],
      status: barber.status,
      logoUrl: barber.logoUrl,
      masters: safeMasters,
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
router.post('/master/login', controller.masterLogin);
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
    const targetBarberId = String(barber._id);
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

      const appBarberId = String(app?.barberId || '').trim();
      if (appBarberId && appBarberId === targetBarberId) {
        return true;
      }

      const appBarberNameLc = (app?.barberName || '').toLowerCase();
      const appSalonNameLc = (app?.barberSalonName || '').toLowerCase();
      return (barberNameLc && appBarberNameLc.includes(barberNameLc))
        || (salonNameLc && appBarberNameLc.includes(salonNameLc))
        || (salonNameLc && appSalonNameLc.includes(salonNameLc));
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
    const nowTs = new Date();
    const customerIdStr = String(req.customerId);
    const hasExistingReview = (barber.reviews || []).some((item) => item.customerId === customerIdStr);

    if (hasExistingReview) {
      await Barber.updateOne(
        { _id: barber._id, 'reviews.customerId': customerIdStr },
        {
          $set: {
            'reviews.$.rating': rating,
            'reviews.$.comment': comment,
            'reviews.$.updatedAt': nowTs,
          },
        }
      );
    } else {
      await Barber.updateOne(
        { _id: barber._id },
        {
          $push: {
            reviews: {
              customerId: customerIdStr,
              customerName,
              rating,
              comment,
              createdAt: nowTs,
              updatedAt: nowTs,
            },
          },
        }
      );
    }

    const refreshedBarber = await Barber.findById(barber._id).select('reviews');
    const reviews = refreshedBarber?.reviews || [];
    const { reviewCount, avgRating, latestReview } = buildReviewStats(reviews);
    const updatedReview = reviews.find((item) => item.customerId === customerIdStr) || null;

    res.json({
      message: 'Yorum kaydedildi',
      reviewCount,
      avgRating,
      latestReview,
      updatedReview,
    });
  } catch (err) {
    console.error('Review create error:', err);
    res.status(400).json({ message: err.message || 'Yorum kaydedilirken hata oluştu' });
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

    await Barber.updateOne(
      { _id: barber._id },
      { $pull: { reviews: { customerId: String(req.customerId) } } }
    );

    const refreshedBarber = await Barber.findById(barber._id).select('reviews');
    const { reviewCount, avgRating, latestReview } = buildReviewStats(refreshedBarber?.reviews || []);
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