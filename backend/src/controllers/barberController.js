const Barber = require('../models/Barber');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const Slot = require('../models/Slot');

// Moment.js'i English locale'e ayarla
moment.locale('en');

function barberDefaultsWorkingHours() {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const obj = {};
  days.forEach(d => {
    obj[d] = { isOpen: false, open: '09:00', close: '17:00' };
  });
  return obj;
}

exports.register = async (req, res) => {
  try {
    const { barberType, salonName, fullName, phone, email, address, city, district, subscriptionPlan, password, services, features, workingHours } = req.body;

    if (!barberType || !salonName || !fullName || !phone || !email || !address || !city || !district || !password) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
    }

    const existingBarber = await Barber.findOne({ phone });
    if (existingBarber) {
      return res.status(400).json({ error: 'Bu telefon numarası zaten kayıtlı' });
    }

    const existingBarberEmail = await Barber.findOne({ email });
    if (existingBarberEmail) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const barber = new Barber({
      barberType,
      salonName,
      name: fullName,
      phone,
      email,
      address,
      city,
      district,
      password: hashedPassword,
      location: {
        type: 'Point',
        coordinates: [0, 0] // şimdilik dummy
      },
      subscription: {
        plan: 'basic',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: false
      },
      services: Array.isArray(services) ? services : [],
      features: features && features.calendarBooking !== undefined ? features : { calendarBooking: true },
      workingHours: workingHours || barberDefaultsWorkingHours()
    });

    await barber.save();

    // Eğer calendar feature enabled ise otomatik slot oluştur
    if (barber.features?.calendarBooking) {
      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(60, 'days').format('YYYY-MM-DD');
      generateAutoSlots(barber._id, startDate, endDate).catch(err => {
        console.error('Auto-generate slots failed after registration:', err);
      });
    }

    const token = jwt.sign({ barberId: barber._id, role: 'barber' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      data: { id: barber._id, salonName: barber.salonName, barberType: barber.barberType }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Berber Login
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const barber = await Barber.findOne({ phone });
    if (!barber) {
      return res.status(400).json({ error: 'Berber bulunamadı' });
    }

    const isMatch = await bcrypt.compare(password, barber.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Şifre hatalı' });
    }

    const token = jwt.sign({ barberId: barber._id, role: 'barber' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      data: { id: barber._id, salonName: barber.salonName, barberType: barber.barberType }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// @desc    Durum güncelleme (online/busy/offline)
// @route   PATCH /api/barbers/status
// @access  Private
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const barberId = req.barberId; // Auth middleware'den gelir

    if (!['online', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Geçersiz durum' 
      });
    }

    const barber = await Barber.findByIdAndUpdate(
      barberId,
      { status },
      { new: true }
    ).select('-password');

    if (!barber) {
      return res.status(404).json({ 
        success: false, 
        error: 'Berber bulunamadı' 
      });
    }

    res.json({
      success: true,
      data: {
        status: barber.status,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Durum güncelleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası' 
    });
  }
};

// @desc    Yakındaki berberleri getir
// @route   GET /api/barbers/nearby
// @access  Public
exports.getNearby = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 5000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ 
        success: false, 
        error: 'Konum bilgisi gerekli (longitude, latitude)' 
      });
    }

    const barbers = await Barber.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance) // metre
        }
      },
      status: { $in: ['online', 'busy'] } // Sadece aktif berberler
    }).select('-password');

    res.json({
      success: true,
      count: barbers.length,
      data: barbers
    });

  } catch (error) {
    console.error('Yakındaki berberler hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Sunucu hatası' 
    });
  }
};

