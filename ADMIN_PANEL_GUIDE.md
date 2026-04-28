# 🔐 BERBERGO SÜPERDMİN PANEL - KULLANIM KILAVUZU

## 📋 İçindekiler
1. [Giriş](#giriş)
2. [Özellikler](#özellikler)
3. [Nasıl Başlanır](#nasıl-başlanır)
4. [Panel Bölümleri](#panel-bölümleri)
5. [İzinler Sistemi](#izinler-sistemi)
6. [API Endpoints](#api-endpoints)

---

## 🎯 Giriş

Berbergo Süper Admin Paneli, sistemin tüm yönlerini kontrol etmek için tasarlanmış güçlü bir araçtır. Admin, müşteriler, berberler, randevular, raporlar ve sistem ayarlarını merkezi bir yerden yönetebilir.

**Panel URL**: `/admin/login`

---

## ✨ Özellikler

### 1. **Dashboard (📊)**
- Sistem istatistikleri gerçek zamanlı
- Toplam müşteri, berber, randevu sayıları
- Son 7 gün etkinlik
- Hızlı sistem durumu kontrolü

### 2. **Müşteri Yönetimi (👥)**
- Tüm müşterileri listele
- Müşteri detaylarını görüntüle
- Müşteri yasaklama (ban)
- Sayfalı listeleme

### 3. **Berber Yönetimi (✂️)**
- Berber listelemesi
- Yeni berber onaylama
- Berber askıya alma
- Berber detaylarını görüntüleme

### 4. **Randevu Yönetimi (📅)**
- Tüm randevuları görüntüle
- Randevu durumunu takip et
- Beklemede randevuları iptal etme
- Tarih/saat bilgisi gösterme

### 5. **Admin Yönetimi (🔑)** - Sadece Super Admin
- Yeni admin oluşturma
- İzinleri düzenleme
- Admin silme
- Rol atama

### 6. **Raporlar (📈)**
- Gelir raporu (son 30 gün)
- Sistem özeti
- CSV/Excel dışa aktarma
- Otomatik yedekleme

---

## 🚀 Nasıl Başlanır

### Step 1: Admin Hesabı Oluşturma

Database'e doğrudan admin kaydı ekleyin:

```javascript
const Admin = require('./src/models/Admin');

const admin = new Admin({
  email: 'admin@berbergo.com',
  password: 'güçlü_şifre_123',
  name: 'Ali',
  surname: 'Yönetici',
  isSuperAdmin: true,
  isActive: true
});

await admin.save();
console.log('Super Admin oluşturuldu!');
```

### Step 2: Giriş Yapma

1. `/admin/login` adresine git
2. Email: `admin@berbergo.com`
3. Şifre: `güçlü_şifre_123`
4. **Giriş Yap** butonuna tıkla

### Step 3: Dashboard'u İncelemek

Giriş başarılı olursa, Dashboard'a yönlendirileceksin.

---

## 📍 Panel Bölümleri

### 🏠 Sidebar (Sol Menü)
```
📊 Dashboard      - Sistem özeti
👥 Müşteriler    - Müşteri yönetimi
✂️ Berberler     - Berber yönetimi
📅 Randevular    - Randevu yönetimi
🔑 Adminler      - Admin yönetimi (Super Admin)
📈 Raporlar      - Sistem raporları
```

### 📊 Dashboard Sayfası

**Gösterilen İstatistikler:**
- **Toplam Müşteriler**: Sistemdeki tüm müşteri sayısı
- **Toplam Berberler**: Kayıtlı berber sayısı
- **Toplam Randevular**: Yapılmış randevu sayısı
- **Son 7 Gün**: Son bir hafta içinde oluşan randevular
- **Onaylı Randevular**: Berber tarafından kabul edilen randevular
- **Beklemede**: Cevap bekleyen randevular
- **İptal Edilen**: Başarısız randevular

### 👥 Müşteri Yönetimi

**Fonksiyonlar:**
- Müşteri listesi (sayfalanmış)
- Arama/filtreleme
- Müşteri detaylarını görüntüleme
- Müşteri yasaklama

**Müşteri Yasaklama:**
```
1. Müşteri satırında "🚫 Yasakla" butonuna tıkla
2. "Bu müşteri yasaklanacak. Emin misiniz?" sor
3. Yasaklama sebebini gir
4. Sistem müşterinin tüm işlemlerini engeller
```

### ✂️ Berber Yönetimi

**Fonksiyonlar:**
- Berber listelemesi
- Onay bekleme berberler
- Berber askıya alma
- Berber bilgilerini düzenleme

**Berber Onaylama:**
```
1. Yeni berber kayıt olmuşsa, listede "⏳ Beklemede" gösterilir
2. "✅ Onayla" butonuna tıkla
3. Berber sistemde aktif hale gelir
```

### 📅 Randevu Yönetimi

**Fonksiyonlar:**
- Tüm randevuları görüntüleme
- Randevu durumunu takip etme
- Problematik randevuları iptal etme

**Randevu İptali:**
```
1. İptal edilecek randevuyu bul
2. "❌ İptal Et" butonuna tıkla (sadece beklemede randevular)
3. İptal sebebini gir
4. Sistem müşteri ve berberi bilgilendirir
```

### 🔑 Admin Yönetimi (Sadece Super Admin)

**Yeni Admin Oluşturma:**
```
1. "+ Yeni Admin" butonuna tıkla
2. Bilgileri doldur:
   - Email
   - Şifre
   - İsim, Soyisim
   - Rol seç (Admin/Moderator/Super Admin)
3. "✅ Oluştur" tuşuna bas
```

**İzin Yönetimi:**
```
Tüm admins için ayarlanabilir:
- Kullanıcılar (view, create, edit, delete, ban)
- Berberler (view, create, edit, delete, approve, suspend)
- Randevular (view, cancel, modify)
- Raporlar (view, export)
- Sistem (logs, maintenance, backup)
```

### 📈 Raporlar

**Raporlar:**
1. **Gelir Raporu (Son 30 Gün)**
   - Toplam gelir
   - Tamamlanan randevu sayısı
   - Ortalama hizmet fiyatı
   - CSV olarak indir

2. **Sistem Özeti**
   - Sistem durumu
   - Son yedekleme tarihi
   - API yanıt süresi

3. **Toplu İhraç**
   - Tüm istatistikler
   - Müşteri listesi (Excel)
   - Berber listesi (Excel)
   - Randevu raporu (PDF)

---

## 🔐 İzinler Sistemi

### Rol Türleri

#### 👑 Super Admin
- **Tüm izinlere sahip**
- Admin oluşturabilir/silebilir
- İzin yönetimi yapabilir
- Sistem bakımı ve yedekleme

#### 🔑 Admin
- **Yapılandırılabilir izinler**
- Varsayılan olarak sınırlı
- Super Admin tarafından izin verilebilir

#### ⚙️ Moderator
- **Temel yönetim izinleri**
- Kullanıcı ve berber moderasyonu
- Rapor görüntüleme

### İzin Kategorileri

| Kategori | İzinler |
|----------|---------|
| **Kullanıcılar** | view, create, edit, delete, ban |
| **Berberler** | view, create, edit, delete, approve, suspend |
| **Randevular** | view, cancel, modify |
| **Raporlar** | view, export |
| **Sistem** | logs, maintenance, backup |

---

## 🔌 API Endpoints

### Authentication

```
POST /api/admin/login
Body: { email, password }
Response: { token, admin }
```

### Dashboard

```
GET /api/admin/dashboard/stats
Headers: { Authorization: Bearer <token> }
Response: { stats: {...} }
```

### Müşteriler

```
GET /api/admin/customers?page=1&limit=20
GET /api/admin/customers/:id
POST /api/admin/customers/ban
  Body: { customerId, reason }
```

### Berberler

```
GET /api/admin/barbers?page=1&limit=20
GET /api/admin/barbers/:id
POST /api/admin/barbers/approve
  Body: { barberId }
POST /api/admin/barbers/suspend
  Body: { barberId, reason }
```

### Randevular

```
GET /api/admin/appointments?page=1&limit=20
POST /api/admin/appointments/cancel
  Body: { appointmentId, reason }
```

### Raporlar

```
GET /api/admin/reports/revenue
GET /api/admin/activity-log
```

### Adminler (Super Admin)

```
GET /api/admin/admins
POST /api/admin/admins/create
  Body: { email, password, name, surname, role }
PUT /api/admin/admins/permissions
  Body: { adminId, permissions }
DELETE /api/admin/admins/:id
```

---

## 🔒 Güvenlik Notları

1. **Şifre**: En az 8 karakter, güçlü şifre kullan
2. **Token**: JWT token 7 gün geçerli
3. **Rate Limiting**: Başarısız 5 giriş = 30 dakika kilit
4. **Aktivite Günlüğü**: Tüm işlemler kaydedilir
5. **IP Adresi**: Giriş bilgileriyle kaydedilir

---

## ⚙️ Troubleshooting

### "Yetkisiz Erişim" Hatası
- Token'ın geçerli olup olmadığını kontrol et
- Browser'ın localStorage'ında token bulunup bulunmadığını kontrol et
- Yeniden giriş yap

### "İzniniz Yok" Hatası
- Super Admin tarafından izin verildiğinden emin ol
- Kullanıcı rolünü kontrol et
- İzinleri güncelle

### Sayfalar Yüklenmüyor
- Backend API'nin çalışıp çalışmadığını kontrol et
- Network bağlantısını kontrol et
- Browser console'da hataları kontrol et

---

## 📞 Destek

Sorular veya sorunlar için:
- Email: support@berbergo.com
- WhatsApp: +90 535 XXX XX XX

---

**Version**: 1.0
**Last Updated**: 28 Nisan 2026
**Developer**: Berbergo Team
