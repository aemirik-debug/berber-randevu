const Request = require('../models/Request');
const { sendWhatsappToBarber } = require('../services/whatsappService');
const Barber = require('../models/Barber');

// @desc    Yeni randevu talebi oluştur
// @route   POST /api/requests
// @access  Public
const createRequest = async (req, res) => {
  try {
    const { customerName, customerPhone, barberId, services, notes, scheduledAt } = req.body;

    // Berber kontrolü
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({ success: false, error: 'Berber bulunamadı' });
    }

    if (barber.status === 'offline') {
      return res.status(400).json({ success: false, error: 'Berber şu an çevrimdışı' });
    }

    // Fiyat ve süre hesaplama + Service names çıkar
    let estimatedPrice = 0;
    let estimatedDuration = 0;
    const serviceNames = [];

    for (const serviceId of services) {
      const service = barber.services.find(s => s._id.toString() === serviceId.toString());
      if (service) {
        estimatedPrice += service.price;
        estimatedDuration += service.duration;
        serviceNames.push(service.name);
      }
    }

    // Kontrol: aynı slotta zaten randevu var mı?
    const existingRequest = await Request.findOne({
      barber: barberId,
      services,
      status: 'accepted'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: `Bu slot sistemden dolu. Müşteri: ${existingRequest.customerName} (${existingRequest.customerPhone})`
      });
    }


    // Yeni talep oluştur
    const request = new Request({
      customerName,
      customerPhone,
      barber: barberId,
      services,
      serviceNames,
      estimatedPrice,
      estimatedDuration,
      scheduledAt: scheduledAt || new Date(),
      notes,
      expiresAt: new Date(Date.now() + 30000) // 30 saniye sonra expire
    });

    await request.save();

    // WhatsApp mesajı gönder
    try {
      const msg = `Yeni randevu talebi!\nMüşteri: ${customerName}\nTelefon: ${customerPhone}\nHizmetler: ${serviceNames.join(', ')}\nFiyat: ${estimatedPrice} TL\nOnaylamak için "onayla", iptal için "iptal" yazabilirsiniz.`;
      await sendWhatsappToBarber(barber.phone, msg);
    } catch (err) {
      console.error('WhatsApp mesajı gönderilemedi:', err.message);
    }

    // Socket.io ile bildirim
    const io = req.app.get('io');
    const connectedBarbers = req.app.get('connectedBarbers');
    const barberSocketId = connectedBarbers.get(barberId.toString());
    
    if (barberSocketId) {
      io.to(barberSocketId).emit('incoming_request', {
        requestId: request._id,
        customerName,
        customerPhone,
        services,
        estimatedPrice,
        estimatedDuration,
        notes,
        expiresAt: request.expiresAt
      });
    }

    res.status(201).json({
      success: true,
      message: 'Talep gönderildi, berber onayı bekleniyor',
      data: {
        requestId: request._id,
        status: request.status,
        expiresAt: request.expiresAt,
        estimatedPrice,
        estimatedDuration
      }
    });

  } catch (error) {
    console.error('Talep oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
  }
};

// @desc    Randevu detayını getir (berber için)
// @route   GET /api/requests/:requestId
// @access  Private
const getRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const barberId = req.barberId;

    const request = await Request.findOne({ _id: requestId, barber: barberId });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    res.json({
      success: true,
      data: {
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        services: request.services,
        estimatedPrice: request.estimatedPrice,
        status: request.status,
        date: request.createdAt,
        notes: request.notes
      }
    });
  } catch (error) {
    console.error('Randevu detay hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
};

// @desc    Berber talebe yanıt verir (onay/red)
// @route   PATCH /api/requests/:requestId/respond
// @access  Private
const respondToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' veya 'reject'

    const request = await Request.findOne({ _id: requestId, barber: req.barberId });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    if (action === 'accept') {
      request.status = 'accepted';
      request.acceptedAt = new Date();
    } else if (action === 'reject') {
      request.status = 'rejected';
    } else {
      return res.status(400).json({ success: false, error: 'Geçersiz işlem' });
    }

    await request.save();

    // Berberin bilgisini getir (müşteriye göndermek için)
    const barber = await Barber.findById(req.barberId).select('name salonName');

    // Socket.io ile bildirim
    const io = req.app.get('io');
    if (io) {
      io.emit('request_responded', { 
        requestId, 
        status: request.status,
        action
      });
    }

    // Müşteriye WhatsApp bildirim gönder
    try {
      const { sendWhatsappToCustomer } = require('../services/whatsappService');
      const statusText = action === 'accept' ? 'KABUL EDILDI ✅' : 'REDDEDİLDİ ❌';
      const customerMsg = `Randevu talebi ${statusText}\n\nBerber: ${barber.name || barber.salonName}\nHizmetler: ${request.services.join(', ')}\nFiyat: ${request.estimatedPrice} TL`;
      
      await sendWhatsappToCustomer(request.customerPhone, customerMsg);
      console.log('📱 Müşteriye WhatsApp bildirim gönderildi (respond endpoint)');
    } catch (whatsappErr) {
      console.error('⚠️ Müşteriye bildirim gönderilemedi:', whatsappErr.message);
      // Devam et, önemli değil
    }

    res.json({ success: true, message: 'İşlem başarılı', data: request });
  } catch (error) {
    console.error('Respond hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
  }
};

// @desc    İşlem tamamlandı
// @route   PATCH /api/requests/:requestId/complete
// @access  Private
// Randevuyu iptal et
const cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    // Model import edilmiş olmalı
    const request = await Request.findOne({ _id: requestId, barber: req.barberId });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });
    }

    request.status = 'cancelled';
    request.cancelReason = reason;
    await request.save();

    // Socket varsa emit et
    const io = req.app.get('io');
    if (io) {
      io.emit('request_cancelled', { requestId, reason });
    }

    res.json({ success: true, message: 'Randevu iptal edildi', data: request });
  } catch (err) {
    console.error('Cancel error:', err); // log ekle
    res.status(500).json({ success: false, error: err.message });
  }
};


// Randevuyu tamamla
const completeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { isPaid, amount } = req.body;

    const request = await Request.findOne({ _id: requestId, barber: req.barberId });
    if (!request) return res.status(404).json({ success: false, error: 'Randevu bulunamadı' });

    request.status = 'completed';
    request.payment = { isPaid, amount };
    await request.save();

    res.json({ success: true, message: 'Randevu tamamlandı', data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// @desc    Bekleyen talepleri getir (berber için)
// @route   GET /api/requests/pending
// @access  Private
const getPendingRequests = async (req, res) => {
  try {
    const barberId = req.barberId;

    const requests = await Request.find({ 
      barber: barberId, 
      status: 'pending' 
    }).populate('barber', 'salonName name services');

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Pending requests hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
  }
};

// Tüm fonksiyonları topluca export ediyoruz
module.exports = {
  createRequest,
  getRequestById,
  respondToRequest,
  completeRequest,
  cancelRequest,
  getPendingRequests
};
