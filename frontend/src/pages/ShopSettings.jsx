import React, { useState, useEffect } from 'react';
import api from '../services/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import barberLogoSample from '../assets/barber-logo-sample.svg';

function ShopSettings() {
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [calendarBooking, setCalendarBooking] = useState(false);
  const [businessAddress, setBusinessAddress] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [workingHours, setWorkingHours] = useState({
    monday: { isOpen: false, open: '09:00', close: '17:00' },
    tuesday: { isOpen: false, open: '09:00', close: '17:00' },
    wednesday: { isOpen: false, open: '09:00', close: '17:00' },
    thursday: { isOpen: false, open: '09:00', close: '17:00' },
    friday: { isOpen: false, open: '09:00', close: '17:00' },
    saturday: { isOpen: false, open: '09:00', close: '17:00' },
    sunday: { isOpen: false, open: '09:00', close: '17:00' }
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const dayNames = {
    monday: 'Pazartesi',
    tuesday: 'Salı',
    wednesday: 'Çarşamba',
    thursday: 'Perşembe',
    friday: 'Cuma',
    saturday: 'Cumartesi',
    sunday: 'Pazar'
  };

  const dayEmojis = {
    monday: '🔵',
    tuesday: '🟣',
    wednesday: '🟠',
    thursday: '🔴',
    friday: '🟡',
    saturday: '🟢',
    sunday: '⚫'
  };

  // Profil bilgilerini backend'den çek
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/barbers/profile', {
          headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
        });
        const data = res.data;
        setSubscriptionPlan(data.subscription?.plan || 'basic');
        setCalendarBooking(data.features?.calendarBooking || false);
        setBusinessAddress(data.address || '');
        setFacebookUrl(data.facebookUrl || '');
        setInstagramUrl(data.instagramUrl || '');
        setLogoUrl(data.logoUrl || '');
        if (data.workingHours) setWorkingHours(data.workingHours);
      } catch (err) {
        showNotification('Ayarlar yüklenemedi', 'error');
      }
    };
    fetchProfile();
  }, []);

  const showNotification = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/barbers/profile', {
        address: businessAddress,
        facebookUrl,
        instagramUrl,
        logoUrl,
        features: { calendarBooking },
        workingHours
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
      });
      showNotification('Mağaza ayarlarınız başarıyla güncellendi! ✅', 'success');
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    }
  };

  const toggleAllDays = (isOpen) => {
    const updated = Object.keys(workingHours).reduce((acc, day) => {
      acc[day] = { ...workingHours[day], isOpen };
      return acc;
    }, {});
    setWorkingHours(updated);
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showNotification('Lütfen geçerli bir görsel dosyası seçin', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result || ''));
    };
    reader.onerror = () => {
      showNotification('Logo okunamadı', 'error');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container-fluid py-4 px-4">
      {/* Toast Notification */}
      <div className="position-fixed top-0 start-50 translate-middle-x p-3" style={{ zIndex: 1050 }}>
        <div className={`toast align-items-center text-white border-0 ${showToast ? 'show' : ''}`} 
             style={{backgroundColor: toastType === 'success' ? '#27ae60' : '#e74c3c'}}>
          <div className="d-flex">
            <div className="toast-body fw-semibold">
              {toastMessage}
            </div>
            <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setShowToast(false)}></button>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex align-items-start justify-content-between gap-3">
            <div className="d-flex align-items-center">
              <div className="rounded-circle d-flex align-items-center justify-content-center me-3 shadow-sm" 
                   style={{width: '60px', height: '60px', backgroundColor: '#f39c12'}}>
                <span className="fs-2">⚙️</span>
              </div>
              <div>
                <h3 className="fw-bold mb-0" style={{color: '#2c3e50'}}>Dükkan Ayarları</h3>
                <p className="text-muted mb-0">Çalışma saatleri ve hizmet ayarlarını yönetin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Ana İçerik */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white border-bottom py-3">
              <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>
                <span className="me-2">🏪</span>İşletme Bilgileri
              </h5>
            </div>
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-12">
                  <div className="d-flex align-items-center gap-3 p-3 rounded-4 border" style={{background: 'linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)'}}>
                    <div className="flex-shrink-0">
                      <div className="rounded-circle d-flex align-items-center justify-content-center shadow-sm overflow-hidden" style={{width: '72px', height: '72px', backgroundColor: '#f3f4f6'}}>
                        <img
                          src={logoUrl || barberLogoSample}
                          alt="Salon logosu"
                          style={{width: '100%', height: '100%', objectFit: 'cover'}}
                          onError={(event) => {
                            event.currentTarget.src = barberLogoSample;
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <div>
                          <label className="form-label fw-semibold mb-1">Salon Logosu</label>
                          <div className="text-muted small">Yüklerseniz müşteri ekranlarında ve rezervasyon akışında bu logo görünür. Yüklemezseniz varsayılan makas logosu kullanılır.</div>
                        </div>
                        <div className="d-flex gap-2 align-items-center">
                          <input
                            type="file"
                            className="form-control form-control-sm"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            style={{maxWidth: '260px'}}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setLogoUrl('')}
                          >
                            Varsayılana Dön
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="d-flex align-items-center gap-3 p-3 rounded-4 border mb-2" style={{background: 'linear-gradient(135deg, #fffaf0 0%, #ffffff 100%)'}}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: '48px', height: '48px', backgroundColor: '#fff3cd'}}>
                      <span className="fs-4">📍</span>
                    </div>
                    <div className="flex-grow-1">
                      <label className="form-label fw-semibold mb-1">Açık Adres</label>
                      <textarea
                        className="form-control border-0 bg-light"
                        rows={3}
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="Mahalle, cadde, sokak, bina no, kat, daire bilgilerini yazın"
                      />
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-3 p-3 rounded-4 border h-100" style={{background: 'linear-gradient(135deg, #eef7ff 0%, #ffffff 100%)'}}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: '48px', height: '48px', backgroundColor: '#dbeafe'}}>
                      <span className="fs-4">📘</span>
                    </div>
                    <div className="flex-grow-1">
                      <label className="form-label fw-semibold mb-1">Facebook Adresi</label>
                      <input
                        type="url"
                        className="form-control border-0 bg-light"
                        value={facebookUrl}
                        onChange={(e) => setFacebookUrl(e.target.value)}
                        placeholder="https://facebook.com/..."
                      />
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-3 p-3 rounded-4 border h-100" style={{background: 'linear-gradient(135deg, #fff0f8 0%, #ffffff 100%)'}}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{width: '48px', height: '48px', backgroundColor: '#fce7f3'}}>
                      <span className="fs-4">📷</span>
                    </div>
                    <div className="flex-grow-1">
                      <label className="form-label fw-semibold mb-1">Instagram Adresi</label>
                      <input
                        type="url"
                        className="form-control border-0 bg-light"
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        placeholder="https://instagram.com/..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white border-bottom py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>
                  <span className="me-2">🕐</span>Haftalık Çalışma Saatleri
                </h5>
                <button 
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => toggleAllDays(true)}>
                  Hepsini Aç
                </button>
                <button 
                  type="button"
                  className="btn btn-sm btn-outline-secondary ms-2"
                  onClick={() => toggleAllDays(false)}>
                  Hepsini Kapat
                </button>
              </div>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleUpdate}>
                <div className="table-responsive mb-4">
                  <table className="table table-hover">
                    <thead>
                      <tr style={{backgroundColor: '#f8f9fa'}}>
                        <th className="text-muted small text-uppercase fw-semibold">Gün</th>
                        <th className="text-muted small text-uppercase fw-semibold">Açık/Kapalı</th>
                        <th className="text-muted small text-uppercase fw-semibold">Açılış Saati</th>
                        <th className="text-muted small text-uppercase fw-semibold">Kapanış Saati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(workingHours).map(([day, cfg]) => (
                        <tr key={day} style={{borderBottom: '1px solid #e9ecef'}}>
                          <td className="fw-semibold" style={{color: '#2c3e50'}}>
                            <span className="me-2">{dayEmojis[day]}</span>
                            {dayNames[day]}
                          </td>
                          <td>
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`day-${day}`}
                                checked={cfg.isOpen}
                                onChange={e => setWorkingHours(prev => ({
                                  ...prev,
                                  [day]: { ...prev[day], isOpen: e.target.checked }
                                }))}
                              />
                              <label className="form-check-label" htmlFor={`day-${day}`}>
                                {cfg.isOpen ? '✅ Açık' : '❌ Kapalı'}
                              </label>
                            </div>
                          </td>
                          <td>
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              value={cfg.open}
                              disabled={!cfg.isOpen}
                              onChange={e => setWorkingHours(prev => ({
                                ...prev,
                                [day]: { ...prev[day], open: e.target.value }
                              }))}
                              style={{maxWidth: '120px'}}
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              value={cfg.close}
                              disabled={!cfg.isOpen}
                              onChange={e => setWorkingHours(prev => ({
                                ...prev,
                                [day]: { ...prev[day], close: e.target.value }
                              }))}
                              style={{maxWidth: '120px'}}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Takvimli Randevu Özelliği */}
                <hr className="my-4" />
                <div className="row align-items-center mb-4 p-3 bg-light rounded-3">
                  <div className="col-md-8">
                    <h6 className="fw-bold mb-1" style={{color: '#2c3e50'}}>📅 Takvimli Randevu Sistemi</h6>
                    <p className="text-muted small mb-0">
                      Müşterilerinizin takvim üzerinden randevu almasını sağlayın. 
                      {subscriptionPlan !== 'basic' && ' Bu özellik aktif.'}
                      {subscriptionPlan === 'basic' && ' Bu özelliği kullanmak için Premium plana yükseltiniz.'}
                    </p>
                  </div>
                  <div className="col-md-4 text-md-end">
                    <div className="form-check form-switch">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="calendarSwitch"
                        checked={calendarBooking}
                        onChange={e => {
                          const val = e.target.checked;
                          if (val && subscriptionPlan === 'basic') {
                            showNotification('Bu özelliği kullanmak için Premium plana yükseltiniz.', 'error');
                            return;
                          }
                          setCalendarBooking(val);
                        }}
                        disabled={subscriptionPlan === 'basic'}
                      />
                      <label className="form-check-label" htmlFor="calendarSwitch">
                        {calendarBooking ? '✅ Aktif' : '❌ Pasif'}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bilgilendirici Kutu */}
                <div className="alert alert-info border rounded-3 mb-4" style={{backgroundColor: '#d1ecf1', borderColor: '#bee5eb'}}>
                  <small style={{color: '#0c5460'}}>
                    <span className="me-2">💡</span>
                    <strong>İpucu:</strong> Çalışma saatleri dışında müşteriler randevu alamaz. Hafta sonu için de saatleri belirtmeniz önerilir.
                  </small>
                </div>

                <div className="d-flex gap-2">
                  <button 
                    type="submit" 
                    className="btn btn-lg text-white rounded-3 fw-semibold shadow-sm flex-grow-1"
                    style={{backgroundColor: '#f39c12', border: 'none'}}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#e67e22'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#f39c12'}>
                    <span className="me-2">💾</span>
                    Ayarları Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>

        {/* Sağ Sidebar */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 mb-4" style={{backgroundColor: '#f8fbff', borderLeft: '4px solid #3498db'}}>
            <div className="card-body p-4">
              <h6 className="fw-bold mb-2" style={{color: '#2c3e50'}}>İşletme Vitrini</h6>
              <p className="text-muted small mb-0">
                Açık adres ve sosyal medya bağlantıları müşterilerin salonunuza daha hızlı ulaşmasını sağlar.
              </p>
            </div>
          </div>

          {/* Hızlı İstatistik */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="mb-0 fw-bold">Hızlı Bilgi</h6>
            </div>
            <div className="card-body p-4">
              <div className="mb-4 p-3 bg-light rounded-3">
                <small className="text-muted d-block mb-1">📊 Açık Günler</small>
                <span className="fs-5 fw-bold" style={{color: '#27ae60'}}>
                  {Object.values(workingHours).filter(h => h.isOpen).length}/7
                </span>
              </div>
              <div className="mb-4 p-3 bg-light rounded-3">
                <small className="text-muted d-block mb-1">📅 Takvim Sistemi</small>
                <span className="badge rounded-pill" style={{backgroundColor: calendarBooking ? '#27ae60' : '#95a5a6'}}>
                  {calendarBooking ? '✅ Aktif' : '❌ Pasif'}
                </span>
              </div>
              <div className="p-3 bg-light rounded-3">
                <small className="text-muted d-block mb-1">🔐 Plan Türü</small>
                <span className="badge rounded-pill" 
                      style={{backgroundColor: subscriptionPlan === 'premium' ? '#f39c12' : '#95a5a6'}}>
                  {subscriptionPlan?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShopSettings;
