import React, { useState, useEffect } from 'react';
import '../../styles/AdminComponents.css';
import axios from 'axios';

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    surname: '',
    role: 'admin'
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/admins`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAdmins(response.data.data);
    } catch (err) {
      console.error('Adminler yüklenemedi:', err);
      alert('Yalnızca Super Admin bu işlemi yapabilir');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/admin/admins/create`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Admin başarıyla oluşturuldu');
      setFormData({ email: '', password: '', name: '', surname: '', role: 'admin' });
      setShowCreateForm(false);
      fetchAdmins();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm('Bu admin silinecek. Emin misiniz?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/admin/admins/${adminId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Admin silindi');
      fetchAdmins();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="management-container">
      <div className="header-with-btn">
        <h1>🔑 Admin Yönetimi</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '❌ Kapat' : '➕ Yeni Admin'}
        </button>
      </div>

      {showCreateForm && (
        <form className="admin-form" onSubmit={handleCreateAdmin}>
          <div className="form-row">
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
            <input
              type="password"
              placeholder="Şifre"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className="form-row">
            <input
              type="text"
              placeholder="İsim"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
            <input
              type="text"
              placeholder="Soyisim"
              value={formData.surname}
              onChange={(e) => setFormData({...formData, surname: e.target.value})}
            />
          </div>

          <div className="form-row">
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
            >
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="superadmin">Super Admin</option>
            </select>
            <button type="submit" className="btn-success">✅ Oluştur</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>İsim Soyisim</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Son Giriş</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td>{admin.email}</td>
                  <td>{admin.name} {admin.surname}</td>
                  <td>
                    <span className="role-badge">
                      {admin.role === 'superadmin' ? '👑 Super Admin' : 
                       admin.role === 'admin' ? '🔑 Admin' : '⚙️ Moderator'}
                    </span>
                  </td>
                  <td>
                    <span className={admin.isActive ? 'status-active' : 'status-inactive'}>
                      {admin.isActive ? '✅ Aktif' : '❌ Pasif'}
                    </span>
                  </td>
                  <td>
                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString('tr-TR') : 'Hiç giriş yapılmadı'}
                  </td>
                  <td>
                    <button 
                      className="btn-danger"
                      onClick={() => handleDeleteAdmin(admin._id)}
                    >
                      🗑️ Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
