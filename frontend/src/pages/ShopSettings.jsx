import React, { useState, useEffect } from 'react';
import api from '../services/api';
import 'bootstrap/dist/css/bootstrap.min.css';

function ShopSettings() {
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [calendarBooking, setCalendarBooking] = useState(false);
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
        features: { calendarBooking },
        workingHours
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
      });
      showNotification('Dükkan ayarlarınız başarıyla güncellendi! ✅', 'success');
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
          <div className="d-flex align-items-center justify-content-between">
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
            <div className="text-end">
              <span className="badge rounded-pill px-3 py-2 text-white" style={{backgroundColor: '#e74c3c'}}>
                {subscriptionPlan?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Ana İçerik */}
        <div className="col-lg-8">
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
          {/* Plan Bilgisi */}
          <div className="card border-0 shadow-sm rounded-4 mb-4" style={{backgroundColor: '#fff3cd', borderLeft: '4px solid #f39c12'}}>
            <div className="card-body p-4">
              <div className="text-center mb-3">
                <span className="display-3">⭐</span>
              </div>
              <h6 className="fw-bold text-center mb-2" style={{color: '#2c3e50'}}>Abonelik Planı</h6>
              <div className="text-center mb-3">
                <span className="badge rounded-pill px-4 py-2 text-white" 
                      style={{backgroundColor: subscriptionPlan === 'premium' ? '#f39c12' : '#95a5a6'}}>
                  {subscriptionPlan === 'premium' ? '🎯 PREMIUM' : '📦 BASIC'}
                </span>
              </div>
              <hr className="my-3" />
              <div className="small text-muted text-center">
                {subscriptionPlan === 'basic' && (
                  <div>
                    <p className="mb-2">Temel özellikleri kullanıyorsunuz.</p>
                    <p className="text-dark fw-semibold">Takvimli randevu ve diğer özel özellikleri açmak için Premium plana yükseltin.</p>
                  </div>
                )}
                {subscriptionPlan === 'premium' && (
                  <p>Tüm özelliklere erişim sağlamaktasınız. 🎉</p>
                )}
              </div>
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
