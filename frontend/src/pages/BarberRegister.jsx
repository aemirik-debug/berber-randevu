import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import api from '../services/api';
import citiesData from '../data/turkiye-il-ilce.json'; 
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

function BarberRegister() {
  const [barberType, setBarberType] = useState('male');
  const [salonName, setSalonName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('barberToken');
    const barberId = localStorage.getItem('barberId');
    if (token && barberId) {
      navigate('/barber/dashboard', { replace: true });
    }
  }, [navigate]);

  const getDefaultWorkingHours = () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hours = {};
    days.forEach((day, index) => {
      hours[day] = { isOpen: index < 5, open: '09:00', close: '18:00' };
    });
    return hours;
  };

  const validateForm = () => {
    const newErrors = {};
    if (!salonName.trim()) newErrors.salonName = 'Salon adı gerekli';
    if (!fullName.trim()) newErrors.fullName = 'Ad Soyad gerekli';
    if (!phone.trim()) newErrors.phone = 'Telefon numarası gerekli';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Geçerli e-posta giriniz';
    if (!address.trim()) newErrors.address = 'Adres gerekli';
    if (!city) newErrors.city = 'Şehir seçiniz';
    if (!district) newErrors.district = 'İlçe seçiniz';
    if (!password.trim()) newErrors.password = 'Şifre gerekli';
    else if (password.length < 6) newErrors.password = 'Şifre en az 6 karakter olmalı';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.warning('⚠️ Lütfen tüm alanları doğru şekilde doldurunuz', { position: "top-center" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/barbers/register', {
        barberType, salonName, fullName, phone, email, address, city, district, password,
        workingHours: getDefaultWorkingHours(),
        features: { calendarBooking: true }
      });
      localStorage.setItem('barberToken', res.data.token);
      localStorage.setItem('barberId', res.data.data.id);
      toast.success('🎉 Kayıt başarılı! Hoş geldiniz.', { position: "top-center" });
      setTimeout(() => navigate('/barber/dashboard'), 1500);
    } catch (err) {
      toast.error('❌ ' + (err.response?.data?.error || err.message || 'Kayıt başarısız'), { position: "top-center" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4 mb-5" style={{ maxWidth: '700px' }}>
      <div className="card shadow border-0 rounded-4 overflow-hidden">
        <div className="card-header bg-success bg-gradient text-white py-4">
          <h2 className="mb-0 text-center fw-bold">📝 Berber Kayıt</h2>
        </div>
        <div className="card-body p-4">
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Kuaför Türü</label>
              <select className={`form-select form-select-lg ${errors.barberType ? 'is-invalid' : ''}`} value={barberType} onChange={(e) => setBarberType(e.target.value)}>
                <option value="male">👨 Erkek Kuaförü</option>
                <option value="female">👩 Kadın Kuaförü</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Salon Adı</label>
              <input type="text" className={`form-control form-control-lg ${errors.salonName ? 'is-invalid' : ''}`} placeholder="Salon Adı" value={salonName} onChange={(e) => { setSalonName(e.target.value); if (errors.salonName) setErrors({ ...errors, salonName: '' }); }} />
              {errors.salonName && <div className="invalid-feedback d-block"><small>⚠️ {errors.salonName}</small></div>}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Ad Soyadı</label>
              <input type="text" className={`form-control form-control-lg ${errors.fullName ? 'is-invalid' : ''}`} placeholder="Ad Soyadı" value={fullName} onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors({ ...errors, fullName: '' }); }} />
              {errors.fullName && <div className="invalid-feedback d-block"><small>⚠️ {errors.fullName}</small></div>}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Telefon</label>
              <input type="text" className={`form-control form-control-lg ${errors.phone ? 'is-invalid' : ''}`} placeholder="05XX XXX XXXX" value={phone} onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors({ ...errors, phone: '' }); }} />
              {errors.phone && <div className="invalid-feedback d-block"><small>⚠️ {errors.phone}</small></div>}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">E-posta</label>
              <input type="email" className={`form-control form-control-lg ${errors.email ? 'is-invalid' : ''}`} placeholder="ornek@email.com" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: '' }); }} />
              <small className="text-muted">Opsiyonel: İsterseniz şimdi boş bırakıp profilden daha sonra ekleyebilirsiniz.</small>
              {errors.email && <div className="invalid-feedback d-block"><small>⚠️ {errors.email}</small></div>}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Adres</label>
              <input type="text" className={`form-control form-control-lg ${errors.address ? 'is-invalid' : ''}`} placeholder="Adres" value={address} onChange={(e) => { setAddress(e.target.value); if (errors.address) setErrors({ ...errors, address: '' }); }} />
              {errors.address && <div className="invalid-feedback d-block"><small>⚠️ {errors.address}</small></div>}
            </div>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Şehir</label>
                <select className={`form-select form-select-lg ${errors.city ? 'is-invalid' : ''}`} value={city} onChange={(e) => { setCity(e.target.value); setDistrict(''); if (errors.city) setErrors({ ...errors, city: '' }); }}>
                  <option value="">Şehir Seçiniz</option>
                  {citiesData.map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
                </select>
                {errors.city && <div className="invalid-feedback d-block"><small>⚠️ {errors.city}</small></div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">İlçe</label>
                <select className={`form-select form-select-lg ${errors.district ? 'is-invalid' : ''}`} value={district} onChange={(e) => { setDistrict(e.target.value); if (errors.district) setErrors({ ...errors, district: '' }); }} disabled={!city}>
                  <option value="">İlçe Seçiniz</option>
                  {city && citiesData.find(c => c.name === city)?.districts.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
                {errors.district && <div className="invalid-feedback d-block"><small>⚠️ {errors.district}</small></div>}
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Şifre</label>
              <input type="password" className={`form-control form-control-lg ${errors.password ? 'is-invalid' : ''}`} placeholder="En az 6 karakter" value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }} />
              {errors.password && <div className="invalid-feedback d-block"><small>⚠️ {errors.password}</small></div>}
            </div>
            <button type="submit" className="btn btn-success btn-lg w-100 fw-bold rounded-3" disabled={loading}>
              {loading ? (<><span className="spinner-border spinner-border-sm me-2"></span>Kayıt yapılıyor...</>) : ('✅ Kayıt Ol')}
            </button>
          </form>
          <hr className="my-4" />
          <p className="text-center mb-0"><small className="text-muted">Hesabınız var mı? </small><a href="/barber/login" className="fw-semibold text-success">Giriş Yap</a></p>
        </div>
      </div>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
}
export default BarberRegister;