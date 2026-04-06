import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './CustomerAuth.css';

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
  const res = await axios.post('http://localhost:5001/api/customers/register', {
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
  const res = await axios.post('http://localhost:5001/api/customers/login', {
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
    <div className="auth-container">
      <h2>{isRegister ? 'Kayıt Ol' : 'Giriş Yap'}</h2>
      <form className="auth-form">
        <input
          type="text"
          placeholder="Telefon"
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
        />
        <button type="button" onClick={handleSubmit}>
          {isRegister ? 'Kayıt Ol' : 'Giriş Yap'}
        </button>
      </form>
      <p className="switch-text">
        {isRegister ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?'}{' '}
        <span className="switch-link" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Giriş Yap' : 'Kayıt Ol'}
        </span>
      </p>
      <ToastContainer /> {/* ✅ Bildirimlerin görünmesi için */}
    </div>
  );
}

export default CustomerAuth;