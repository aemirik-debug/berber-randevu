# 🎯 Berber Randevu Sistemi - Kullanımı

## 🚀 Hızlı Başlangıç

### 1️⃣ Hizmetleri Başlat

```powershell
# PowerShell'de çalıştır
.\start-services.ps1
```

Bu komut **backend** ve **WhatsApp Manager**'ı otomatik başlatacak.

### 2️⃣ Servislerin Durumunu Kontrol Et

- Backend: `curl http://localhost:5001`
- WhatsApp Manager: `curl http://localhost:5205/health` (varsa)

### 3️⃣ Test Çalıştır

```powershell
# Yeni terminal açıp şunu çalıştır
cd backend
node ..\tools\scripts\test-whatsapp-flow.js
```

---

## 📱 WhatsApp Akışı

### Randevu Oluşturma Süreci

```
1. Müşteri API'ye randevu talebi gönderir
   ↓
2. Backend database'e kayıt eder
   ↓
3. Berber'e WhatsApp bildirimi gider
   "Yeni randevu talebi!
    Müşteri: Ali Emre
    Telefon: 05354966205
    Hizmetler: Saç kesimi
    Fiyat: 800 TL"
   ↓
4. Berber "onayla" veya "iptal" yazıyor
   ↓
5. Müşteri'ye WhatsApp gidiyor
   "Randevu talebi KABUL EDILDI ✅
    Berber: Berber Şeref
    Hizmetler: Saç kesimi
    Fiyat: 800 TL
    Tarih: 28.04.2026 Salı
    Saat: 10:00"
```

---

## 🔌 API Endpoints

### Randevu Oluştur

**POST** `/api/requests`

```json
{
  "customerId": "69e8b0a3c7df2cb6c388dc4d",
  "barberId": "69e9e33ce8c788be9c485189",
  "customerName": "Ali Emre",
  "customerPhone": "05354966205",
  "services": [
    "69e9e51f8c5c5c221ada2b0e"
  ],
  "scheduledAt": "2026-04-28T10:00:00Z",
  "notes": "Normal randevu"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Talep gönderildi, berber onayı bekleniyor",
  "data": {
    "requestId": "69ef72beadc10b63371383d2",
    "status": "pending",
    "estimatedPrice": 800,
    "expiresAt": "2026-04-27T14:14:06.619Z"
  }
}
```

### Berber Yanıtı (Webhook)

**POST** `/webhook/whatsapp-reply`

```json
{
  "phone": "05324074812",
  "action": "onayla"
}
```

**Kabul edilen actions:**
- `onayla` → Randevu kabul (status: accepted)
- `iptal` → Randevu reddet (status: rejected)
- `accept` → Randevu kabul (eski format)

---

## 📊 İzleme & Sorun Giderme

### Backend Logları Kontrol Et

```powershell
# Backend terminal'inde bu satırları gözlemle:
📱 WhatsApp Yanıtı Geldi: 05324074812 -> onayla
✅ Randevu: pending -> accepted
WhatsApp Müşteriye gönderildi: { success: true }
📱 Müşteriye WhatsApp bildirim gönderildi
```

### WhatsApp Manager Kontrol

```powershell
# Manager terminal'inde:
✅ Berbergo Sistemi Bağlandı!
WhatsApp Manager HTTP API 5205 portunda dinleniyor.
Mesaj iletiliyor: 905354966205@c.us
```

### Yaygın Sorunlar

| Sorun | Çözüm |
|-------|-------|
| Backend bağlanamıyor | MongoDB URI'ı kontrol et, internet bağlantısı var mı? |
| WhatsApp Manager hata veriyor | QR kodu taramak gerekebilir, `.wwebjs_auth` klasörünü sil |
| Mesaj gitmiyor | WhatsApp Manager'da "Mesaj iletiliyor..." loglarını kontrol et |
| Port 5001 zaten kullanılıyor | `netstat -ano \| findstr :5001` ve PID'i `taskkill /PID xxx` ile kapat |

---

## 🔧 Ortam Değişkenleri

**backend/.env** dosyasında gerekli değişkenler:

```env
MONGODB_URI=mongodb+srv://...
PORT=5001
BACKEND_URL=http://localhost:5001
WHATSAPP_MANAGER_URL=http://localhost:5205
```

---

## 📝 Notlar

- Randevu talepleri **30 saniye** sonra otomatik expire olur (test için)
- WhatsApp sesyonu şifreli olarak kaydedilir (`.wwebjs_auth/`)
- Tüm mesajlar UTF-8 formatında gönderilir
- Fiyatlar ve hizmetler berber profilinden otomatik çekilir

---

## 🚀 Deployment

Production için:

1. `.env` dosyasını güvenli bir şekilde ayarla
2. `npm install` ile dependencies yükle
3. `node backend/server.js` başlat (PM2 veya supervisor ile)
4. Nginx/Apache ile reverse proxy ayarla (TLS ile)
5. Backup stratejisi oluştur (MongoDB verileri)

---

Sorular? Logları kontrol et veya `WHATSAPP_SETUP.md` dosyasını oku. 🎉
