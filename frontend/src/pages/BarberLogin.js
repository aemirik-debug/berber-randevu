import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import api from '../services/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

function BarberLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('barberToken');
    const barberId = localStorage.getItem('barberId');
    if (token && barberId) {
      navigate('/barber/dashboard', { replace: true });
    }
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!phone.trim()) {
      newErrors.phone = 'Telefon numarası gerekli';
    }
    if (!password.trim()) {
      newErrors.password = 'Şifre gerekli';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.warning('⚠️ Lütfen tüm alanları doldurunuz', { position: "top-center" });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/barbers/login', { phone, password });
      localStorage.setItem('barberToken', res.data.token);
      localStorage.setItem('barberId', res.data.data.id);
      toast.success('✅ Giriş başarılı! Yönlendiriliyorsunuz...', { position: "top-center" });
      setTimeout(() => {
        navigate('/barber/dashboard');
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Giriş başarısız';
      toast.error('❌ ' + errorMsg, { position: "top-center" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: '450px' }}>
      <div className="card shadow border-0 rounded-4 overflow-hidden">
        <div className="card-header bg-primary bg-gradient text-white py-4">
          <h2 className="mb-0 text-center fw-bold">
            <span>🔑 Berber Girişi</span>
          </h2>
        </div>
        
        <div className="card-body p-4">
          <form onSubmit={handleLogin}>
            {/* Telefon Alanı */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Telefon Numarası</label>
              <input
                type="text"
                className={`form-control form-control-lg ${errors.phone ? 'is-invalid' : ''}`}
                placeholder="05XX XXX XXXX"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
              />
              {errors.phone && (
                <div className="invalid-feedback d-block mt-2">
                  <small>⚠️ {errors.phone}</small>
                </div>
              )}
            </div>

            {/* Şifre Alanı */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Şifre</label>
              <input
                type="password"
                className={`form-control form-control-lg ${errors.password ? 'is-invalid' : ''}`}
                placeholder="Şifrenizi giriniz"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
              />
              {errors.password && (
                <div className="invalid-feedback d-block mt-2">
                  <small>⚠️ {errors.password}</small>
                </div>
              )}
            </div>

            {/* Giriş Butonu */}
            <button 
              type="submit" 
              className="btn btn-primary btn-lg w-100 fw-bold rounded-3"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Giriş yapılıyor...
                </>
              ) : (
                '🔑 Giriş Yap'
              )}
            </button>
          </form>

          <hr className="my-4" />

          {/* Kayıt Bağlantısı */}
          <p className="text-center mb-0">
            <small className="text-muted">Henüz hesabınız yok mu? </small>
            <a href="/barber/register" className="fw-semibold text-primary text-decoration-none">
              Kayıt Ol
            </a>
          </p>
        </div>
      </div>

      {/* Toast Konteyner */}
      <ToastContainer 
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

export default BarberLogin;
