import React, { useState, useEffect } from 'react';
import '../../styles/AdminComponents.css';
import axios from 'axios';

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/customers?page=${page}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCustomers(response.data.data);
    } catch (err) {
      console.error('Müşteriler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBanCustomer = async (customerId) => {
    if (!window.confirm('Bu müşteri yasaklanacak. Emin misiniz?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const reason = prompt('Yasaklama sebebi:');
      
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/admin/customers/ban`,
        { customerId, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Müşteri başarıyla yasaklandı');
      fetchCustomers();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="management-container">
      <h1>👥 Müşteri Yönetimi</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Müşteri ara (telefon, isim)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Telefon</th>
                <th>İsim Soyisim</th>
                <th>Email</th>
                <th>Randevu Sayısı</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id}>
                  <td>{customer.phone}</td>
                  <td>{customer.name} {customer.surname}</td>
                  <td>{customer.email}</td>
                  <td>{customer.appointments?.length || 0}</td>
                  <td>{new Date(customer.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <button 
                      className="btn-danger"
                      onClick={() => handleBanCustomer(customer._id)}
                    >
                      🚫 Yasakla
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
          ← Önceki
        </button>
        <span>Sayfa {page}</span>
        <button onClick={() => setPage(p => p + 1)}>
          Sonraki →
        </button>
      </div>
    </div>
  );
};

export default CustomerManagement;
