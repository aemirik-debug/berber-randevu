import React, { useState, useEffect } from 'react';
import '../../styles/AdminComponents.css';
import axios from 'axios';

const AppointmentManagement = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchAppointments();
  }, [page]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/appointments?page=${page}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAppointments(response.data.data);
    } catch (err) {
      console.error('Randevular yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Bu randevu iptal edilecek. Emin misiniz?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const reason = prompt('İptal sebebi:');
      
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/admin/appointments/cancel`,
        { appointmentId, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Randevu başarıyla iptal edildi');
      fetchAppointments();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: '⏳ Beklemede', class: 'status-pending' },
      accepted: { text: '✅ Onaylı', class: 'status-accepted' },
      rejected: { text: '❌ Reddedildi', class: 'status-rejected' },
      cancelled: { text: '🚫 İptal Edildi', class: 'status-cancelled' }
    };
    return badges[status] || { text: status, class: '' };
  };

  return (
    <div className="management-container">
      <h1>📅 Randevu Yönetimi</h1>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Randevu ID</th>
                <th>Müşteri</th>
                <th>Berber</th>
                <th>Hizmet</th>
                <th>Tarih & Saat</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((apt) => {
                const badge = getStatusBadge(apt.status);
                return (
                  <tr key={apt._id}>
                    <td>#{apt._id.substring(0, 8)}</td>
                    <td>{apt.customerPhone}</td>
                    <td>{apt.barberName}</td>
                    <td>{apt.service?.name}</td>
                    <td>
                      {apt.date} {apt.time}
                    </td>
                    <td>
                      <span className={`status ${badge.class}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td>
                      {apt.status === 'pending' && (
                        <button 
                          className="btn-danger"
                          onClick={() => handleCancelAppointment(apt._id)}
                        >
                          ❌ İptal Et
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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

export default AppointmentManagement;
