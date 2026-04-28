# 📱 WhatsApp Entegrasyonu - Kullanıcı Kılavuzu

## Genel Akış

```
Müşteri Randevu Oluştur
    ↓
Berbere WhatsApp Bildirim (Port 5205 üzerinden)
    ↓
Berber WhatsApp'ta Yanıt Verir ("onayla" veya "iptal")
    ↓
Yanıt 5205'den 5001 (Backend) webhook'a iletilir
    ↓
Müşteriye WhatsApp Bildirim
    ↓
✅ Tamamlandı
```

---

## 🚀 Başlatma

### Gereksinimler
- **Node.js** 16+ ve **npm**
- **MongoDB** (Cloud veya local)
- **.env dosyası** backend klasöründe
  ```
  PORT=5001
  MONGODB_URI=mongodb+srv://...
  JWT_SECRET=...
  ```

### Hızlı Başlangıç (3 Terminal)

#### Terminal 1: Backend
```powershell
cd berber-randevu
.\start-backend.ps1
```
Başarı:
```
✅ MongoDB bağlandı
🚀 Server port 5001 üzerinde aktif
```

#### Terminal 2: WhatsApp Manager
```powershell
cd berber-randevu
.\start-whatsapp-manager.ps1
```
İlk kez çalıştırırken:
```
--- LÜTFEN QR KODU TARATIN ---
[QR CODE]
✅ Berbergo Sistemi Bağlandı!
WhatsApp Manager HTTP API 5205 portunda dinleniyor.
```

#### Terminal 3: Opsiyonel - Logs İzleme
```powershell
# Her iki terminal de logs görünüyor
# Ayrıca MongoDB'de randevu ve yanıtları kontrol edebilirsin
```

---

## 🧪 Test Etme

### Otomatik Test
```powershell
.\test-whatsapp-integration.ps1
```

### Manuel Test

#### 1. Berberin WhatsApp Numarasını Veritabanına Ekle
Berber modeli oluştururken `phone` alanını dokuz basamaklı format ile gir:
```
Doğru: 05551234567
Yanlış: +90 555 123 4567
```

#### 2. Postman/cURL ile Randevu Oluştur
```bash
curl -X POST http://localhost:5001/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Müşteri",
    "customerPhone": "05559876543",
    "barberId": "507f1f77bcf86cd799439011",
    "services": ["Saç Kesimi"],
    "notes": "Test"
  }'
```

**Beklenen sonuç:**
- ✅ Berberin WhatsApp'ına bildirim gelir
- 📋 Request DB'de `pending` durumda

#### 3. Berberin WhatsApp Yanıtını Simüle Et
Berbinin WhatsApp'ta "onayla" veya "iptal" yazması bekleyen akışı test etmek için:

```bash
curl -X POST http://localhost:5001/webhook/whatsapp-reply \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "05551234567",
    "action": "accept"
  }'
```

**Beklenen sonuç:**
- ✅ Request DB'de `accepted` durumda
- 📱 Müşterinin WhatsApp'ına bildirim gelir
- 🔔 Dashboard (Socket.io) anlık güncellenme

---

## 📡 API Endpoints

### Müşteri Randevu Oluştur
```
POST /api/requests
Body: {
  customerName: string,
  customerPhone: string (0532...),
  barberId: ObjectId,
  services: [string],
  notes?: string
}
```

### WhatsApp Webhook (Berber Yanıtı)
```
POST /webhook/whatsapp-reply
Body: {
  phone: string (0532...),
  action: "accept" | "reject"
}
```

---

## 🔧 Konfigürasyon

### Port Yönetimi
| Servis | Port | Dosya |
|--------|------|-------|
| Backend API | 5001 | `backend/server.js` |
| WhatsApp Manager | 5205 | `whatsapp-manager.js` |
| Webhook (eski, kullanılmıyor) | 5210 | `backend/tools/whatsapp_webhook_server.js` |

### Environment Variables
```env
# backend/.env
PORT=5001
MONGODB_URI=mongodb+srv://berberadmin:PASSWORD@cluster0.mongodb.net/berber-randevu
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=http://localhost:3000,https://berbergo.com.tr
```

---

## 🐛 Sorun Giderme

### WhatsApp Manager QR Kodu Nasıl Taranır?
1. `start-whatsapp-manager.ps1` çalıştırınca QR kod terminalde görünür
2. WhatsApp Web'e gitmek istediğimiz telefon ile tarayın
3. Başarı: `✅ Berbergo Sistemi Bağlandı!`

### 500 Hatası Alıyorum
```
❌ Webhook Hatası: ...
```
Kontrol:
- MongoDB bağlı mı? `MONGODB_URI` doğru mu?
- Backend çalışıyor mu? `Port 5001` dinlemede mi?
- Berberin `phone` numarası doğru formatta mı? (0532... şekli)

### WhatsApp Mesajı Gönderilmiyor
- WhatsApp Manager çalışıyor mu? (`Port 5205`)
- QR kodu taradın mı? (WhatsApp Web oturumu açık mı?)
- Logs'ta: `Mesaj iletiliyor: 905...@c.us`

### Webhook 404 Hatası
```
STATUS: 404
```
- Backend gerçekten 5001'de çalışıyor mu?
- Manager yanıtı 5001'e gönderiyor mu? ✅ (kodda sabitledik)

---

## 📝 Loglar & Debug

### Backend Logs
```
📱 WhatsApp Yanıtı Geldi: 05551234567 -> accept
✅ Randevu: pending -> accepted
📡 Socket.io bildirimi gönderildi berbere
📱 Müşteriye WhatsApp bildirim gönderildi
```

### Manager Logs
```
Mesaj iletiliyor: 905551234567@c.us
Yanıt backend'e iletildi: 05551234567 - accept
```

---

## 📚 Dosya Yapısı

```
berber-randevu/
├── backend/
│   ├── server.js              ← Main API + Webhook route
│   ├── .env                   ← Environment config
│   ├── src/
│   │   ├── controllers/requestController.js   ← Randevu lojik
│   │   ├── services/whatsappService.js       ← WhatsApp sending
│   │   └── models/Request.js                 ← Veri modeli
│   └── tools/whatsapp_webhook_server.js     ← ⚠️ Kullanılmıyor (backup)
│
├── whatsapp-manager.js        ← WEB.js ile WhatsApp bağlantısı
├── start-backend.ps1          ← Backend başlat
├── start-whatsapp-manager.ps1 ← Manager başlat
└── test-whatsapp-integration.ps1 ← Test et
```

---

## ✅ Checklist - İlk Kurulum

- [ ] `backend/.env` dosyası MongoDB URI ile dolduruldu
- [ ] `npm install` (backend ve root) çalıştırıldı
- [ ] Backend terminalde başlatıldı (5001 dinlemede)
- [ ] WhatsApp Manager başlatıldı ve QR kod tarandı (5205 aktif)
- [ ] Test script başarıyla koştu
- [ ] Berberin `phone` numarası doğru formatta DB'de

---

## 🚀 Production Hazırlığı

- [ ] `.env` gerçek verileri içeriyor
- [ ] MongoDB Cloud (Atlas) bağlı
- [ ] WhatsApp Manager sunucuda kalıcı çalışıyor (PM2, Docker vb.)
- [ ] Backend CORS ayarları güncellendi
- [ ] SSL/HTTPS aktif

---

**Sorular? Logs'a bak, debug mesajları oldukça detaylı!** 📋
