/**
 * ⚠️  UYARI: Bu dosya artık kullanılmıyor!
 * 
 * Webhook endpoint artık ana backend sunucusunda (Port 5001) tanımlıdır:
 * Konum: backend/server.js -> POST /webhook/whatsapp-reply
 * 
 * Bu dosya yalnızca backup/referans amacıyla saklanmıştır.
 * Lütfen bu dosyayı çalıştırmayın.
 */

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 5210;

app.use(bodyParser.json());


// MODELLER
const mongoose = require('mongoose');
const Request = require('../src/models/Request');
const Barber = require('../src/models/Barber');
const Customer = require('../src/models/Customer');

// MongoDB bağlantısı (varsayılan localhost)
mongoose.connect('mongodb://localhost:27017/berbergo', { useNewUrlParser: true, useUnifiedTopology: true });

// WhatsApp yanıt webhook'u
app.post('/webhook/whatsapp-reply', async (req, res) => {
  const { phone, action } = req.body;
  if (!phone || !action) {
    return res.status(400).json({ success: false, error: 'phone ve action zorunlu' });
  }
  try {
    // Berberi bul
    const barber = await Barber.findOne({ phone });
    if (!barber) return res.status(404).json({ success: false, error: 'Berber bulunamadı' });

    // Son "pending" durumundaki randevu talebini bul
    const request = await Request.findOne({ barber: barber._id, status: 'pending' }).sort({ createdAt: -1 });
    if (!request) return res.status(404).json({ success: false, error: 'Bekleyen randevu bulunamadı' });

    // Yanıta göre güncelle
    if (action === 'accept') {
      request.status = 'accepted';
      request.acceptedAt = new Date();
    } else if (action === 'reject') {
      request.status = 'rejected';
      request.rejectionReason = 'WhatsApp üzerinden reddedildi';
    }
    await request.save();

    // Müşteri kaydına da ekle (isteğe bağlı, müşteri varsa)
    const customer = await Customer.findOne({ phone: request.customerPhone });
    if (customer) {
      customer.appointments = customer.appointments || [];
      customer.appointments.push({
        barberId: barber._id.toString(),
        barberName: barber.name,
        barberSalonName: barber.salonName,
        barberCity: barber.city,
        barberDistrict: barber.district,
        date: new Date().toISOString().split('T')[0],
        time: '',
        service: { name: request.services.join(', '), price: request.estimatedPrice },
        status: request.status,
        createdAt: new Date()
      });
      await customer.save();
    }

    // Burada müşteriye bildirim gönderebilirsin (örn. SMS, e-posta, push, vs.)

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook işleme hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend WhatsApp webhook ${PORT} portunda dinleniyor.`);
});
