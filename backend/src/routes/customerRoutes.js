const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Slot = require('../models/Slot');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/authMiddleware');

function sanitizeCustomerForClient(customerDoc) {
  if (!customerDoc) {
    return null;
  }
  const raw = customerDoc.toObject ? customerDoc.toObject() : { ...(customerDoc || {}) };
  delete raw.password;
  return raw;
}

async function verifyAndUpgradeCustomerPassword(customer, incomingPassword) {
  const rawIncoming = String(incomingPassword || '');
  const stored = String(customer?.password || '');
  if (!rawIncoming || !stored) {
    return false;
  }

  // Legacy kayıtlarda şifre düz metin tutulmuş olabilir.
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(rawIncoming, stored);
  }

  if (stored !== rawIncoming) {
    return false;
  }

  customer.password = await bcrypt.hash(rawIncoming, 10);
  await customer.save();
  return true;
}

function isPastDateTime(dateStr, timeStr) {
  const date = String(dateStr || '').trim();
  const time = String(timeStr || '').trim().slice(0, 5);
  if (!date || !time) {
    return false;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayIso = `${year}-${month}-${day}`;
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (date < todayIso) {
    return true;
  }
  if (date > todayIso) {
    return false;
  }

  return time <= nowTime;
}

function ensureCustomerAccess(req, res) {
  if (req.user?.role !== 'customer' || req.customerId?.toString() !== req.params.id) {
    res.status(403).json({ message: 'Bu işlem için yetkiniz yok' });
    return false;
  }
  return true;
}

function normalizeCustomerStatusFromSlot(slotStatus) {
  const statusLc = String(slotStatus || '').toLowerCase();
  if (statusLc === 'confirmed') {
    return 'confirmed';
  }
  if (statusLc === 'cancelled') {
    return 'cancelled';
  }
  return 'Randevu Alındı';
}

// Kayıt
router.post('/register', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Telefon ve şifre zorunludur' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Şifre en az 6 karakter olmalıdır' });
    }

    // Aynı telefonla kayıtlı müşteri var mı kontrol et
    const existingCustomer = await Customer.findOne({ phone });
    if (existingCustomer) {
      return res.status(400).json({ success: false, message: 'Bu telefon numarası zaten kayıtlı' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const customer = new Customer({ phone, password: hashedPassword });
    await customer.save();
    
    const token = jwt.sign({ customerId: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, message: 'Kayıt başarılı', token, customer: sanitizeCustomerForClient(customer) });
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

    const customer = await Customer.findOne({ phone });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Müşteri bulunamadı veya şifre hatalı' });
    }

    const isMatch = await verifyAndUpgradeCustomerPassword(customer, password);
    if (!isMatch) {
      return res.status(404).json({ success: false, message: 'Müşteri bulunamadı veya şifre hatalı' });
    }

    const token = jwt.sign({ customerId: customer._id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, message: 'Giriş başarılı', token, customer: sanitizeCustomerForClient(customer) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Aktif musteri profilini getir (PROTECTED)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'customer' || !req.customerId) {
      return res.status(403).json({ message: 'Bu islem icin yetkiniz yok' });
    }

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Musteri bulunamadi' });
    }

    res.json({ success: true, customer: sanitizeCustomerForClient(customer) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Profil güncelleme (PROTECTED)
router.put('/update/:id', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const allowedFields = ['name', 'surname', 'email', 'address', 'city', 'district', 'phone'];
    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    res.json(sanitizeCustomerForClient(updatedCustomer));
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

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Yeni şifre en az 6 karakter olmalıdır' });
    }

    const isMatch = await verifyAndUpgradeCustomerPassword(customer, oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Eski şifre yanlış' });
    }

    customer.password = await bcrypt.hash(String(newPassword), 10);
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

// Müşteri randevu iptali (PROTECTED)
router.patch('/appointments/:id/:appointmentId/cancel', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const appointment = customer.appointments.id(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }

    const statusLc = String(appointment.status || '').toLowerCase();
    if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
      return res.status(400).json({ message: 'Randevu zaten iptal edilmiş' });
    }

    if (appointment.slotId) {
      const slot = await Slot.findById(appointment.slotId);
      if (slot) {
        const slotCustomerId = slot.customer?.customerId ? String(slot.customer.customerId) : '';
        if (!slotCustomerId || slotCustomerId === String(req.customerId)) {
          slot.status = 'available';
          slot.cancelReason = 'Müşteri tarafından iptal edildi';
          slot.customer = undefined;
          slot.payment = { isPaid: false, amount: 0 };
          slot.updatedAt = new Date();
          await slot.save();
        }
      }
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = 'Müşteri tarafından iptal edildi';
    appointment.reminderSentAt = null;
    appointment.rescheduleApproval = undefined;
    await customer.save();

    return res.json({
      message: 'Randevu iptal edildi',
      appointment
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Müşteri randevu düzenleme (yeniden planlama) (PROTECTED)
router.patch('/appointments/:id/:appointmentId/reschedule', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const { targetSlotId } = req.body;
    if (!targetSlotId) {
      return res.status(400).json({ message: 'Yeni slot seçimi zorunlu' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const appointment = customer.appointments.id(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }

    const statusLc = String(appointment.status || '').toLowerCase();
    if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
      return res.status(400).json({ message: 'İptal edilen randevu düzenlenemez' });
    }

    if (!appointment.barberId) {
      return res.status(400).json({ message: 'Bu randevu için düzenleme desteklenmiyor' });
    }

    const targetSlot = await Slot.findById(targetSlotId).populate('barber');
    if (!targetSlot) {
      return res.status(404).json({ message: 'Seçilen slot bulunamadı' });
    }

    if (targetSlot.status !== 'available') {
      return res.status(400).json({ message: 'Seçilen slot artık müsait değil' });
    }

    if (isPastDateTime(targetSlot.date, targetSlot.time)) {
      return res.status(400).json({ message: 'Geçmiş saat için randevu alınamaz' });
    }

    const targetBarberId = targetSlot.barber?._id ? String(targetSlot.barber._id) : String(targetSlot.barber || '');
    if (String(appointment.barberId) !== targetBarberId) {
      return res.status(400).json({ message: 'Sadece aynı berberin slotlarına taşınabilir' });
    }

    const currentMasterId = String(appointment?.assignedMaster?.masterId || '');
    const targetMasterId = String(targetSlot?.assignedMaster?.masterId || '');
    if (currentMasterId !== targetMasterId) {
      return res.status(400).json({ message: 'Randevu sadece aynı ustanın takvimine taşınabilir' });
    }

    if (appointment.slotId) {
      const oldSlot = await Slot.findById(appointment.slotId);
      if (oldSlot) {
        const oldSlotCustomerId = oldSlot.customer?.customerId ? String(oldSlot.customer.customerId) : '';
        if (!oldSlotCustomerId || oldSlotCustomerId === String(req.customerId)) {
          oldSlot.status = 'available';
          oldSlot.cancelReason = 'Müşteri tarafından yeniden planlandı';
          oldSlot.customer = undefined;
          oldSlot.payment = { isPaid: false, amount: 0 };
          oldSlot.updatedAt = new Date();
          await oldSlot.save();
        }
      }
    }

    const customerName = `${customer.name || ''} ${customer.surname || ''}`.trim() || customer.phone || 'Müşteri';
    targetSlot.status = 'booked';
    targetSlot.cancelReason = '';
    targetSlot.customer = {
      customerId: customer._id,
      phone: customer.phone,
      name: customerName,
      service: appointment.service?.name || 'Belirtilmemiş',
      notes: '',
      isHomeService: false
    };
    targetSlot.updatedAt = new Date();
    await targetSlot.save();

    appointment.slotId = String(targetSlot._id);
    appointment.barberId = targetBarberId;
    appointment.barberName = targetSlot.barber?.name || appointment.barberName;
    appointment.date = targetSlot.date;
    appointment.time = targetSlot.time;
    appointment.assignedMaster = targetSlot.assignedMaster || null;
    appointment.status = 'Randevu Alındı';
    appointment.createdAt = new Date();
    appointment.reminderSentAt = null;
    appointment.cancelReason = '';
    appointment.rescheduleApproval = undefined;
    await customer.save();

    return res.json({
      message: 'Randevu yeniden planlandı',
      appointment
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Berberin saat değişikliği önerisine müşteri yanıtı (PROTECTED)
router.patch('/appointments/:id/:appointmentId/reschedule-response', authMiddleware, async (req, res) => {
  try {
    if (!ensureCustomerAccess(req, res)) return;

    const decision = String(req.body?.decision || '').toLowerCase();
    if (!['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Geçersiz karar' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const appointment = customer.appointments.id(req.params.appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }

    const phase = String(appointment?.rescheduleApproval?.phase || '');
    if (phase !== 'awaiting_customer') {
      return res.status(400).json({ message: 'Bu randevu için müşteri onayı beklenmiyor' });
    }

    if (!appointment.slotId) {
      return res.status(400).json({ message: 'Randevu slot bilgisi eksik' });
    }

    const slot = await Slot.findById(appointment.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot bulunamadı' });
    }

    if (String(slot.status || '').toLowerCase() !== 'reschedule_pending_customer') {
      return res.status(400).json({ message: 'Slot müşteri onayı adımında değil' });
    }

    const approval = slot.rescheduleApproval || {};
    const previousStatus = String(approval.previousStatus || 'booked').toLowerCase();
    const fallbackStatus = previousStatus === 'confirmed' ? 'confirmed' : 'booked';

    if (decision === 'accept') {
      slot.status = 'reschedule_pending_barber';
      slot.rescheduleApproval = {
        ...approval,
        phase: 'awaiting_barber',
        customerDecision: 'accepted',
        customerRespondedAt: new Date(),
      };

      appointment.status = 'Saat Değişikliği Berber Onayı Bekleniyor';
      appointment.rescheduleApproval = {
        ...(appointment.rescheduleApproval || {}),
        phase: 'awaiting_barber',
        customerDecision: 'accepted',
        customerRespondedAt: new Date(),
      };
    } else {
      slot.status = fallbackStatus;
      slot.rescheduleApproval = {
        ...approval,
        phase: 'rejected_by_customer',
        customerDecision: 'rejected',
        customerRespondedAt: new Date(),
      };

      appointment.status = normalizeCustomerStatusFromSlot(slot.status);
      appointment.rescheduleApproval = {
        ...(appointment.rescheduleApproval || {}),
        phase: 'rejected_by_customer',
        customerDecision: 'rejected',
        customerRespondedAt: new Date(),
      };
      appointment.date = approval.oldDate || appointment.date;
      appointment.time = approval.oldTime || appointment.time;
    }

    await slot.save();
    await customer.save();

    const io = req.app.get('io');
    const connectedBarbers = req.app.get('connectedBarbers');
    const barberId = appointment.barberId || (slot.barber ? String(slot.barber) : '');
    const barberSocketId = barberId && connectedBarbers ? connectedBarbers.get(String(barberId)) : null;

    if (barberSocketId && io) {
      io.to(barberSocketId).emit('barber_reschedule_response', {
        slotId: String(slot._id),
        appointmentId: String(appointment._id),
        customerDecision: decision,
        status: slot.status,
        rescheduleApproval: slot.rescheduleApproval || null,
        message: decision === 'accept'
          ? 'Müşteri yeni saat önerisini kabul etti. Son onayınız bekleniyor.'
          : 'Müşteri yeni saat önerisini reddetti. Önceki saat korundu.',
      });
    }

    return res.json({
      message: decision === 'accept'
        ? 'Yeni saat önerisini kabul ettiniz, berber son onayı bekleniyor.'
        : 'Yeni saat önerisini reddettiniz, önceki saat korundu.',
      appointment,
    });
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

    const { barberId, barberName, city, district, phone } = req.body;
    const normalizedCity = String(city || '').trim();
    const normalizedDistrict = String(district || '').trim();

    if (!normalizedCity || !normalizedDistrict) {
      return res.status(400).json({ message: 'Favori kaydında il ve ilçe birlikte zorunludur' });
    }
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const alreadyExists = customer.favorites.some(f => f.barberId === barberId);
    if (alreadyExists) {
      return res.status(400).json({ message: 'Bu berber zaten favorilerde' });
    }

    const favorite = { barberId, barberName, city: normalizedCity, district: normalizedDistrict, phone };
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