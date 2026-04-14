const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const checkFeature = require('../middleware/checkFeature');
const Slot = require('../models/Slot');
const Barber = require('../models/Barber');
const moment = require('moment');

// Moment.js'i English locale'e ayarla
moment.locale('en');

function isMasterUser(req) {
  return String(req.user?.role || '').toLowerCase() === 'master' && Boolean(req.masterId);
}

function buildMasterScopedQuery(req, query = {}) {
  const scopedQuery = { ...(query || {}) };
  if (isMasterUser(req)) {
    const unassignedCondition = {
      $or: [
        { assignedMaster: { $exists: false } },
        { assignedMaster: null },
        { 'assignedMaster.masterId': { $in: ['', null] } },
      ],
    };

    scopedQuery.$or = [
      { 'assignedMaster.masterId': String(req.masterId) },
      {
        $and: [
          unassignedCondition,
          { status: { $in: ['available', 'blocked'] } },
        ],
      },
    ];
  }
  return scopedQuery;
}

function buildSameAssignedMasterFilter(masterInfo) {
  const masterId = String(masterInfo?.masterId || '').trim();
  if (masterId) {
    return { 'assignedMaster.masterId': masterId };
  }

  return {
    $or: [
      { assignedMaster: { $exists: false } },
      { assignedMaster: null },
      { 'assignedMaster.masterId': { $in: ['', null] } },
    ],
  };
}

function ensureMasterCanAccessSlot(req, slot) {
  if (!isMasterUser(req)) {
    return true;
  }
  return String(slot?.assignedMaster?.masterId || '') === String(req.masterId || '');
}

function toMasterDto(master) {
  if (!master) {
    return null;
  }
  return {
    masterId: String(master._id),
    name: master.name,
    username: master.username,
  };
}

function normalizePositivePrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveCatalogService(barber, { serviceId, serviceName }) {
  const services = Array.isArray(barber?.services) ? barber.services : [];
  const normalizedName = String(serviceName || '').trim().toLowerCase();

  if (serviceId) {
    let byId = null;
    if (typeof services.id === 'function') {
      try {
        byId = services.id(serviceId);
      } catch (_) {
        byId = null;
      }
    }
    if (!byId) {
      byId = services.find((item) => String(item?._id || '') === String(serviceId)) || null;
    }
    if (byId) {
      return byId;
    }
  }

  if (normalizedName) {
    return services.find((item) => String(item.name || '').trim().toLowerCase() === normalizedName) || null;
  }

  return null;
}

function resolveSlotPrice(serviceRecord, providedPrice) {
  return normalizePositivePrice(providedPrice) ?? normalizePositivePrice(serviceRecord?.price) ?? 0;
}

async function resolveAssignedMasterForRequest({ req, barber, requestedMasterId }) {
  if (isMasterUser(req)) {
    const selfMaster = (barber.masters || []).find((item) => String(item._id) === String(req.masterId));
    if (!selfMaster || selfMaster.isActive === false) {
      throw new Error('Usta hesabı aktif değil veya bulunamadı');
    }
    return toMasterDto(selfMaster);
  }

  if (!requestedMasterId) {
    return null;
  }

  const targetMaster = (barber.masters || []).find((item) => String(item._id) === String(requestedMasterId));
  if (!targetMaster) {
    throw new Error('Seçilen usta bulunamadı');
  }
  if (targetMaster.isActive === false) {
    throw new Error('Seçilen usta pasif durumda');
  }

  return toMasterDto(targetMaster);
}

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

function hasOneHourPassedSinceSlot(dateStr, timeStr) {
  const date = String(dateStr || '').trim();
  const time = String(timeStr || '').trim().slice(0, 5);
  if (!date || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
    return false;
  }

  const slotMoment = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm', true);
  if (!slotMoment.isValid()) {
    return false;
  }

  return moment().diff(slotMoment, 'minutes') >= 60;
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
  const resolvedPrice = Number(extra.servicePrice ?? slot?.payment?.amount ?? slot?.manualPrice ?? slot?.service?.price ?? slot?.customer?.totalPrice ?? 0) || 0;
  const resolvedDuration = Number(extra.serviceDuration ?? slot?.service?.duration ?? 30) || 30;
  const resolvedSalonName = String(extra.salonName || slot.barber?.salonName || '').trim();

  return {
    slotId: String(slot._id),
    barberId,
    barberName: slot.barber?.name || extra.barberName || '',
    barberSalonName: resolvedSalonName,
    barberCity: String(extra.barberCity || slot.barber?.city || '').trim(),
    barberDistrict: String(extra.barberDistrict || slot.barber?.district || '').trim(),
    date: slot.date,
    time: slot.time,
    service: {
      name: extra.serviceName || (slot.customer && slot.customer.service) || 'Belirtilmemiş',
      price: resolvedPrice,
      duration: resolvedDuration
    },
    status: extra.status || 'Randevu Alındı',
    assignedMaster: extra.assignedMaster || slot.assignedMaster || null,
    createdAt: extra.createdAt || new Date(),
    reminderSentAt: extra.reminderSentAt || null
  };
}

