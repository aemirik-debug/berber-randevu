import React, { useState, useEffect } from 'react';
import api from '../services/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import citiesData from '../data/turkiye-il-ilce.json';

function BarberProfile() {
  const [barberType, setBarberType] = useState('');
  const [salonName, setSalonName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [activeSection, setActiveSection] = useState('info');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Profil bilgilerini backend'den çek
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/barbers/profile', {
          headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
        });
        const data = res.data;
        setBarberType(data.barberType);
        setSalonName(data.salonName);
        setFullName(data.name);
        setPhone(data.phone);
        setEmail(data.email);
        setAddress(data.address);
        setCity(data.city);
        setDistrict(data.district);
        setSubscriptionPlan(data.subscription?.plan || 'basic');
      } catch (err) {
        showNotification(err.response?.data?.error || err.message, 'error');
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
        barberType,
        salonName,
        name: fullName,
        phone,
        email,
        address,
        city,
        district
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
      });
      showNotification('Profil bilgileriniz başarıyla güncellendi! ✅', 'success');
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification('Lütfen tüm şifre alanlarını doldurun', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('Yeni şifreler eşleşmiyor', 'error');
      return;
    }
    try {
      await api.patch('/barbers/profile/password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` } }
      );
      showNotification('Şifreniz başarıyla değiştirildi! 🔒');
      // temizle
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showNotification(err.response?.data?.error || err.message, 'error');
    }
  };

  return (
    <div className="container-fluid py-4 px-0">
      {/* Toast Notification - Fixed Top */}
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

      {/* Navigation Tabs */}
      <div className="px-4 mb-4">
        <ul className="nav nav-pills">
          <li className="nav-item me-2">
            <button 
              className={`nav-link rounded-pill px-4 ${activeSection === 'info' ? 'active text-white' : 'text-dark'}`}
              onClick={() => setActiveSection('info')}
              style={activeSection === 'info' ? {backgroundColor: '#3498db'} : {}}>
              <span className="me-2">👤</span>Temel Bilgiler
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link rounded-pill px-4 ${activeSection === 'security' ? 'active text-white' : 'text-dark'}`}
              onClick={() => setActiveSection('security')}
              style={activeSection === 'security' ? {backgroundColor: '#3498db'} : {}}>
              <span className="me-2">🔒</span>Güvenlik
            </button>
          </li>
        </ul>
      </div>

      {/* Content Area */}
      {activeSection === 'info' && (
        <div className="row px-4">
          {/* Sol Kolon - Temel Bilgiler */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>
                  <span className="me-2">🏢</span>Salon ve Kontakt Bilgileri
                </h5>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleUpdate}>
                  <div className="row g-4">
                    {/* Kuaför Türü */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">Kuaför Türü</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#3498db'}}>✂️</span>
                        </span>
                        <select 
                          className="form-select border-start-0 ps-0"
                          value={barberType}
                          onChange={(e) => setBarberType(e.target.value)}>
                          <option value="male">Erkek Kuaförü</option>
                          <option value="female">Kadın Kuaförü</option>
                        </select>
                      </div>
                    </div>

                    {/* Salon Adı */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">Salon Adı</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#3498db'}}>🏪</span>
                        </span>
                        <input 
                          type="text" 
                          className="form-control border-start-0 ps-0" 
                          placeholder="Kuaför Salonu Adı"
                          value={salonName}
                          onChange={(e) => setSalonName(e.target.value)}/>
                      </div>
                    </div>

                    {/* Yetkili Adı */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">Yetkili Ad Soyad</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#3498db'}}>👤</span>
                        </span>
                        <input 
                          type="text" 
                          className="form-control border-start-0 ps-0" 
                          placeholder="Adı Soyadı"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}/>
                      </div>
                    </div>

                    {/* Telefon - Değiştirilemez */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">Telefon</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#95a5a6'}}>📱</span>
                        </span>
                        <input 
                          type="text" 
                          className="form-control border-start-0 ps-0 bg-light" 
                          value={phone}
                          disabled
                          style={{cursor: 'not-allowed'}}/>
                        <span className="input-group-text bg-light border-start-0">
                          <i className="bi bi-lock-fill text-muted"></i>
                        </span>
                      </div>
                      <small className="text-muted">Telefon numarası değiştirilemez</small>
                    </div>

                    {/* Email - Değiştirilemez */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">E-Posta</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#95a5a6'}}>✉️</span>
                        </span>
                        <input 
                          type="email" 
                          className="form-control border-start-0 ps-0 bg-light" 
                          value={email}
                          disabled
                          style={{cursor: 'not-allowed'}}/>
                        <span className="input-group-text bg-light border-start-0">
                          <i className="bi bi-lock-fill text-muted"></i>
                        </span>
                      </div>
                      <small className="text-muted">E-posta adresi değiştirilemez</small>
                    </div>

                    {/* Adres */}
                    <div className="col-12">
                      <label className="form-label fw-semibold small text-uppercase text-muted">Salon Adresi</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#3498db'}}>📍</span>
                        </span>
                        <input 
                          type="text" 
                          className="form-control border-start-0 ps-0" 
                          placeholder="Açık adres"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}/>
                      </div>
                    </div>

                    {/* Şehir */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">Şehir</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#3498db'}}>🌆</span>
                        </span>
                        <select 
                          className="form-select border-start-0 ps-0"
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            setDistrict('');
                          }}>
                          <option value="">Şehir Seçiniz</option>
                          {citiesData.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* İlçe */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-uppercase text-muted">İlçe</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <span style={{color: '#3498db'}}>📮</span>
                        </span>
                        <select 
                          className="form-select border-start-0 ps-0"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          disabled={!city}>
                          <option value="">İlçe Seçiniz</option>
                          {city && citiesData.find(c => c.name === city)?.districts.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-info border rounded-3 mt-4 mb-4" style={{backgroundColor: '#d1ecf1', borderColor: '#bee5eb'}}>
                    <small style={{color: '#0c5460'}}>
                      <span className="me-2">💡</span>
                      <strong>İpucu:</strong> Çalışma saatleri ve takvim özelliği için <strong>"Dükkan Ayarları"</strong> sekmesini kullanın.
                    </small>
                  </div>

                  <div className="mt-4 pt-3 border-top">
                    <button 
                      type="submit" 
                      className="btn btn-lg text-white rounded-3 fw-semibold shadow-sm"
                      style={{backgroundColor: '#3498db', minWidth: '200px'}}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#2980b9'}
                      onMouseOut={(e) => e.target.style.backgroundColor = '#3498db'}>
                      <span className="me-2">💾</span>
                      Değişiklikleri Kaydet
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Sağ Kolon - Özet Kartları */}
          <div className="col-lg-4">
            {/* Profil Özet Kartı */}
            <div className="card border-0 shadow-sm rounded-4 mb-4" style={{backgroundColor: '#ecf0f1'}}>
              <div className="card-body p-4 text-center">
                <div className="mb-3">
                  <span className="display-4">👤</span>
                </div>
                <h5 className="fw-bold mb-1" style={{color: '#2c3e50'}}>{fullName || 'İsimsiz Kullanıcı'}</h5>
                <p className="text-muted mb-3">{salonName || 'Salon Adı Belirtilmemiş'}</p>
                <div className="d-grid gap-2">
                  <div className="d-flex justify-content-between align-items-center p-2 bg-white rounded-3">
                    <span className="text-muted small">Plan</span>
                    <span className="badge" style={{backgroundColor: subscriptionPlan === 'premium' ? '#f39c12' : '#95a5a6'}}>
                      {subscriptionPlan?.toUpperCase()}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center p-2 bg-white rounded-3">
                    <span className="text-muted small">Üyelik</span>
                    <span className="small fw-semibold">✅ Aktif</span>
                  </div>
                </div>
              </div>
            </div>

            {/* İletişim Bilgileri Kartı */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-header bg-white border-bottom py-3">
                <h6 className="mb-0 fw-bold">İletişim Bilgileri</h6>
              </div>
              <div className="card-body p-3">
                <div className="d-flex align-items-center mb-3 p-2 bg-light rounded-3">
                  <span className="me-3 fs-5" style={{color: '#95a5a6'}}>📱</span>
                  <div>
                    <small className="text-muted d-block">Telefon</small>
                    <span className="fw-semibold">{phone}</span>
                  </div>
                </div>
                <div className="d-flex align-items-center p-2 bg-light rounded-3">
                  <span className="me-3 fs-5" style={{color: '#95a5a6'}}>✉️</span>
                  <div>
                    <small className="text-muted d-block">E-Posta</small>
                    <span className="fw-semibold">{email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Konum Bilgisi */}
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-header bg-white border-bottom py-3">
                <h6 className="mb-0 fw-bold">Konum Bilgileri</h6>
              </div>
              <div className="card-body p-3">
                <div className="d-flex align-items-center p-2 bg-light rounded-3 mb-2">
                  <span className="me-3 fs-5" style={{color: '#95a5a6'}}>🌆</span>
                  <div>
                    <small className="text-muted d-block">Şehir/İlçe</small>
                    <span className="fw-semibold">{city && district ? `${city} / ${district}` : 'Seçilmemiş'}</span>
                  </div>
                </div>
                <div className="d-flex align-items-center p-2 bg-light rounded-3">
                  <span className="me-3 fs-5" style={{color: '#95a5a6'}}>📍</span>
                  <div>
                    <small className="text-muted d-block">Adres</small>
                    <span className="fw-semibold text-truncate">{address || 'Belirtilmemiş'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Güvenlik Sekmesi - Şifre Değiştirme */}
      {activeSection === 'security' && (
        <div className="row justify-content-center px-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>
                  <span className="me-2">🔒</span>Şifre Değiştir
                </h5>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handlePasswordChange}>
                  <div className="mb-4">
                    <label className="form-label fw-semibold small text-uppercase text-muted">Mevcut Şifre</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <span style={{color: '#e74c3c'}}>🔑</span>
                      </span>
                      <input 
                        type="password" 
                        className="form-control border-start-0 ps-0" 
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)} />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold small text-uppercase text-muted">Yeni Şifre</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <span style={{color: '#27ae60'}}>🔐</span>
                      </span>
                      <input 
                        type="password" 
                        className="form-control border-start-0 ps-0" 
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <small className="text-muted mt-2 d-block">En az 6 karakter içermeli</small>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold small text-uppercase text-muted">Yeni Şifre Tekrar</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <span style={{color: '#27ae60'}}>🔐</span>
                      </span>
                      <input 
                        type="password" 
                        className="form-control border-start-0 ps-0" 
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)} />
                    </div>
                  </div>

                  <div className="alert alert-light border rounded-3 mb-4">
                    <small className="text-muted">
                      <span className="me-2">💡</span>
                      Şifrenizi düzenli olarak değiştirmeniz hesabınızın güvenliği için çok önemlidir.
                    </small>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-lg w-100 text-white rounded-3 fw-semibold shadow-sm"
                    style={{backgroundColor: '#27ae60', border: 'none'}}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#229954'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#27ae60'}>
                    <span className="me-2">🔄</span>
                    Şifreyi Güncelle
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarberProfile;