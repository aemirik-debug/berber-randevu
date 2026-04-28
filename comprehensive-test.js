/**
 * Comprehensive WhatsApp Integration Test
 * 1. Start backend & manager
 * 2. Query database for barber/customer
 * 3. Create appointment
 * 4. Simulate barber response
 * 5. Verify customer notification
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

// Konfigürasyon
const BACKEND_URL = 'http://localhost:5001';
const BARBER_PHONE = '05324074812';
const CUSTOMER_PHONE = '05354966205';

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  section: (msg) => console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━\n${msg}\n━━━━━━━━━━━━━━━━━━━━━━━`)
};

(async () => {
  try {
    log.section('1️⃣  Veritabanına Bağlanıyorum');
    
    await mongoose.connect(process.env.MONGODB_URI);
    log.success('MongoDB bağlantısı başarılı');
    
    const Barber = require('./backend/src/models/Barber');
    const Customer = require('./backend/src/models/Customer');
    const Request = require('./backend/src/models/Request');
    
    log.section('2️⃣  Berber ve Müşteri Verilerini Kontrol Ediyorum');
    
    // Berber ara
    let barber = await Barber.findOne({ phone: BARBER_PHONE });
    if (!barber) {
      log.error(`Berber ${BARBER_PHONE} bulunamadı!`);
      log.info('İlk 3 berberi gösteriyorum:');
      const allBarbers = await Barber.find().limit(3);
      allBarbers.forEach(b => log.info(`  - ${b.name}: ${b.phone}`));
      process.exit(1);
    }
    log.success(`Berber Bulundu: ${barber.name} (${barber.phone})`);
    log.info(`  Berber ID: ${barber._id}`);
    log.info(`  Hizmetler: ${barber.services?.length || 0}`);
    
    // Müşteri ara
    let customer = await Customer.findOne({ phone: CUSTOMER_PHONE });
    if (!customer) {
      log.warning(`Müşteri ${CUSTOMER_PHONE} bulunamadı! Oluşturuyorum...`);
      customer = await Customer.create({
        name: 'Test Müşteri',
        phone: CUSTOMER_PHONE,
        email: 'test@example.com'
      });
      log.success(`Müşteri Oluşturuldu: ${customer.name}`);
    } else {
      log.success(`Müşteri Bulundu: ${customer.name} (${customer.phone})`);
    }
    log.info(`  Müşteri ID: ${customer._id}`);
    
    log.section('3️⃣  Randevu Talebi Oluşturuyorum');
    
    // Randevu oluştur
    const appointmentData = {
      customerId: customer._id,
      barberId: barber._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      barberName: barber.name,
      services: barber.services?.slice(0, 2) || ['Saç Kesimi'],
      estimatedPrice: 100,
      estimatedDuration: 30,
      notes: 'Test Randevusu'
    };
    
    log.info('Randevu verisi:');
    log.info(`  Müşteri: ${appointmentData.customerName} (${appointmentData.customerPhone})`);
    log.info(`  Berber: ${appointmentData.barberName}`);
    log.info(`  Hizmetler: ${appointmentData.services?.join(', ')}`);
    log.info(`  Fiyat: ${appointmentData.estimatedPrice} TL`);
    
    // API çağrısı yap
    const createRes = await axios.post(`${BACKEND_URL}/api/requests`, appointmentData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const requestId = createRes.data.request._id;
    log.success(`Randevu Oluşturuldu! ID: ${requestId}`);
    log.info(`  Status: ${createRes.data.request.status}`);
    
    // Berber'e WhatsApp gitti mi kontrol et
    log.section('4️⃣  Berber WhatsApp Bildirimi');
    log.info(`✉️  Berber'in telefonu (${BARBER_PHONE}) monitöre bakın!`);
    log.info('🔄 2 saniye sonra müşteri bildirimi simülasyonuna geçiyorum...');
    
    // 2 saniye bekle
    await new Promise(r => setTimeout(r, 2000));
    
    log.section('5️⃣  Berber Kabul Yanıtını Simüle Ediyorum');
    
    // Berber webhook'ı çağır (kabul)
    const webhookRes = await axios.post(`${BACKEND_URL}/webhook/whatsapp-reply`, {
      phone: BARBER_PHONE,
      action: 'onayla'
    });
    
    log.success('Berber Yanıtı Gönderildi: KABUL (onayla)');
    log.info(`  Response: ${webhookRes.data.message}`);
    
    // Müşteri'ye WhatsApp gitti mi kontrol et
    log.section('6️⃣  Müşteri WhatsApp Bildirimi');
    log.info(`✉️  Müşteri'nin telefonu (${CUSTOMER_PHONE}) monitöre bakın!`);
    log.info('İleti şu bilgileri içermelidir:');
    log.info(`  - Randevu KABUL EDILDI ✅`);
    log.info(`  - Berber: ${barber.name}`);
    log.info(`  - Hizmetler: ${appointmentData.services?.join(', ')}`);
    log.info(`  - Fiyat: ${appointmentData.estimatedPrice} TL`);
    
    log.section('7️⃣  Test Özeti');
    log.success('✅ Tüm işlemler başarılı!');
    log.info('Kontrol Et:');
    log.info(`  1️⃣  Berber'in WhatsApp'ında randevu bildirimi geldi mi? (${BARBER_PHONE})`);
    log.info(`  2️⃣  Müşteri'nin WhatsApp'ında onay bildirimi geldi mi? (${CUSTOMER_PHONE})`);
    log.info(`  3️⃣  İletilerdeki bilgiler doğru mu?`);
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (err) {
    log.error(`HATA: ${err.message}`);
    if (err.response?.data) {
      log.error(`Response: ${JSON.stringify(err.response.data, null, 2)}`);
    }
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
})();
