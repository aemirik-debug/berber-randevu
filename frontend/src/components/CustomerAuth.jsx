import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import { API_URL } from '../services/runtimeConfig';
import 'react-toastify/dist/ReactToastify.css';

function CustomerAuth() {
  const [isRegister, setIsRegister] = useState(true);
  const [showReset, setShowReset] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '' });
  const [resetForm, setResetForm] = useState({ phone: '', newPassword: '', confirmPassword: '' });
  const [resetLoading, setResetLoading] = useState(false);
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

  const handleResetPassword = async () => {
    const { phone, newPassword, confirmPassword } = resetForm;
    if (!phone.trim()) {
      toast.error('Telefon numarası zorunludur', { position: "top-center" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır', { position: "top-center" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor', { position: "top-center" });
      return;
    }

    setResetLoading(true);
    try {
      const res = await axios.post(`${API_URL}/customers/reset-password`, {
        phone: phone.trim(),
        newPassword
      });
      toast.success('✅ ' + res.data.message, { position: "top-center" });
      setShowReset(false);
      setResetForm({ phone: '', newPassword: '', confirmPassword: '' });
      setIsRegister(false);
      setForm({ ...form, phone: phone.trim() });
    } catch (err) {
      toast.error('❌ ' + (err.response?.data?.message || err.message), { position: "top-center" });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center py-5">
      <div className="row w-100 justify-content-center">
        <div className="col-12 col-md-8 col-lg-5 col-xl-4">
          <div className="card shadow border-0 rounded-4 overflow-hidden">
            <div className="card-header bg-primary text-white text-center py-4">
              <h2 className="h4 mb-1">
                {showReset ? 'Şifremi Unuttum' : (isRegister ? 'Kayıt Ol' : 'Giriş Yap')}
              </h2>
              <p className="mb-0 opacity-75">
                {showReset ? 'Yeni şifre belirleyin' : 'Berber randevu hesabına eriş'}
              </p>
            </div>
            <div className="card-body p-4 p-md-5">
              {showReset ? (
                /* ─── Şifre Sıfırlama Formu ─── */
                <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Telefon Numaranız</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="05XX XXX XX XX"
                      value={resetForm.phone}
                      onChange={e => setResetForm({ ...resetForm, phone: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Yeni Şifre</label>
                    <input
                      type="password"
                      className="form-control form-control-lg"
                      placeholder="En az 6 karakter"
                      value={resetForm.newPassword}
                      onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Yeni Şifre Tekrar</label>
                    <input
                      type="password"
                      className="form-control form-control-lg"
                      placeholder="Şifreyi tekrar girin"
                      value={resetForm.confirmPassword}
                      onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                      autoComplete="new-password"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg w-100 fw-semibold" disabled={resetLoading}>
                    {resetLoading ? (
                      <span><span className="spinner-border spinner-border-sm me-2" /> Güncelleniyor...</span>
                    ) : 'Şifremi Güncelle'}
                  </button>
                  <div className="text-center mt-4">
                    <button type="button" className="btn btn-link p-0 align-baseline fw-semibold text-decoration-none" onClick={() => setShowReset(false)}>
                      ← Giriş ekranına dön
                    </button>
                  </div>
                </form>
              ) : (
                /* ─── Normal Login / Register Formu ─── */
                <>
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
                    <div className="mb-3">
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
                    {!isRegister && (
                      <div className="text-end mb-3">
                        <button type="button" className="btn btn-link p-0 text-decoration-none fw-semibold" style={{ fontSize: '0.9rem' }} onClick={() => setShowReset(true)}>
                          Şifremi Unuttum
                        </button>
                      </div>
                    )}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer /> {/* ✅ Bildirimlerin görünmesi için */}
    </div>
  );
}

export default CustomerAuth;