// Profil bilgilerini getir
exports.getProfile = async (req, res) => {
  try {
    const barberId = req.user.barberId; // JWT’den gelen barberId
    const barber = await Barber.findById(barberId).select('-password'); // şifreyi göndermiyoruz

    if (!barber) {
      return res.status(404).json({ error: 'Berber bulunamadı' });
    }

    res.json(barber);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Profil bilgilerini güncelle
exports.updateProfile = async (req, res) => {
  try {
    const barberId = req.barberId;
    const updates = { ...req.body };

    // Telefon değiştirilemez
    if (updates.phone) {
      delete updates.phone;
    }

    // abonelik planı tek field olarak geliyor, nested kaydet
    if (updates.subscriptionPlan) {
      updates.subscription = updates.subscription || {};
      updates.subscription.plan = updates.subscriptionPlan;
      delete updates.subscriptionPlan;
    }

    // features ve workingHours direkt güncellenebilir
    const hasWorkingHoursUpdate = !!updates.workingHours;
    const hasCalendarFeatureUpdate = updates.features && updates.features.calendarBooking !== undefined;

    // abonelik vs dışında herhangi bir field olabilir
    const barber = await Barber.findByIdAndUpdate(barberId, updates, { new: true }).select('-password');

    if (!barber) {
      return res.status(404).json({ error: 'Berber bulunamadı' });
    }

    // Eğer çalışma saatleri veya calendar feature güncellenirse otomatik slot oluştur
    if ((hasWorkingHoursUpdate || hasCalendarFeatureUpdate) && barber.features?.calendarBooking) {
      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(60, 'days').format('YYYY-MM-DD');
      
      // Backend'de hata olsa bile frontend'de durum güncellenmiş olsun, bu yüzden async çalıştır
      generateAutoSlots(barberId, startDate, endDate).catch(err => {
        console.error('Slot auto-generate failed:', err);
      });
    }

    res.json({ success: true, data: barber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// -- services CRUD ------------------------------------------------
exports.getServices = async (req, res) => {
  try {
    const barberId = req.barberId;
    const barber = await Barber.findById(barberId).select('services');
    if (!barber) return res.status(404).json({ error: 'Berber bulunamadı' });
    res.json({ success: true, services: barber.services });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addService = async (req, res) => {
  try {
    const barberId = req.barberId;
    const { name, price, duration } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'Hizmet adı ve fiyat gerekli' });
    }
    const barber = await Barber.findById(barberId);
    if (!barber) return res.status(404).json({ error: 'Berber bulunamadı' });
    const svc = { name, price, duration: duration || 0 };
    barber.services.push(svc);
    await barber.save();
    res.json({ success: true, service: barber.services[barber.services.length - 1] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const barberId = req.barberId;
    const { serviceId } = req.params;
    const { name, price, duration } = req.body;
    const barber = await Barber.findOneAndUpdate(
      { _id: barberId, 'services._id': serviceId },
      { $set: {
          'services.$.name': name,
          'services.$.price': price,
          'services.$.duration': duration
        } },
      { new: true }
    );
    if (!barber) return res.status(404).json({ error: 'Berber veya hizmet bulunamadı' });
    const updated = barber.services.id(serviceId);
    res.json({ success: true, service: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const barberId = req.barberId;
    const { serviceId } = req.params;
    const barber = await Barber.findByIdAndUpdate(
      barberId,
      { $pull: { services: { _id: serviceId } } },
      { new: true }
    );
    if (!barber) return res.status(404).json({ error: 'Berber bulunamadı' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Şifre değiştirme
exports.changePassword = async (req, res) => {
  try {
    const barberId = req.barberId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gereklidir' });
    }

    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ error: 'Berber bulunamadı' });
    }

    const isMatch = await bcrypt.compare(currentPassword, barber.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mevcut şifre yanlış' });
    }

    // basit doğrulama; daha kapsamlı kontrol ekleyebilirsiniz
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalıdır' });
    }

    barber.password = await bcrypt.hash(newPassword, 10);
    await barber.save();

    res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ============ OTOMATIK SLOT OLUŞTURMA HELPER FUNCTIONS ============

/**
 * Verilen tarih aralığında berber çalışma saatlerine göre otomatik slot oluştur
 * @param {String} barberId - Berber ID
 * @param {String} startDate - Başlangıç tarihi (YYYY-MM-DD)
 * @param {String} endDate - Bitiş tarihi (YYYY-MM-DD)
 */
async function generateAutoSlots(barberId, startDate, endDate) {
  try {
    const barber = await Barber.findById(barberId);
    if (!barber) {
      console.error(`❌ generateAutoSlots: Berber bulunamadı ID=${barberId}`);
      return { success: false, error: 'Berber bulunamadı' };
    }

    console.log(`🔄 generateAutoSlots başladı - BarberId: ${barberId}, ${startDate} - ${endDate}`);
    console.log(`   Features: ${JSON.stringify(barber.features)}`);
    console.log(`   Working Hours: ${JSON.stringify(barber.workingHours)}`);

    const slots = [];
    let current = moment(startDate).locale('en'); // English locale kullan
    const end = moment(endDate).locale('en');
    let daysProcessed = 0;
    let slotCount = 0;

    while (current <= end) {
      const dayName = current.format('dddd').toLowerCase(); // monday, tuesday...
      console.log(`   ${current.format('YYYY-MM-DD')} - Gün: ${dayName}`);
      const dayConfig = barber.workingHours[dayName];

      if (dayConfig && dayConfig.isOpen) {
        daysProcessed++;
        console.log(`      ✓ Açık (${dayConfig.open} - ${dayConfig.close})`);
        const slotDuration = 30; // 30 dakikalık slotlar
        let currentTime = moment(dayConfig.open, 'HH:mm').locale('en');
        const endTime = moment(dayConfig.close, 'HH:mm').locale('en');

        while (currentTime < endTime) {
          const timeStr = currentTime.format('HH:mm');
          const dateStr = current.format('YYYY-MM-DD');

          // Aynı slot var mı kontrol et
          const existing = await Slot.findOne({
            barber: barberId,
            date: dateStr,
            time: timeStr
          });

          if (!existing) {
            slots.push({
              barber: barberId,
              date: dateStr,
              time: timeStr,
              status: 'available'
            });
            slotCount++;
          }

          currentTime.add(slotDuration, 'minutes');
        }
      }

      current.add(1, 'day');
    }

    if (slots.length > 0) {
      await Slot.insertMany(slots);
      console.log(`✅ generateAutoSlots tamamlandı: ${slots.length} yeni slot oluşturuldu (${daysProcessed} iş günü)`);
    } else {
      console.warn(`⚠️ generateAutoSlots tamamlandı ama hiç yeni slot oluşturulmadı`);
    }

    return { success: true, count: slots.length };
  } catch (error) {
    console.error('Otomatik slot oluşturma hatası:', error);
    return { success: false, error: error.message };
  }
}

exports.generateAutoSlots = generateAutoSlots;
