const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const checkFeature = require('../middleware/checkFeature');
const Slot = require('../models/Slot');
const Barber = require('../models/Barber');
const moment = require('moment');

// Moment.js'i English locale'e ayarla
moment.locale('en');

function getNowDateTimeParts() {
  const now = new Date();
  return {
    todayIso: moment(now).format('YYYY-MM-DD'),
    nowTime: moment(now).format('HH:mm')
  };
}

function isPastDateTime(dateStr, timeStr) {
  const date = String(dateStr || '').trim();
  const time = String(timeStr || '').trim().slice(0, 5);

  if (!date || !time) {
    return false;
  }

  const { todayIso, nowTime } = getNowDateTimeParts();

  if (date < todayIso) {
    return true;
  }

  if (date > todayIso) {
    return false;
  }

  return time <= nowTime;
}

async function pushAppointmentToCustomer({ customerId, customerPhone, appointment }) {
  const Customer = require('../models/Customer');

  let customer = null;
  if (customerId) {
    customer = await Customer.findById(customerId);
  }

  if (!customer && customerPhone) {
    customer = await Customer.findOne({ phone: customerPhone });
  }

  if (!customer) {
    return false;
  }

  customer.appointments.push(appointment);
  await customer.save();
  return true;
}

function buildCustomerAppointment(slot, extra = {}) {
  const barberId = slot.barber?._id ? String(slot.barber._id) : String(slot.barber || '');

  return {
    slotId: String(slot._id),
    barberId,
    barberName: slot.barber?.name || extra.barberName || '',
    date: slot.date,
    time: slot.time,
    service: {
      name: extra.serviceName || (slot.customer && slot.customer.service) || 'Belirtilmemiş',
      price: 0,
      duration: 30
    },
    status: extra.status || 'Randevu Alındı',
    createdAt: extra.createdAt || new Date(),
    reminderSentAt: extra.reminderSentAt || null
  };
}

function toCustomerStatus(slotStatus) {
  const statusLc = String(slotStatus || '').toLowerCase();
  if (statusLc === 'confirmed') {
    return 'confirmed';
  }
  if (statusLc === 'cancelled') {
    return 'cancelled';
  }
  return 'Randevu Alındı';
}

