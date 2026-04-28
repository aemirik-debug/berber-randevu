const Barber = require('../models/Barber');

const checkFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const barber = await Barber.findById(req.barberId);
      
      if (!barber) {
        return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
      }

      // Özellik aktif mi kontrol et
      if (!barber.features[featureName]) {
        return res.status(403).json({
          success: false,
          error: 'Bu özellik mevcut paketinizde yok',
          upgradeRequired: true,
          currentPlan: barber.subscription.plan,
          requiredFeature: featureName,
          upgradeOptions: getUpgradeOptions(barber.subscription.plan, featureName)
        });
      }

      // Berber bilgisini request'e ekle (sonra kullanmak için)
      req.barber = barber;
      next();
      
    } catch (error) {
      res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
  };
};

// Yükseltme önerileri
function getUpgradeOptions(currentPlan, requiredFeature) {
  const upgrades = {
    basic: {
      calendarBooking: { to: 'pro', price: '99 TL/ay' },
      homeService: { to: 'elite', price: '299 TL/ay' },
      featured: { to: 'premium', price: '199 TL/ay' }
    },
    pro: {
      instantBooking: { to: 'premium', price: '199 TL/ay' },
      homeService: { to: 'elite', price: '299 TL/ay' }
    },
    premium: {
      homeService: { to: 'elite', price: '299 TL/ay' }
    }
  };

  return upgrades[currentPlan]?.[requiredFeature] || { to: 'elite', price: '299 TL/ay' };
}

module.exports = checkFeature;