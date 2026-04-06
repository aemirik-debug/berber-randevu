import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { connectSocket, getSocket } from '../services/socket';

function CustomerHome() {
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('');
  const navigate = useNavigate();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('customerToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getCustomerInfo = () => {
    const raw = localStorage.getItem('customerInfo');
    return raw ? JSON.parse(raw) : null;
  };

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    const customerInfo = getCustomerInfo();
    if (!token || !customerInfo?._id) {
      navigate('/customer/auth', { replace: true });
    }
  }, [navigate]);



  // Müşteri bilgilerini localStorage'dan çek ve state'e ata
  useEffect(() => {
    const customerInfo = getCustomerInfo();
  if (customerInfo) {
    setName(customerInfo.name || '');
    setSurname(customerInfo.surname || '');
    setEmail(customerInfo.email || '');
    setAddress(customerInfo.address || '');
    setPhone(customerInfo.phone || '');
  }
}, []);
// Alert mesajını 3 saniye sonra temizle
useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => {
        setAlertMessage('');
        setAlertType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

// Randevuları çek
useEffect(() => {
  const customerInfo = getCustomerInfo();
  if (customerInfo) {
    axios.get(`http://localhost:5001/api/customers/appointments/${customerInfo._id}`, { headers: getAuthHeaders() })
      .then(res => setAppointments(res.data))
      .catch(err => console.error("Randevular yüklenemedi:", err));

    // socket bağlan ve müşteri kimliğini bildir
    const sock = connectSocket();
    sock.emit('customer_login', customerInfo._id);
    
    const handleAppointmentUpdate = (data) => {
      // status güncellemesi alındı
      console.log('🔔 Socket appointment_update alındı:', data);
      setAppointments(prev => prev.map(a => {
        if (a.date === data.date && a.time === data.time) {
          console.log(`   ✅ Güncellenio: ${a.date} ${a.time} - Status: ${a.status} → ${data.status}`);
          return { ...a, status: data.status };
        }
        return a;
      }));
    };
    
    sock.on('appointment_update', handleAppointmentUpdate);
    
    // Cleanup: component unmount olduğunda listener'ı kaldır
    return () => {
      sock.off('appointment_update', handleAppointmentUpdate);
    };
  }
}, []);

// Faturaları çek
useEffect(() => {
  const customerInfo = getCustomerInfo();
  if (customerInfo) {
    axios.get(`http://localhost:5001/api/customers/invoices/${customerInfo._id}`, { headers: getAuthHeaders() })
      .then(res => setInvoices(res.data))
      .catch(err => console.error(err));
  }
}, []);

// Favorileri çek
useEffect(() => {
  const customerInfo = getCustomerInfo();
  if (customerInfo) {
    axios.get(`http://localhost:5001/api/customers/favorites/${customerInfo._id}`, { headers: getAuthHeaders() })
      .then(res => setFavorites(res.data))
      .catch(err => console.error(err));
  }
}, []);
  // Profil güncelleme
  const handleUpdateProfile = async () => {
    try {
      const customerInfo = getCustomerInfo();
      const res = await axios.put(`http://localhost:5001/api/customers/update/${customerInfo._id}`, {
        name, surname, email, address
      }, { headers: getAuthHeaders() });
      setAlertMessage("Profil bilgileri güncellendi!");
      setAlertType("success");
      localStorage.setItem('customerInfo', JSON.stringify(res.data));
    } catch (err) {
      setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
      setAlertType("danger");
    }
  };
  // Çıkış yap
  const handleLogout = () => {
  localStorage.removeItem('customerInfo');
  localStorage.removeItem('customerToken');
  window.location.href = '/';
};
  // Şifre güncelleme
  const handleChangePassword = async () => {
  try {
    const customerInfo = getCustomerInfo();
    const res = await axios.put(`http://localhost:5001/api/customers/update-password/${customerInfo._id}`, {
      oldPassword, newPassword
    }, { headers: getAuthHeaders() });
    setAlertMessage(res.data.message || "Şifre başarıyla güncellendi!");
    setAlertType("success");
    setOldPassword('');
    setNewPassword('');
  } catch (err) {
    setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
    setAlertType("danger");
  }
};
// Favori ekleme
const handleAddFavorite = async (barber) => {
  try {
    const customerInfo = getCustomerInfo();
    const res = await axios.post(`http://localhost:5001/api/customers/favorites/${customerInfo._id}`, barber, { headers: getAuthHeaders() });
    setFavorites([...favorites, res.data.favorite]);
    setAlertMessage("Favori başarıyla eklendi!");
    setAlertType("success");
  } catch (err) {
    setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
    setAlertType("danger");
  }
};
// Favori silme
const handleRemoveFavorite = async (barberId) => {
  try {
    const customerInfo = getCustomerInfo();
    await axios.delete(`http://localhost:5001/api/customers/favorites/${customerInfo._id}/${barberId}`, { headers: getAuthHeaders() });
    setFavorites(favorites.filter(f => f.barberId !== barberId));
    setAlertMessage("Favori başarıyla silindi!");
    setAlertType("success");
  } catch (err) {
    setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
    setAlertType("danger");
  }
};



  return (
  <div className="container mt-4">
   {/* Üst Menü */}
    <div className="d-flex justify-content-end mb-3">
  <button className="btn btn-success me-2" onClick={() => navigate('/booking')}>
  ➕ Randevu Oluştur
</button>
  <button className="btn btn-danger" onClick={handleLogout}>
    🚪 Çıkış Yap
  </button>
</div>

    {/* Menü */}
    <ul className="nav nav-tabs">
      <li className="nav-item">
        <button className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Profil</button>
      </li>
      <li className="nav-item">
        <button className={`nav-link ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>📅 Randevularım</button>
      </li>
      <li className="nav-item">
        <button className={`nav-link ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>💳 Fatura</button>
      </li>
      <li className="nav-item">
        <button className={`nav-link ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>⭐ Favoriler</button>
      </li>
    </ul>

    {/* İçerik */}
    <div className="card mt-3">
      <div className="card-body">
        {activeTab === 'profile' && (
          <form>
            <h3 className="mb-3">👤 Müşteri Bilgileri</h3>
            <div className="mb-3">
              <label className="form-label">Ad</label>
              <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="mb-3">
              <label className="form-label">Soyad</label>
              <input type="text" className="form-control" value={surname} onChange={e => setSurname(e.target.value)} autoComplete="family-name" />
            </div>
            <div className="mb-3">
              <label className="form-label">E-posta</label>
              <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="mb-3">
              <label className="form-label">Telefon</label>
              <input type="tel" className="form-control" value={phone} readOnly autoComplete="tel" />
            </div>
            <div className="mb-3">
              <label className="form-label">Adres</label>
              <input type="text" className="form-control" value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
            {/* Alert alanı */}
                {alertMessage && (
                  <div className={`alert alert-${alertType}`} role="alert">
                    {alertMessage}
                  </div>
                )}

            <button type="button" className="btn btn-primary" onClick={handleUpdateProfile}>Bilgileri Güncelle</button>

            <hr className="my-4" />

            <h4>🔑 Şifre Değiştir</h4>
            <div className="mb-3">
              <label className="form-label">Eski Şifre</label>
              <input type="password" className="form-control" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="mb-3">
              <label className="form-label">Yeni Şifre</label>
              <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <button type="button" className="btn btn-warning" onClick={handleChangePassword}>Şifreyi Güncelle</button>
          </form>
        )}

       {activeTab === 'appointments' && (
  <div>
    <h3>📅 Randevularım</h3>
    {appointments.length > 0 ? (
      <table className="table table-striped mt-3">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Saat</th>
            <th>Berber</th>
            <th>Hizmet</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {appointments
            .sort((a, b) => {
              // İlk olarak tarihe göre sırala (eski tarihten yeniye)
              const dateCompare = new Date(a.date) - new Date(b.date);
              if (dateCompare !== 0) return dateCompare;
              // Aynı tarihse saate göre sırala
              return a.time.localeCompare(b.time);
            })
            .map(app => (
            <tr key={app._id}>
              <td>{new Date(app.date).toLocaleDateString()}</td>
              <td>{app.time}</td>
              <td>{app.barberName}</td>
              <td>{app.service?.name || '-'}{app.service?.price ? ` (₺${app.service.price})` : ''}</td>
              <td>{
                app.status === 'pending' ? 'Rezervasyon Aşamasında' :
                app.status === 'booked' ? 'Rezervasyon Aşamasında' :
                app.status === 'confirmed' ? 'Onaylandı' :
                app.status === 'cancelled' ? 'İptal Edildi' :
                app.status === 'Randevu Alındı' ? 'Randevu Alındı' : 
                app.status
              }</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="alert alert-info mt-3">
        Henüz randevu oluşturmadınız.
      </div>
    )}
  </div>
)}

        {activeTab === 'invoices' && (
  <div>
    <h3>💳 Faturalarım</h3>
    {invoices.length > 0 ? (
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>Fatura No</th>
            <th>Tarih</th>
            <th>Tutar</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv._id}>
              <td>{inv.invoiceNumber}</td>
              <td>{new Date(inv.date).toLocaleDateString()}</td>
              <td>{inv.amount} ₺</td>
              <td>{inv.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="alert alert-info mt-3">
        Henüz fatura bulunmamaktadır.
      </div>
    )}
  </div>
)}

        {activeTab === 'favorites' && (
  <div>
    <h3>⭐ Favori Berberlerim</h3>
    {alertMessage && (
      <div className={`alert alert-${alertType}`} role="alert">
        {alertMessage}
      </div>
    )}
    {favorites.length > 0 ? (
      <table className="table table-hover mt-3">
        <thead>
          <tr>
            <th>Berber Adı</th>
            <th>İlçe</th>
            <th>Telefon</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {favorites.map(fav => (
            <tr key={fav._id}>
              <td>{fav.barberName}</td>
              <td>{fav.district}</td>
              <td>{fav.phone}</td>
              <td>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFavorite(fav.barberId)}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="alert alert-info mt-3">
        Henüz favori berber eklemediniz.
      </div>
    )}
  </div>
)}

      </div>
    </div>
  </div>
);
}

export default CustomerHome;