// ===== TEST ENDPOINT - SLOT İSTATİSTİKLERİ =====
router.get('/debug/stats', auth, async (req, res) => {
  try {
    const totalSlots = await Slot.countDocuments({ barber: req.barberId });
    const availableSlots = await Slot.countDocuments({ barber: req.barberId, status: 'available' });
    const bookedSlots = await Slot.countDocuments({ barber: req.barberId, status: 'booked' });
    const sampleSlots = await Slot.find({ barber: req.barberId }).limit(10).sort({ date: 1, time: 1 });
    
    const barber = await Barber.findById(req.barberId).select('features workingHours');
    
    res.json({
      success: true,
      barber: {
        features: barber.features,
        workingHours: barber.workingHours
      },
      stats: {
        totalSlots,
        availableSlots,
        bookedSlots
      },
      sampleSlots
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli tarihteki slotları getir (Müşteri için)
router.get('/available', async (req, res) => {
  try {
    const { barberId, date } = req.query;
    
    if (!barberId || !date) {
      return res.status(400).json({ success: false, error: 'barberId ve date gerekli' });
    }

    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }

    // Pro/Premium/Elite değilse takvim yok
    if (!barber.features.calendarBooking) {
      return res.status(403).json({ 
        success: false, 
        error: 'Bu berber takvim randevusu almıyor',
        instantOnly: true 
      });
    }

    const slots = await Slot.find({
      barber: barberId,
      date: date,
      status: 'available'
    }).sort({ time: 1 });

    res.json({
      success: true,
      count: slots.length,
      data: slots
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// berber tarafından dolu slotlar için onay/iptal işlemi
router.patch('/:slotId/action', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { action, reason } = req.body; // 'confirm' veya 'cancel'
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) return res.status(404).json({ success: false, error: 'Slot bulunamadı' });

    if (slot.status !== 'booked') {
      return res.status(400).json({ success: false, error: 'Sadece dolu slotlar üzerinde işlem yapılabilir' });
    }

    if (action === 'cancel') {
      if (slot.isHistoricalRecord) {
        return res.status(400).json({ success: false, error: 'Tarihi kayıtlar iptal akışına alınamaz' });
      }
      slot.status = 'cancelled';
      slot.cancelReason = reason || '';
    } else if (action === 'confirm') {
      slot.status = 'confirmed';
    } else {
      return res.status(400).json({ success: false, error: 'Geçersiz işlem' });
    }
    await slot.save();
    // Eğer müşteri kayıtlıysa Customer.appointments dizisine ekle
    if (req.body.customerId) {
      const Customer = require('../models/Customer');
      try {
        const updateRes = await Customer.findByIdAndUpdate(req.body.customerId, {
          $push: {
            appointments: buildCustomerAppointment(slot, {
              serviceName: req.body.service || (slot.customer && slot.customer.service) || 'Belirtilmemiş'
            })
          }
        });
        console.log('Customer appointment push result for', req.body.customerId, updateRes ? 'ok' : 'not-found');
      } catch (e) {
        console.warn('Customer appointment push failed:', e.message);
      }
    }
    
    // müşteri randevusunu güncelle
    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.date': slot.date, 'appointments.time': slot.time },
        {
          $set: {
            'appointments.$.status': action === 'cancel' ? 'cancelled' : 'confirmed',
            'appointments.$.cancelReason': action === 'cancel'
              ? (reason || 'Berber iptal etti')
              : '',
          }
        }
      );
    }

    // socket bildirim
    const io = req.app.get('io');
    const connectedCustomers = req.app.get('connectedCustomers');
    
    // Frontend'den gelen customerId veya slot'ta kaydedilen customerId'yi kullan
    const targetCustomerId = req.body.customerId || slot.customer?.customerId;
    
    console.log(`🔔 Socket bildirim düşünülüyor:`, {
      fromRequest: req.body.customerId,
      fromSlot: slot.customer?.customerId,
      targetCustomerId,
      connectedCustomersSize: connectedCustomers?.size || 0,
      connectedList: Array.from(connectedCustomers?.keys() || [])
    });
    
    if (targetCustomerId && connectedCustomers) {
      const sockId = connectedCustomers.get(targetCustomerId.toString());
      console.log(`   Customer ID: ${targetCustomerId.toString()}, Socket ID: ${sockId || 'NOT FOUND'}`);
      
      if (sockId) {
        console.log(`   ✅ Socket emit: status=${slot.status}`);
        io.to(sockId).emit('appointment_update', {
          slotId: slot._id,
          status: slot.status,
          date: slot.date,
          time: slot.time
        });
      } else {
        console.warn(`   ❌ Socket ID bulunamadı. Customer online değil mi?`);
      }
    } else {
      console.warn(`   ⚠️ Socket bildirim gönderilemedi: customerId yok (${!targetCustomerId}) veya connectedCustomers yok (${!connectedCustomers})`);
    }

    res.json({ success: true, slot });
  } catch (error) {
    console.error('❌ Slot action hatası:', error.message, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Berber yeni gelen randevunun tarih/saatini düzenleyip müşteriye bildirir
router.patch('/:slotId/reschedule', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { newDate, newTime } = req.body;

    if (!newTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(newTime))) {
      return res.status(400).json({ success: false, error: 'Geçerli bir saat giriniz (HH:mm)' });
    }

    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (!['booked', 'confirmed'].includes(String(slot.status || '').toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Sadece bekleyen veya onaylı randevular düzenlenebilir' });
    }

    const targetDate = String(newDate || slot.date || '').trim();
    const targetTime = String(newTime || '').trim();
    const oldDate = slot.date;
    const oldTime = slot.time;

    if (isPastDateTime(targetDate, targetTime)) {
      return res.status(400).json({ success: false, error: 'Geçmiş saat için değişiklik yapılamaz' });
    }

    const clashSlot = await Slot.findOne({
      barber: req.barberId,
      date: targetDate,
      time: targetTime,
      _id: { $ne: slot._id }
    });

    if (clashSlot) {
      return res.status(400).json({ success: false, error: 'Bu saatte başka bir randevu/slot mevcut' });
    }

    const previousStatus = String(slot.status || '').toLowerCase();

    slot.status = 'reschedule_pending_customer';
    slot.rescheduleApproval = {
      phase: 'awaiting_customer',
      previousStatus,
      oldDate,
      oldTime,
      proposedDate: targetDate,
      proposedTime: targetTime,
      customerDecision: 'pending',
      barberDecision: 'pending',
      requestedBy: 'barber',
      requestedAt: new Date(),
      customerRespondedAt: null,
      barberRespondedAt: null,
    };
    await slot.save();

    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.slotId': String(slot._id) },
        {
          $set: {
            'appointments.$.date': slot.date,
            'appointments.$.time': slot.time,
            'appointments.$.status': 'Saat Değişikliği Müşteri Onayı Bekleniyor',
            'appointments.$.rescheduleApproval': {
              phase: 'awaiting_customer',
              oldDate,
              oldTime,
              proposedDate: targetDate,
              proposedTime: targetTime,
              customerDecision: 'pending',
              barberDecision: 'pending',
              requestedAt: new Date(),
              customerRespondedAt: null,
              barberRespondedAt: null,
            },
          }
        }
      );
    }

    const io = req.app.get('io');
    const connectedCustomers = req.app.get('connectedCustomers');
    const customerId = slot.customer?.customerId ? String(slot.customer.customerId) : null;
    const socketId = customerId && connectedCustomers ? connectedCustomers.get(customerId) : null;

    if (socketId && io) {
      io.to(socketId).emit('appointment_update', {
        slotId: String(slot._id),
        status: 'Saat Değişikliği Müşteri Onayı Bekleniyor',
        date: oldDate,
        time: oldTime,
        oldDate,
        oldTime,
        message: 'Berber yeni saat önerdi. Lütfen onaylayın veya reddedin.',
        rescheduleApproval: {
          phase: 'awaiting_customer',
          oldDate,
          oldTime,
          proposedDate: targetDate,
          proposedTime: targetTime,
          customerDecision: 'pending',
          barberDecision: 'pending',
        }
      });
    }

    return res.json({
      success: true,
      message: 'Yeni saat önerisi müşteriye gönderildi, müşteri onayı bekleniyor',
      notified: Boolean(socketId),
      slot
    });
  } catch (error) {
    console.error('❌ Reschedule hatası:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Müşteri kabulünden sonra son onay / red (berber)
router.patch('/:slotId/reschedule/finalize', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approve', 'reject'].includes(String(decision || '').toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Geçersiz karar' });
    }

    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (String(slot.status || '').toLowerCase() !== 'reschedule_pending_barber') {
      return res.status(400).json({ success: false, error: 'Bu randevu için müşteri onayı sonrası final adımı beklenmiyor' });
    }

    if (String(slot.rescheduleApproval?.phase || '') !== 'awaiting_barber') {
      return res.status(400).json({ success: false, error: 'Bu randevu final onay adımında değil' });
    }

    const previousStatus = String(slot.rescheduleApproval?.previousStatus || 'booked').toLowerCase();
    const fallbackStatus = previousStatus === 'confirmed' ? 'confirmed' : 'booked';
    const approval = slot.rescheduleApproval || {};

    if (String(decision).toLowerCase() === 'approve') {
      const proposedDate = approval.proposedDate || slot.date;
      const proposedTime = approval.proposedTime || slot.time;
      if (isPastDateTime(proposedDate, proposedTime)) {
        return res.status(400).json({ success: false, error: 'Geçmiş saat için son onay verilemez' });
      }

      slot.date = approval.proposedDate || slot.date;
      slot.time = approval.proposedTime || slot.time;
      slot.status = fallbackStatus;
      slot.rescheduleApproval = {
        ...approval,
        phase: 'completed',
        barberDecision: 'approved',
        barberRespondedAt: new Date(),
      };
    } else {
      slot.status = fallbackStatus;
      slot.rescheduleApproval = {
        ...approval,
        phase: 'rejected_by_barber',
        barberDecision: 'rejected',
        barberRespondedAt: new Date(),
      };
    }

    await slot.save();

    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.slotId': String(slot._id) },
        {
          $set: {
            'appointments.$.date': slot.date,
            'appointments.$.time': slot.time,
            'appointments.$.status': toCustomerStatus(slot.status),
            'appointments.$.rescheduleApproval': {
              ...(slot.rescheduleApproval || {}),
            },
          }
        }
      );
    }

    const io = req.app.get('io');
    const connectedCustomers = req.app.get('connectedCustomers');
    const customerId = slot.customer?.customerId ? String(slot.customer.customerId) : null;
    const socketId = customerId && connectedCustomers ? connectedCustomers.get(customerId) : null;

    if (socketId && io) {
      io.to(socketId).emit('appointment_update', {
        slotId: String(slot._id),
        status: toCustomerStatus(slot.status),
        date: slot.date,
        time: slot.time,
        message: String(decision).toLowerCase() === 'approve'
          ? 'Saat değişikliği berber tarafından son onaylandı.'
          : 'Saat değişikliği berber tarafından reddedildi, önceki saat korunuyor.',
        rescheduleApproval: slot.rescheduleApproval || null,
      });
    }

    return res.json({
      success: true,
      message: String(decision).toLowerCase() === 'approve'
        ? 'Saat değişikliği son onaylandı'
        : 'Saat değişikliği reddedildi, önceki saat korundu',
      slot,
    });
  } catch (error) {
    console.error('❌ Reschedule finalize hatası:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Berberin tüm slotlarını getir (Berber için)
router.get('/my-slots', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    
    let query = { barber: req.barberId };
    
    if (date) {
      query.date = date;
      console.log(`📅 Tek tarih sorgusu - BarberId: ${req.barberId}, tarih: ${date}`);
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
      console.log(`📅 Aralık sorgusu - BarberId: ${req.barberId}, ${startDate} - ${endDate}`);
    }

    const slots = await Slot.find(query).sort({ date: 1, time: 1 });
    console.log(`✅ Bulunan slot sayısı: ${slots.length}`);
    
    if (slots.length > 0) {
      console.log(`   İlk slot: ${slots[0].date} ${slots[0].time}, Son slot: ${slots[slots.length-1].date} ${slots[slots.length-1].time}`);
    }
    
    // Barber bilgisini al (service bilgileri için)
    const barber = await Barber.findById(req.barberId);
    
    const enrichedSlots = slots.map(slot => {
      let serviceInfo = null;
      
      // Eğer slot.service varsa (manuel oluşturulan randevular için)
      if (slot.service) {
        const service = barber.services.id(slot.service);
        if (service) {
          serviceInfo = {
            _id: service._id,
            name: service.name,
            price: service.price,
            duration: service.duration
          };
        }
      }
      
      return {
        _id: slot._id, 
        date: slot.date, 
        time: slot.time, 
        status: slot.status, 
        isHistoricalRecord: Boolean(slot.isHistoricalRecord),
        rescheduleApproval: slot.rescheduleApproval || null,
        customerName: slot.customer?.name || null, 
        customerPhone: slot.customer?.phone || null,
        customer: slot.customer || null,
        service: serviceInfo || (slot.customer?.service ? { name: slot.customer.service } : null),
        manualPrice: slot.manualPrice,
        payment: slot.payment,
        cancelReason: slot.cancelReason,
        isManualAppointment: slot.isManualAppointment || false
      };
    }); 
  
  res.json({ 
    success: true, 
    count: enrichedSlots.length, 
    data: enrichedSlots 
  });

  } catch (error) {
    console.error('❌ /my-slots hatası:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Slot oluştur (Berber - manuel müşteri için)
router.post('/', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { date, time, customer } = req.body;

    if (isPastDateTime(date, time)) {
      return res.status(400).json({ success: false, error: 'Geçmiş saat için slot oluşturulamaz' });
    }
    
    // Çakışma kontrolü
    const existing = await Slot.findOne({
      barber: req.barberId,
      date,
      time
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Bu saat dolu' });
    }

    const slot = new Slot({
      barber: req.barberId,
      date,
      time,
      status: customer ? 'booked' : 'available',
      customer: customer || undefined
    });

    await slot.save();
    // Eğer müşteri kayıtlıysa Customer.appointments dizisine ekle
    if (req.body.customerId) {
      const Customer = require('../models/Customer');
      try {
        const updateRes = await Customer.findByIdAndUpdate(req.body.customerId, {
          $push: {
            appointments: buildCustomerAppointment(slot, {
              serviceName: req.body.service || (slot.customer && slot.customer.service) || 'Belirtilmemiş'
            })
          }
        });
        console.log('Customer appointment push result for', req.body.customerId, updateRes ? 'ok' : 'not-found');
      } catch (e) {
        console.warn('Customer appointment push failed:', e.message);
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Slot oluşturuldu',
      data: slot
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Özel slot oluştur (berber ayarlarına göre)
router.post('/generate-custom', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { date, start, end, slotDuration } = req.body;
    const moment = require('moment');
    
    const slots = [];
    let currentTime = moment(start, 'HH:mm');
    const endTime = moment(end, 'HH:mm');
    
    while (currentTime < endTime) {
      const timeStr = currentTime.format('HH:mm');
      
      const existing = await Slot.findOne({
        barber: req.barberId,
        date: date,
        time: timeStr
      });
      
      if (!existing) {
        slots.push({
          barber: req.barberId,
          date: date,
          time: timeStr,
          status: 'available'
        });
      }
      
      currentTime.add(slotDuration, 'minutes');
    }
    
    if (slots.length > 0) {
      await Slot.insertMany(slots);
    }
    
    res.json({
      success: true,
      message: `${slots.length} slot oluşturuldu`,
      count: slots.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu slot oluştur (Berber - çalışma saatlerine göre)
router.post('/generate', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body; // "2026-02-22", "2026-02-28"
    
    const barber = await Barber.findById(req.barberId);
    const slots = [];
    
    // Tarih aralığındaki her gün için
    let current = moment(startDate);
    const end = moment(endDate);
    
    while (current <= end) {
      const dayName = current.format('dddd').toLowerCase(); // monday, tuesday...
      const dayConfig = barber.workingHours[dayName];
      
      if (dayConfig && dayConfig.isOpen) {
        // Slot süresi (30dk veya 60dk)
        const slotDuration = 30; // dakika
        
        let currentTime = moment(dayConfig.open, 'HH:mm');
        const endTime = moment(dayConfig.close, 'HH:mm');
        
        while (currentTime < endTime) {
          const timeStr = currentTime.format('HH:mm');
          
          // Varsa oluşturma
          const existing = await Slot.findOne({
            barber: req.barberId,
            date: current.format('YYYY-MM-DD'),
            time: timeStr
          });
          
          if (!existing) {
            slots.push({
              barber: req.barberId,
              date: current.format('YYYY-MM-DD'),
              time: timeStr,
              status: 'available'
            });
          }
          
          currentTime.add(slotDuration, 'minutes');
        }
      }
      
      current.add(1, 'day');
    }
    
    if (slots.length > 0) {
      await Slot.insertMany(slots);
    }
    
    res.json({
      success: true,
      message: `${slots.length} slot oluşturuldu`,
      count: slots.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Slot durumunu değiştir (toggle)
router.patch('/:slotId/status', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { status } = req.body;
    const slot = await Slot.findOne({
      _id: req.params.slotId,
      barber: req.barberId
    });

    if (!slot) {
      return res.status(404).json({ success: false, error: 'Slot bulunamadı' });
    }

    // Sistemden dolu (booked) ise değiştirme
    if (slot.status === 'booked') {
      return res.status(400).json({ success: false, error: 'Sistem randevusu değiştirilemez' });
    }

    slot.status = status;
    await slot.save();
    
    res.json({ success: true, data: slot });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Müşteri slot rezervasyonu (auth'suz, herkes kullanabilir)
router.patch('/:slotId/book', async (req, res) => {
  try {
    const { customerPhone, customerName, service, customerId, price } = req.body;
    console.log('booking request body:', req.body);
    
    const slot = await Slot.findOne({
      _id: req.params.slotId,
      status: 'available'
    }).populate('barber');

    if (!slot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Slot bulunamadı veya dolu' 
      });
    }

    if (isPastDateTime(slot.date, slot.time)) {
      return res.status(400).json({
        success: false,
        error: 'Geçmiş saat için randevu oluşturulamaz'
      });
    }

    // Berber takvimli randevu alıyor mu kontrol et
    if (!slot.barber.features.calendarBooking) {
      return res.status(403).json({ 
        success: false, 
        error: 'Bu berber takvim randevusu almıyor' 
      });
    }

    slot.status = 'booked';
    slot.customer = {
      customerId: req.body.customerId || null,
      phone: customerPhone,
      name: customerName || 'İsimsiz',
      service: service || 'Belirtilmemiş',
      isHomeService: false
    };
    slot.payment = {
      isPaid: Number(price) > 0,
      amount: Number(price) || 0
    };

    await slot.save();
    let pushSuccess = null;
    try {
      pushSuccess = await pushAppointmentToCustomer({
        customerId: req.body.customerId,
        customerPhone: req.body.customerPhone,
        appointment: buildCustomerAppointment(slot, {
          serviceName: req.body.service || (slot.customer && slot.customer.service) || 'Belirtilmemiş'
        })
      });
      console.log('Customer appointment push result for', req.body.customerId || req.body.customerPhone, pushSuccess ? 'ok' : 'not-found');
    } catch (e) {
      pushSuccess = false;
      console.warn('Customer appointment push failed:', e.message);
    }
    
    res.json({
      success: true,
      message: 'Randevu oluşturuldu',
      customerPush: pushSuccess,
      data: {
        slotId: slot._id,
        time: slot.time,
        date: slot.date,
        barber: slot.barber.name
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Berber tarafından manuel olarak slot/randevu oluştur
router.post('/create-manual', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { date, time, customerName, customerPhone, serviceId, price, allowPastManual } = req.body;
    const isHistoricalRecord = Boolean(allowPastManual && isPastDateTime(date, time));

    // Validasyon
    if (!date || !time || !customerName || !serviceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tarih, saat, müşteri adı ve hizmet zorunludur' 
      });
    }

    if (isPastDateTime(date, time) && !allowPastManual) {
      return res.status(400).json({
        success: false,
        error: 'Geçmiş saat için randevu oluşturulamaz'
      });
    }

    // Barber ve service kontrolü
    const barber = await Barber.findById(req.barberId);
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }
    
    const service = barber.services.id(serviceId);
    if (!service) {
      return res.status(400).json({ success: false, error: 'Hizmet bulunamadı' });
    }

    // Var olan slot kontrol et
    let slot = await Slot.findOne({
      barber: req.barberId,
      date,
      time
    });

    if (slot) {
      // Slot varsa, onu güncelle (available/blocked ise)
      if (slot.status === 'booked' || slot.status === 'confirmed') {
        return res.status(400).json({ success: false, error: 'Bu saat zaten dolu' });
      }
      
      // Slot'u güncelle
      slot.status = 'confirmed';
      slot.customer = {
        name: customerName,
        service: service.name,
        phone: customerPhone ? String(customerPhone).trim() : null,
        notes: null
      };
      slot.service = serviceId;
      slot.manualPrice = price || null;
      slot.isManualAppointment = true;
      slot.isHistoricalRecord = isHistoricalRecord;
      await slot.save();
    } else {
      // Yeni slot oluştur
      slot = new Slot({
        barber: req.barberId,
        date,
        time,
        status: 'confirmed',
        customer: {
          name: customerName,
          service: service.name,
          phone: customerPhone ? String(customerPhone).trim() : null,
          notes: null
        },
        service: serviceId,
        manualPrice: price || null,
        isManualAppointment: true,
        isHistoricalRecord
      });
      await slot.save();
    }

    // Slot'u service bilgisiyle döndür
    const slotData = slot.toObject();
    slotData.service = {
      _id: service._id,
      name: service.name,
      price: service.price,
      duration: service.duration
    };

    res.status(201).json({
      success: true,
      message: 'Randevu oluşturuldu',
      data: slotData
    });

  } catch (error) {
    console.error('❌ Manual slot oluşturma hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:slotId/remind-barber', auth, async (req, res) => {
  try {
    const slot = await Slot.findOne({ _id: req.params.slotId }).populate('barber');

    if (!slot) {
      return res.status(404).json({ success: false, error: 'Slot bulunamadı' });
    }

    const customerId = req.customerId || req.body.customerId;
    const Customer = require('../models/Customer');
    const customer = await Customer.findOne({
      _id: customerId,
      'appointments.slotId': String(slot._id)
    });

    if (!customerId || !customer) {
      return res.status(403).json({ success: false, error: 'Bu randevu için bildirim gönderemezsiniz' });
    }

    const appointment = customer.appointments.find((item) => String(item.slotId) === String(slot._id));
    const reminderSentAt = appointment?.reminderSentAt ? new Date(appointment.reminderSentAt).getTime() : 0;
    const createdAt = appointment?.createdAt ? new Date(appointment.createdAt).getTime() : 0;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    if (!createdAt || createdAt > fiveMinutesAgo) {
      return res.status(400).json({ success: false, error: 'Randevu oluşturulduktan 5 dakika sonra bildirim gönderilebilir' });
    }

    if (reminderSentAt && reminderSentAt > createdAt) {
      return res.status(400).json({ success: false, error: 'Bu randevu için bildirim zaten gönderildi' });
    }

    const io = req.app.get('io');
    const connectedBarbers = req.app.get('connectedBarbers');
    const barberId = slot.barber?._id ? String(slot.barber._id) : String(slot.barber || '');
    const barberSocketId = connectedBarbers?.get(barberId);

    if (barberSocketId && io) {
      io.to(barberSocketId).emit('customer_reminder', {
        slotId: String(slot._id),
        barberId,
        barberName: slot.barber?.name || '',
        customerId: String(customerId),
        customerName: appointment?.customerName || req.body.customerName || 'Müşteri',
        date: slot.date,
        time: slot.time,
        message: 'Müşteri randevu için hatırlatma gönderdi.'
      });
    }

    await Customer.updateOne(
      { _id: customerId, 'appointments.slotId': String(slot._id) },
      { $set: { 'appointments.$.reminderSentAt': new Date() } }
    );

    return res.json({
      success: true,
      message: barberSocketId ? 'Hatırlatma gönderildi' : 'Berber çevrimdışı, hatırlatma kaydedildi',
      delivered: Boolean(barberSocketId)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manuel oluşturulan randevuyu düzenle
router.patch('/:slotId/edit', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { customerName, customerPhone, serviceId, price, date, time } = req.body;

    // Slot kontrolü
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    // Sadece manuel oluşturulan randevular düzenlenebilir
    if (!slot.isManualAppointment) {
      return res.status(403).json({ success: false, error: 'Sadece manuel oluşturduğunuz randevuları düzenleyebilirsiniz' });
    }

    if (slot.isHistoricalRecord) {
      return res.status(400).json({ success: false, error: 'Tarihi kayıtlar düzenlenemez, gerekirse yeni kayıt açınız' });
    }

    const targetDate = String(date || slot.date || '').trim();
    const targetTime = String(time || slot.time || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ success: false, error: 'Geçerli bir tarih giriniz (YYYY-MM-DD)' });
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(targetTime)) {
      return res.status(400).json({ success: false, error: 'Geçerli bir saat giriniz (HH:mm)' });
    }

    const clashSlot = await Slot.findOne({
      barber: req.barberId,
      date: targetDate,
      time: targetTime,
      _id: { $ne: slot._id }
    });

    if (clashSlot) {
      return res.status(400).json({ success: false, error: 'Bu tarih/saatte başka bir slot mevcut' });
    }

    // Barber ve service kontrolü
    const barber = await Barber.findById(req.barberId);
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }
    
    const service = barber.services.id(serviceId);
    if (!service) {
      return res.status(400).json({ success: false, error: 'Hizmet bulunamadı' });
    }

    // Slot bilgilerini güncelle
    slot.customer = slot.customer || {};
    slot.customer.name = customerName;
    slot.customer.phone = customerPhone ? String(customerPhone).trim() : '';
    slot.customer.service = service.name;
    slot.date = targetDate;
    slot.time = targetTime;
    slot.service = serviceId;
    slot.manualPrice = price || null;
    slot.updatedAt = new Date();
    await slot.save();

    // Güncellenmiş slot'u service bilgisiyle döndür
    const slotData = slot.toObject();
    slotData.service = {
      _id: service._id,
      name: service.name,
      price: service.price,
      duration: service.duration
    };

    res.json({
      success: true,
      message: 'Randevu güncellendi',
      slot: slotData
    });

  } catch (error) {
    console.error('❌ Randevu düzenleme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Randevu iptal et (berber tarafından)
router.patch('/:slotId/cancel', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const slot = await Slot.findById(req.params.slotId);

    if (!slot) {
      return res.status(404).json({ success: false, error: 'Slot bulunamadı' });
    }

    if (slot.barber.toString() !== req.barberId.toString()) {
      return res.status(403).json({ success: false, error: 'Yetkisiz erişim' });
    }

    if (slot.isHistoricalRecord) {
      return res.status(400).json({ success: false, error: 'Tarihi kayıtlar iptal akışına alınamaz' });
    }

    // Slot'u iptal et
    slot.status = 'cancelled';
    slot.cancelReason = reason || 'Berber iptal etti';
    await slot.save();

    // müşteri randevusuna da iptal nedenini yansıt
    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.date': slot.date, 'appointments.time': slot.time },
        {
          $set: {
            'appointments.$.status': 'cancelled',
            'appointments.$.cancelReason': slot.cancelReason,
          }
        }
      );
    }

    res.json({
      success: true,
      message: 'Randevu iptal edildi',
      data: slot
    });

  } catch (error) {
    console.error('❌ Randevu iptal hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;