function toCustomerStatus(slotStatus) {
  const statusLc = String(slotStatus || '').toLowerCase();
  if (statusLc === 'confirmed') {
    return 'confirmed';
  }
  if (statusLc === 'completed') {
    return 'completed';
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
    const { barberId, date, masterId } = req.query;
    
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

    const baseQuery = {
      barber: barberId,
      date: date,
      status: 'available'
    };

    let slotsQuery = baseQuery;
    if (String(masterId || '').trim()) {
      slotsQuery = {
        ...baseQuery,
        $or: [
          { 'assignedMaster.masterId': String(masterId).trim() },
          { assignedMaster: { $exists: false } },
          { assignedMaster: null },
          { 'assignedMaster.masterId': { $in: ['', null] } },
        ],
      };
    }

    const slots = await Slot.find(slotsQuery).sort({ time: 1 });

    res.json({
      success: true,
      count: slots.length,
      data: slots
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// berber tarafından dolu/onaylı slotlar için onay/iptal/tamamlama işlemi
router.patch('/:slotId/action', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { action, reason } = req.body; // 'confirm', 'cancel' veya 'complete'
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) return res.status(404).json({ success: false, error: 'Slot bulunamadı' });

    if (!ensureMasterCanAccessSlot(req, slot)) {
      return res.status(403).json({ success: false, error: 'Bu randevu üzerinde yetkiniz yok' });
    }

    const slotStatus = String(slot.status || '').toLowerCase();

    if (action === 'cancel' || action === 'confirm') {
      if (slotStatus !== 'booked') {
        return res.status(400).json({ success: false, error: 'Sadece dolu slotlar üzerinde işlem yapılabilir' });
      }
    }

    if (action === 'cancel') {
      if (slot.isHistoricalRecord) {
        return res.status(400).json({ success: false, error: 'Tarihi kayıtlar iptal akışına alınamaz' });
      }
      slot.status = 'cancelled';
      slot.cancelReason = reason || '';
    } else if (action === 'confirm') {
      slot.status = 'confirmed';
      slot.cancelReason = '';
    } else if (action === 'complete') {
      if (slotStatus !== 'confirmed') {
        return res.status(400).json({ success: false, error: 'Sadece onaylı randevular tamamlanabilir' });
      }
      if (!hasOneHourPassedSinceSlot(slot.date, slot.time)) {
        return res.status(400).json({ success: false, error: 'Tamamlama işlemi için randevu saatinin üzerinden en az 1 saat geçmeli' });
      }
      slot.status = 'completed';
      slot.cancelReason = '';
    } else {
      return res.status(400).json({ success: false, error: 'Geçersiz işlem' });
    }
    await slot.save();
    // müşteri randevusunu güncelle
    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      const nextCustomerStatus = action === 'cancel'
        ? 'cancelled'
        : action === 'complete'
          ? 'completed'
          : 'confirmed';

      const updatePayload = {
        $set: {
          'appointments.$.status': nextCustomerStatus,
          'appointments.$.cancelReason': action === 'cancel'
            ? (reason || 'Berber iptal etti')
            : '',
        }
      };

      const updateBySlotId = await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.slotId': String(slot._id) },
        updatePayload
      );

      if (!updateBySlotId?.matchedCount) {
        await Customer.updateOne(
          { _id: slot.customer.customerId, 'appointments.date': slot.date, 'appointments.time': slot.time },
          updatePayload
        );
      }
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

    if (!ensureMasterCanAccessSlot(req, slot)) {
      return res.status(403).json({ success: false, error: 'Bu randevu üzerinde yetkiniz yok' });
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
      _id: { $ne: slot._id },
      ...buildSameAssignedMasterFilter(slot.assignedMaster),
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
        if (!ensureMasterCanAccessSlot(req, slot)) {
          return res.status(403).json({ success: false, error: 'Bu randevu üzerinde yetkiniz yok' });
        }

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

    // Geriye dönük düzeltme: Eski akışta isHidden=true olarak kalan manuel randevular
    // listede görünmüyordu. Bunları bir kez müsait slota çevirip görünür hale getir.
    await Slot.updateMany(
      {
        barber: req.barberId,
        isHidden: true,
        isManualAppointment: true,
      },
      {
        $set: {
          status: 'available',
          customer: null,
          service: null,
          manualPrice: null,
          payment: { isPaid: false, amount: 0 },
          cancelReason: '',
          isManualAppointment: false,
          isHistoricalRecord: false,
          isHidden: false,
          hiddenAt: null,
          hiddenBy: null,
          hiddenSnapshot: null,
          rescheduleApproval: {
            phase: 'idle',
            previousStatus: '',
            oldDate: '',
            oldTime: '',
            proposedDate: '',
            proposedTime: '',
            customerDecision: 'pending',
            barberDecision: 'pending',
            requestedBy: 'barber',
            requestedAt: null,
            customerRespondedAt: null,
            barberRespondedAt: null,
          }
        }
      }
    );
    
    let query = buildMasterScopedQuery(req, { barber: req.barberId, isHidden: { $ne: true } });
    
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
    
    const barber = await Barber.findById(req.barberId);

    let slotsForResponse = slots;
    if (isMasterUser(req)) {
      const ownOccupiedKeys = new Set(
        slots
          .filter((slot) => {
            const statusLc = String(slot.status || '').toLowerCase();
            const hasCustomer = Boolean(slot.customer?.name || slot.customerName);
            const isOwnAssigned = String(slot?.assignedMaster?.masterId || '') === String(req.masterId || '');
            return isOwnAssigned && hasCustomer && !['available', 'blocked'].includes(statusLc);
          })
          .map((slot) => `${slot.date}|${slot.time}`)
      );

      if (ownOccupiedKeys.size > 0) {
        slotsForResponse = slots.filter((slot) => {
          const statusLc = String(slot.status || '').toLowerCase();
          const isUnassigned = !slot.assignedMaster || !String(slot.assignedMaster.masterId || '').trim();
          const isGeneralAvailability = isUnassigned && ['available', 'blocked'].includes(statusLc);
          if (!isGeneralAvailability) {
            return true;
          }

          return !ownOccupiedKeys.has(`${slot.date}|${slot.time}`);
        });
      }

      if (date) {
        const selectedMoment = moment(date, 'YYYY-MM-DD', true);
        if (selectedMoment.isValid()) {
          const dayName = selectedMoment.format('dddd').toLowerCase();
          const dayConfig = barber?.workingHours?.[dayName];
          const isOpen = dayConfig && (dayConfig.isOpen === true || String(dayConfig.isOpen).toLowerCase() === 'true');

          if (isOpen) {
            const openTime = moment(String(dayConfig.open || ''), 'HH:mm', true);
            const closeTime = moment(String(dayConfig.close || ''), 'HH:mm', true);

            if (openTime.isValid() && closeTime.isValid() && openTime.isBefore(closeTime)) {
              const existingTimeSet = new Set(
                slotsForResponse
                  .filter((slot) => String(slot.date || '') === String(date))
                  .map((slot) => String(slot.time || '').slice(0, 5))
              );

              let cursor = openTime.clone();
              while (cursor.isBefore(closeTime)) {
                const timeStr = cursor.format('HH:mm');
                if (!existingTimeSet.has(timeStr)) {
                  slotsForResponse.push({
                    _id: `virtual-${date}-${timeStr}-${req.masterId}`,
                    barber: req.barberId,
                    date: String(date),
                    time: timeStr,
                    status: 'available',
                    customer: null,
                    service: null,
                    manualPrice: null,
                    payment: { isPaid: false, amount: 0 },
                    assignedMaster: { masterId: String(req.masterId) },
                    isManualAppointment: false,
                    isHistoricalRecord: false,
                    isVirtualSlot: true,
                  });
                  existingTimeSet.add(timeStr);
                }
                cursor.add(30, 'minutes');
              }

              slotsForResponse = slotsForResponse.sort((a, b) => {
                const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
                if (dateCompare !== 0) {
                  return dateCompare;
                }
                return String(a.time || '').localeCompare(String(b.time || ''));
              });
            }
          }
        }
      }

    }

    // Barber bilgisini al (service bilgileri için)
    const barberServices = Array.isArray(barber?.services) ? barber.services : [];
    
    const enrichedSlots = slotsForResponse.map(slot => {
      let serviceInfo = null;
      const fallbackServicePrice = Number(slot?.payment?.amount || slot?.customer?.totalPrice || slot?.manualPrice || 0) || 0;
      
      // Eğer slot.service varsa (manuel oluşturulan randevular için)
      if (slot.service && barberServices.length > 0) {
        let service = null;
        if (typeof barberServices.id === 'function') {
          try {
            service = barberServices.id(slot.service);
          } catch (_) {
            service = null;
          }
        }
        if (!service) {
          service = barberServices.find((item) => String(item?._id || '') === String(slot.service)) || null;
        }
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
        manualPrice: slot.manualPrice !== null && typeof slot.manualPrice !== 'undefined'
          ? slot.manualPrice
          : (serviceInfo?.price ?? fallbackServicePrice),
        payment: {
          ...(slot.payment || {}),
          amount: Number(slot.payment?.amount || 0) || (serviceInfo?.price ?? fallbackServicePrice),
        },
        assignedMaster: slot.assignedMaster || null,
        isVirtualSlot: Boolean(slot.isVirtualSlot),
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

    const barber = await Barber.findById(req.barberId);
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }

    const assignedMaster = await resolveAssignedMasterForRequest({
      req,
      barber,
      requestedMasterId: req.body?.assignedMasterId,
    });

    if (isPastDateTime(date, time)) {
      return res.status(400).json({ success: false, error: 'Geçmiş saat için slot oluşturulamaz' });
    }
    
    // Çakışma kontrolü
    const existing = await Slot.findOne({
      barber: req.barberId,
      date,
      time,
      ...buildSameAssignedMasterFilter(assignedMaster),
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Bu saat dolu' });
    }

    const slot = new Slot({
      barber: req.barberId,
      date,
      time,
      status: customer ? 'booked' : 'available',
      customer: customer || undefined,
      assignedMaster: assignedMaster || undefined,
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

    const barber = await Barber.findById(req.barberId).select('masters');
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }

    const assignedMaster = await resolveAssignedMasterForRequest({
      req,
      barber,
      requestedMasterId: req.body?.assignedMasterId,
    });
    
    const slots = [];
    let currentTime = moment(start, 'HH:mm');
    const endTime = moment(end, 'HH:mm');
    
    while (currentTime < endTime) {
      const timeStr = currentTime.format('HH:mm');
      
      const existing = await Slot.findOne({
        barber: req.barberId,
        date: date,
        time: timeStr,
        ...buildSameAssignedMasterFilter(assignedMaster),
      });
      
      if (!existing) {
        slots.push({
          barber: req.barberId,
          date: date,
          time: timeStr,
          status: 'available',
          assignedMaster: assignedMaster || undefined,
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
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }

    const assignedMaster = await resolveAssignedMasterForRequest({
      req,
      barber,
      requestedMasterId: req.body?.assignedMasterId,
    });
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
            time: timeStr,
            ...buildSameAssignedMasterFilter(assignedMaster),
          });
          
          if (!existing) {
            slots.push({
              barber: req.barberId,
              date: current.format('YYYY-MM-DD'),
              time: timeStr,
              status: 'available',
              assignedMaster: assignedMaster || undefined,
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

    if (!ensureMasterCanAccessSlot(req, slot)) {
      return res.status(403).json({ success: false, error: 'Bu slot üzerinde yetkiniz yok' });
    }

    // Sistemden dolu (booked) ise değiştirme
    if (slot.status === 'booked') {
      return res.status(400).json({ success: false, error: 'Sistem randevusu değiştirilemez' });
    }

    slot.status = status;
    await slot.save();

    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      const nextCustomerStatus = toCustomerStatus(slot.status);
      const updateRes = await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.slotId': String(slot._id) },
        {
          $set: {
            'appointments.$.status': nextCustomerStatus,
          }
        }
      );

      if (!updateRes?.matchedCount) {
        await Customer.updateOne(
          { _id: slot.customer.customerId, 'appointments.date': slot.date, 'appointments.time': slot.time },
          {
            $set: {
              'appointments.$.status': nextCustomerStatus,
            }
          }
        );
      }
    }
    
    res.json({ success: true, data: slot });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manuel oluşturulan randevuyu gizle
router.delete('/:slotId', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });

    if (!slot) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (!ensureMasterCanAccessSlot(req, slot)) {
      return res.status(403).json({ success: false, error: 'Bu randevu üzerinde yetkiniz yok' });
    }

    if (!slot.isManualAppointment) {
      return res.status(403).json({ success: false, error: 'Sadece manuel oluşturduğunuz randevuları gizleyebilirsiniz' });
    }

    if (isPastDateTime(slot.date, slot.time) && !slot.isHistoricalRecord) {
      return res.status(400).json({ success: false, error: 'Geçmiş randevular gizlenemez' });
    }

    const slotSnapshot = slot.toObject({ depopulate: true });

    // Slotu listeden kaldırmak yerine müsait hale çevir; böylece saat aralığı kaybolmaz.
    slot.hiddenSnapshot = {
      status: slotSnapshot.status,
      customer: slotSnapshot.customer ? { ...slotSnapshot.customer } : null,
      assignedMaster: slotSnapshot.assignedMaster ? { ...slotSnapshot.assignedMaster } : null,
      service: slotSnapshot.service || null,
      manualPrice: slotSnapshot.manualPrice ?? null,
      payment: slotSnapshot.payment ? { ...slotSnapshot.payment } : { isPaid: false, amount: 0 },
      cancelReason: slotSnapshot.cancelReason || '',
      isManualAppointment: Boolean(slotSnapshot.isManualAppointment),
      isHistoricalRecord: Boolean(slotSnapshot.isHistoricalRecord),
      rescheduleApproval: slotSnapshot.rescheduleApproval ? { ...slotSnapshot.rescheduleApproval } : null,
    };

    slot.status = 'available';
    slot.customer = undefined;
    slot.service = undefined;
    slot.manualPrice = null;
    slot.payment = { isPaid: false, amount: 0 };
    slot.cancelReason = '';
    slot.isManualAppointment = false;
    slot.isHistoricalRecord = false;
    slot.rescheduleApproval = {
      phase: 'idle',
      previousStatus: '',
      oldDate: '',
      oldTime: '',
      proposedDate: '',
      proposedTime: '',
      customerDecision: 'pending',
      barberDecision: 'pending',
      requestedBy: 'barber',
      requestedAt: null,
      customerRespondedAt: null,
      barberRespondedAt: null,
    };

    slot.isHidden = false;
    slot.hiddenAt = new Date();
    slot.hiddenBy = req.barberId;
    await slot.save();

    return res.json({
      success: true,
      message: 'Randevu gizlendi',
      slot,
    });
  } catch (error) {
    console.error('❌ Slot gizleme hatası:', error.message, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Gizlenen manuel randevuyu geri getir
router.patch('/:slotId/restore', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });

    if (!slot) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (!ensureMasterCanAccessSlot(req, slot)) {
      return res.status(403).json({ success: false, error: 'Bu randevu üzerinde yetkiniz yok' });
    }

    if (!slot.hiddenSnapshot) {
      return res.status(400).json({ success: false, error: 'Bu slot için geri alınacak bir silme kaydı yok' });
    }

    const snapshot = slot.hiddenSnapshot;
    const restoredCustomer = snapshot.customer && typeof snapshot.customer === 'object'
      ? { ...snapshot.customer }
      : null;

    slot.customer = restoredCustomer || undefined;
    slot.status = snapshot.status || (restoredCustomer ? 'booked' : 'available');
    slot.service = snapshot.service || undefined;
    slot.assignedMaster = snapshot.assignedMaster || undefined;
    slot.manualPrice = typeof snapshot.manualPrice === 'number' ? snapshot.manualPrice : null;
    slot.payment = snapshot.payment || { isPaid: false, amount: 0 };
    slot.cancelReason = snapshot.cancelReason || '';
    slot.isManualAppointment = Boolean(snapshot.isManualAppointment);
    slot.isHistoricalRecord = Boolean(snapshot.isHistoricalRecord);
    slot.rescheduleApproval = snapshot.rescheduleApproval || {
      phase: 'idle',
      previousStatus: '',
      oldDate: '',
      oldTime: '',
      proposedDate: '',
      proposedTime: '',
      customerDecision: 'pending',
      barberDecision: 'pending',
      requestedBy: 'barber',
      requestedAt: null,
      customerRespondedAt: null,
      barberRespondedAt: null,
    };

    slot.isHidden = false;
    slot.hiddenAt = null;
    slot.hiddenBy = null;
    slot.hiddenSnapshot = undefined;
    await slot.save();

    return res.json({
      success: true,
      message: 'Randevu geri alındı',
      slot,
    });
  } catch (error) {
    console.error('❌ Slot geri alma hatası:', error.message, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Slota usta atama / degistirme
router.patch('/:slotId/assign-master', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    if (!isMasterUser(req)) {
      return res.status(403).json({ success: false, error: 'Bu işlem yalnızca usta hesabından yapılabilir' });
    }

    const { masterId } = req.body || {};
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Slot bulunamadı' });
    }

    const barber = await Barber.findById(req.barberId).select('masters');
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }

    if (!masterId) {
      slot.assignedMaster = undefined;
    } else {
      const targetMaster = (barber.masters || []).find((item) => String(item._id) === String(masterId));
      if (!targetMaster) {
        return res.status(400).json({ success: false, error: 'Seçilen usta bulunamadı' });
      }
      if (targetMaster.isActive === false) {
        return res.status(400).json({ success: false, error: 'Pasif usta atanamaz' });
      }

      slot.assignedMaster = toMasterDto(targetMaster);
    }

    await slot.save();
    return res.json({ success: true, slot });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
// Müşteri slot rezervasyonu (auth'suz, herkes kullanabilir)
router.patch('/:slotId/book', async (req, res) => {
  try {
    const { customerPhone, customerName, service, serviceId, customerId, price, assignedMasterId } = req.body;
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

    if (assignedMasterId) {
      const targetMaster = (slot.barber.masters || []).find((item) => String(item._id) === String(assignedMasterId));
      if (!targetMaster) {
        return res.status(400).json({ success: false, error: 'Seçilen usta bulunamadı' });
      }
      if (targetMaster.isActive === false) {
        return res.status(400).json({ success: false, error: 'Seçilen usta pasif durumda' });
      }
      slot.assignedMaster = toMasterDto(targetMaster);
    } else {
      slot.assignedMaster = undefined;
    }

    const serviceRecord = resolveCatalogService(slot.barber, { serviceId, serviceName: service });
    const normalizedPrice = resolveSlotPrice(serviceRecord, price);
    const resolvedServiceName = String(serviceRecord?.name || service || 'Belirtilmemiş').trim() || 'Belirtilmemiş';

    slot.status = 'booked';
    slot.customer = {
      customerId: req.body.customerId || null,
      phone: customerPhone,
      name: customerName || 'İsimsiz',
      service: resolvedServiceName,
      isHomeService: false
    };
    if (normalizedPrice > 0) {
      slot.customer.totalPrice = normalizedPrice;
    }
    if (serviceRecord?._id) {
      slot.service = serviceRecord._id;
    }
    slot.payment = {
      isPaid: normalizedPrice > 0,
      amount: normalizedPrice
    };

    await slot.save();
    let pushSuccess = null;
    try {
      pushSuccess = await pushAppointmentToCustomer({
        customerId: req.body.customerId,
        customerPhone: req.body.customerPhone,
        appointment: buildCustomerAppointment(slot, {
          serviceName: resolvedServiceName,
          servicePrice: normalizedPrice,
          serviceDuration: Number(serviceRecord?.duration || 30) || 30,
          salonName: slot.barber?.salonName,
          barberCity: slot.barber?.city,
          barberDistrict: slot.barber?.district,
          assignedMaster: slot.assignedMaster || null,
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
    const normalizedDate = String(date || '').trim();
    const normalizedTime = String(time || '').trim().slice(0, 5);
    const isHistoricalRecord = Boolean(allowPastManual && isPastDateTime(normalizedDate, normalizedTime));

    // Validasyon
    if (!normalizedDate || !normalizedTime || !customerName || !serviceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tarih, saat, müşteri adı ve hizmet zorunludur' 
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return res.status(400).json({
        success: false,
        error: 'Geçerli bir tarih giriniz (YYYY-MM-DD)'
      });
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalizedTime)) {
      return res.status(400).json({
        success: false,
        error: 'Geçerli bir saat giriniz (HH:mm)'
      });
    }

    if (isPastDateTime(normalizedDate, normalizedTime) && !allowPastManual) {
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

    const assignedMaster = await resolveAssignedMasterForRequest({
      req,
      barber,
      requestedMasterId: req.body?.assignedMasterId,
    });
    
    const service = barber.services.id(serviceId);
    if (!service) {
      return res.status(400).json({ success: false, error: 'Hizmet bulunamadı' });
    }

    const normalizedPrice = resolveSlotPrice(service, price);

    // Var olan slot kontrol et
    let slot = await Slot.findOne({
      barber: req.barberId,
      date: normalizedDate,
      time: normalizedTime,
      ...buildSameAssignedMasterFilter(assignedMaster),
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
      slot.manualPrice = normalizedPrice;
      slot.payment = {
        isPaid: true,
        amount: normalizedPrice
      };
      slot.isManualAppointment = true;
      slot.isHistoricalRecord = isHistoricalRecord;
      slot.assignedMaster = assignedMaster || undefined;
      await slot.save();
    } else {
      // Yeni slot oluştur
      slot = new Slot({
        barber: req.barberId,
        date: normalizedDate,
        time: normalizedTime,
        status: 'confirmed',
        customer: {
          name: customerName,
          service: service.name,
          phone: customerPhone ? String(customerPhone).trim() : null,
          notes: null
        },
        service: serviceId,
        manualPrice: normalizedPrice,
        payment: {
          isPaid: true,
          amount: normalizedPrice
        },
        assignedMaster: assignedMaster || undefined,
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
    slotData.manualPrice = normalizedPrice;
    slotData.payment = {
      isPaid: true,
      amount: normalizedPrice
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

// Randevuyu düzenle (manuel veya onay/beklemede olan dolu randevu)
router.patch('/:slotId/edit', auth, checkFeature('calendarBooking'), async (req, res) => {
  try {
    const { customerName, customerPhone, serviceId, price, date, time } = req.body;

    // Slot kontrolü
    const slot = await Slot.findOne({ _id: req.params.slotId, barber: req.barberId });
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (!ensureMasterCanAccessSlot(req, slot)) {
      return res.status(403).json({ success: false, error: 'Bu randevu üzerinde yetkiniz yok' });
    }

    const slotStatus = String(slot.status || '').toLowerCase();
    const editableStatuses = new Set(['booked', 'confirmed', 'reschedule_pending_customer', 'reschedule_pending_barber']);

    if (!slot.isManualAppointment && !editableStatuses.has(slotStatus)) {
      return res.status(403).json({ success: false, error: 'Bu randevu durumu düzenlemeye uygun değil' });
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
      _id: { $ne: slot._id },
      ...buildSameAssignedMasterFilter(slot.assignedMaster),
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

    const normalizedPrice = resolveSlotPrice(service, price);

    const oldDate = slot.date;
    const oldTime = slot.time;

    // Slot bilgilerini güncelle
    slot.customer = slot.customer || {};
    slot.customer.name = customerName;
    slot.customer.phone = customerPhone ? String(customerPhone).trim() : '';
    slot.customer.service = service.name;
    slot.date = targetDate;
    slot.time = targetTime;
    slot.service = serviceId;
    slot.manualPrice = normalizedPrice;
    slot.payment = {
      ...(slot.payment || {}),
      isPaid: true,
      amount: normalizedPrice
    };
    slot.updatedAt = new Date();
    await slot.save();

    if (slot.customer?.customerId) {
      const Customer = require('../models/Customer');
      const updatePayload = {
        $set: {
          'appointments.$.date': targetDate,
          'appointments.$.time': targetTime,
          'appointments.$.status': toCustomerStatus(slot.status),
          'appointments.$.service': {
            name: service.name,
            price: normalizedPrice,
            duration: Number(service.duration || 30) || 30,
          },
          'appointments.$.updatedAt': new Date(),
        }
      };

      const updateBySlotId = await Customer.updateOne(
        { _id: slot.customer.customerId, 'appointments.slotId': String(slot._id) },
        updatePayload
      );

      if (!updateBySlotId?.matchedCount) {
        await Customer.updateOne(
          { _id: slot.customer.customerId, 'appointments.date': oldDate, 'appointments.time': oldTime },
          updatePayload
        );
      }
    }

    // Güncellenmiş slot'u service bilgisiyle döndür
    const slotData = slot.toObject();
    slotData.service = {
      _id: service._id,
      name: service.name,
      price: service.price,
      duration: service.duration
    };
    slotData.manualPrice = normalizedPrice;
    slotData.payment = {
      ...(slotData.payment || {}),
      isPaid: true,
      amount: normalizedPrice
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