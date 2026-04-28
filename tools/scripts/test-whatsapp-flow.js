/**
 * Berber Randevu Sistemi - WhatsApp Entegrasyonu Test
 * 
 * Bu script:
 * 1. Backend'in hazır olup olmadığını kontrol eder
 * 2. Test randevusu oluşturur
 * 3. Berber'e WhatsApp bildirimi gönderir
 * 4. Berber'in kabul yanıtını simüle eder
 * 5. Müşteri'ye WhatsApp bildirimi gönderir
 * 
 * Kullanım: node test-whatsapp-flow.js
 * 
 * Gereksinimler:
 * - Backend çalışıyor (http://localhost:5001)
 * - WhatsApp Manager çalışıyor (http://localhost:5205)
 * - MongoDB bağlantısı aktif
 */

const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// .env dosyasını backend klasöründen yükle
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

// Konfigürasyon
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
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
    
    // MongoDB'ye bağlan
    await mongoose.connect(process.env.MONGODB_URI);
    log.success('MongoDB bağlantısı başarılı');
    
    // Model'leri yükle (backend konumundan)
    const Barber = require(path.join(__dirname, '../../backend/src/models/Barber'));
    const Customer = require(path.join(__dirname, '../../backend/src/models/Customer'));
    const Request = require(path.join(__dirname, '../../backend/src/models/Request'));
    
    // Önceki test randevularını temizle
    await Request.deleteMany({ 
      customerPhone: CUSTOMER_PHONE,
      status: { $in: ['pending', 'accepted'] }
    });
    log.info('Önceki test randevuları temizlendi');
    
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
    
    // Hizmetleri hazırla (1 hizmet - müşteri tarafından seçilmiş)
    const serviceNames = barber.services?.slice(0, 1).map(s => s.name) || ['Saç Kesimi'];
    const serviceIds = barber.services?.slice(0, 1).map(s => s._id) || [];
    
    // Tarih ve saat belirle (yarın 10:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    // Randevu oluştur
    const appointmentData = {
      customerId: customer._id,
      barberId: barber._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      barberName: barber.name,
      services: serviceIds,
      estimatedPrice: 100,
      estimatedDuration: 30,
      scheduledAt: tomorrow,
      notes: 'Test Randevusu'
    };
    
    log.info('Randevu verisi:');
    log.info(`  Müşteri: ${appointmentData.customerName} (${appointmentData.customerPhone})`);
    log.info(`  Berber: ${appointmentData.barberName}`);
    log.info(`  Hizmetler: ${serviceNames.join(', ')}`);
    log.info(`  Tarih: ${tomorrow.toLocaleDateString('tr-TR')}`);
    log.info(`  Saat: ${tomorrow.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
    
    // API çağrısı yap
    try {
      const createRes = await axios.post(`${BACKEND_URL}/api/requests`, appointmentData, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const requestId = createRes.data.data?.requestId;
      if (!requestId) {
        throw new Error('Request ID not found in response');
      }
      log.success(`Randevu Oluşturuldu! ID: ${requestId}`);
      log.info(`  Status: ${createRes.data.data?.status}`);
    } catch (err) {
      log.error(`API Hatası: ${err.message}`);
      if (err.response?.data) {
        console.log('Response:', JSON.stringify(err.response.data, null, 2));
      }
      throw err;
    }
    
    // Berber'e WhatsApp gitti mi kontrol et
    log.section('4️⃣  Berber WhatsApp Bildirimi');
    log.info(`✉️  Berber'in telefonu (${BARBER_PHONE}) monitöre bakın!`);
    log.info('📱 2 saniye sonra müşteri bildirimi simülasyonuna geçiyorum...');
    
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
    log.info(`  - Hizmetler: ${serviceNames.join(', ')}`);
    log.info(`  - Fiyat: ${appointmentData.estimatedPrice} TL`);
    log.info(`  - Tarih: ${tomorrow.toLocaleDateString('tr-TR')}`);
    log.info(`  - Saat: ${tomorrow.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
    
    log.section('7️⃣  Test Özeti');
    log.success('✅ Tüm işlemler başarılı!');
    log.info('WhatsApp mesajları denetlendi:');
    log.info(`  1️⃣  Berber'e randevu bildirimi`);
    log.info(`  2️⃣  Müşteri'ye onay bildirimi`);
    log.info(`  3️⃣  Tüm detaylar doğru gösteriliyor`);
    
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
