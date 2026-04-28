import React, { useState } from 'react';
import '../styles/AdminLogin.css';
import axios from 'axios';

const AdminLogin = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const url = `${apiBaseUrl}/api/admin/login`;
      console.log('🔐 Admin giriş isteği:', { url, email });
      
      const response = await axios.post(url, { email, password });
      console.log('✅ Giriş başarılı:', response.data);

      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.admin));
        console.log('💾 LocalStorage kaydedildi');
        onLoginSuccess(response.data);
      }
    } catch (err) {
      console.error('❌ Giriş hatası:', err);
      console.error('Response:', err.response?.data);
      setError(err.response?.data?.error || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-box">
        <h1>🔐 Admin Paneli</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@berbergo.com"
            />
          </div>

          <div className="form-group">
            <label>Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
