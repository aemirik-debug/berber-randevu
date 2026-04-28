const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const checkFeature = require('../middleware/checkFeature');
const Barber = require('../models/Barber');

// Mevcut paket bilgisi
router.get('/my-plan', auth, async (req, res) => {
  try {
    const barber = await Barber.findById(req.barberId)
      .select('subscription features homeService');
    
    res.json({
      success: true,
      data: {
        subscription: barber.subscription,
        features: barber.features,
        homeService: barber.homeService
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Paket detayları (tüm paketlerin özellikleri)
router.get('/plans', async (req, res) => {
  const plans = {
    basic: {
      name: 'Basic',
      price: 0,
      features: ['instantBooking'],
      description: 'Anlık müsaitlik sistemi'
    },
    pro: {
      name: 'Pro',
      price: 99,
      features: ['calendarBooking'],
      description: 'Takvim randevu sistemi'
    },
    premium: {
      name: 'Premium',
      price: 199,
      features: ['instantBooking', 'calendarBooking', 'featured'],
      description: 'Her iki sistem + öne çıkma'
    },
    elite: {
      name: 'Elite',
      price: 299,
      features: ['instantBooking', 'calendarBooking', 'featured', 'homeService', 'customPricing'],
      description: 'Yerinde hizmet + tüm özellikler'
    }
  };
  
  res.json({ success: true, data: plans });
});

// Paket yükseltme (ödeme entegrasyonu sonradan eklenecek)
router.post('/upgrade', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!['basic', 'pro', 'premium', 'elite'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Geçersiz paket' });
    }

    const features = {
      basic: { 
        instantBooking: true, 
        calendarBooking: false, 
        homeService: false, 
        featured: false,
        customPricing: false
      },
      pro: { 
        instantBooking: false, 
        calendarBooking: true, 
        homeService: false, 
        featured: false,
        customPricing: false
      },
      premium: { 
        instantBooking: true, 
        calendarBooking: true, 
        homeService: false, 
        featured: true,
        customPricing: false
      },
      elite: { 
        instantBooking: true, 
        calendarBooking: true, 
        homeService: true, 
        featured: true,
        customPricing: true
      }
    };

    const barber = await Barber.findByIdAndUpdate(
      req.barberId,
      {
        'subscription.plan': plan,
        'subscription.expiresAt': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        features: features[plan]
      },
      { new: true }
    );

    res.json({
      success: true,
      message: `Paket yükseltildi: ${plan}`,
      data: {
        subscription: barber.subscription,
        features: barber.features
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yerinde hizmet ayarları (sadece Elite)
router.patch('/home-service', auth, checkFeature('homeService'), async (req, res) => {
  try {
    const { basePrice, perKmPrice, maxDistance, workingHours } = req.body;
    
    const barber = await Barber.findByIdAndUpdate(
      req.barberId,
      {
        'homeService.enabled': true,
        'homeService.basePrice': basePrice,
        'homeService.perKmPrice': perKmPrice,
        'homeService.maxDistance': maxDistance,
        'homeService.workingHours': workingHours
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Yerinde hizmet ayarları güncellendi',
      data: barber.homeService
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;