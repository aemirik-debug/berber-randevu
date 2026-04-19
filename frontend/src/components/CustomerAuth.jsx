import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import { API_URL } from '../services/runtimeConfig';
import 'react-toastify/dist/ReactToastify.css';

function CustomerAuth() {
  const [isRegister, setIsRegister] = useState(true);
  const [form, setForm] = useState({ phone: '', password: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    const customerInfo = localStorage.getItem('customerInfo');
    if (token && customerInfo) {
      navigate('/customer/home', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async () => {
    try {
      if (isRegister) {
  const res = await axios.post(`${API_URL}/customers/register`, {
    phone: form.phone,
    password: form.password
  });
  toast.success('🎉 Kayıt başarılı! Hoş geldiniz.', { position: "top-center" });
  setTimeout(() => {
    localStorage.setItem('customerToken', res.data.token);
    localStorage.setItem('customerInfo', JSON.stringify(res.data.customer));
    navigate('/customer/home');
  }, 1500);
} else {
  const res = await axios.post(`${API_URL}/customers/login`, {
    phone: form.phone,
    password: form.password
  });
  toast.success('✅ Giriş başarılı! Tekrar hoş geldiniz.', { position: "top-center" });
  setTimeout(() => {
    localStorage.setItem('customerToken', res.data.token);
    localStorage.setItem('customerInfo', JSON.stringify(res.data.customer));
    navigate('/customer/home');
  }, 1500);
}
    } catch (err) {
      toast.error('❌ Hata: ' + (err.response?.data?.message || err.message), { position: "top-center" });
    }
  };

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center py-5">
      <div className="row w-100 justify-content-center">
        <div className="col-12 col-md-8 col-lg-5 col-xl-4">
          <div className="card shadow border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-primary text-white text-center py-4">
              <h2 className="h4 mb-1">{isRegister ? 'Kayıt Ol' : 'Giriş Yap'}</h2>
              <p className="mb-0 opacity-75">Berber randevu hesabına eriş</p>
            </div>
            <div className="card-body p-4 p-md-5">
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Telefon</label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    placeholder="Telefon"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold">Şifre</label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    placeholder="Şifre"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-100 fw-semibold">
                  {isRegister ? 'Kayıt Ol' : 'Giriş Yap'}
                </button>
              </form>
              <div className="text-center mt-4 text-muted">
                {isRegister ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?'}{' '}
                <button type="button" className="btn btn-link p-0 align-baseline fw-semibold text-decoration-none" onClick={() => setIsRegister(!isRegister)}>
                  {isRegister ? 'Giriş Yap' : 'Kayıt Ol'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer /> {/* ✅ Bildirimlerin görünmesi için */}
    </div>
  );
}

export default CustomerAuth;