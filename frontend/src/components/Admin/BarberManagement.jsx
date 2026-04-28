import React, { useState, useEffect } from 'react';
import '../../styles/AdminComponents.css';
import axios from 'axios';

const BarberManagement = () => {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchBarbers();
  }, [page]);

  const fetchBarbers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/barbers?page=${page}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBarbers(response.data.data);
    } catch (err) {
      console.error('Berberler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBarber = async (barberId) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/admin/barbers/approve`,
        { barberId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Berber onaylandı');
      fetchBarbers();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSuspendBarber = async (barberId) => {
    if (!window.confirm('Bu berber askıya alınacak. Emin misiniz?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const reason = prompt('Askıya alma sebebi:');
      
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/admin/barbers/suspend`,
        { barberId, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Berber askıya alındı');
      fetchBarbers();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="management-container">
      <h1>✂️ Berber Yönetimi</h1>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Salon Adı</th>
                <th>İletişim Kişi</th>
                <th>Şehir</th>
                <th>Durum</th>
                <th>Hizmet Sayısı</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {barbers.map((barber) => (
                <tr key={barber._id}>
                  <td><strong>{barber.salonName}</strong></td>
                  <td>{barber.name}</td>
                  <td>{barber.city}</td>
                  <td>
                    <span className={`status ${barber.isApproved ? 'approved' : 'pending'}`}>
                      {barber.isApproved ? '✅ Onaylı' : '⏳ Beklemede'}
                    </span>
                  </td>
                  <td>{barber.services?.length || 0}</td>
                  <td>
                    {!barber.isApproved && (
                      <button 
                        className="btn-success"
                        onClick={() => handleApproveBarber(barber._id)}
                      >
                        ✅ Onayla
                      </button>
                    )}
                    <button 
                      className="btn-danger"
                      onClick={() => handleSuspendBarber(barber._id)}
                    >
                      ⏸️ Askıya Al
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

export default BarberManagement;
