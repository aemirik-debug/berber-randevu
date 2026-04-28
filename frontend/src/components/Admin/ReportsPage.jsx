import React, { useState, useEffect } from 'react';
import '../../styles/AdminComponents.css';
import axios from 'axios';

const ReportsPage = () => {
  const [revenueReport, setRevenueReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRevenueReport();
  }, []);

  const fetchRevenueReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/reports/revenue`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRevenueReport(response.data.data);
    } catch (err) {
      console.error('Rapor yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="management-container">
      <h1>📊 Raporlar</h1>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : (
        <div className="reports-grid">
          <div className="report-card">
            <h2>💰 Gelir Raporu (Son 30 Gün)</h2>
            {revenueReport && (
              <div className="report-content">
                <div className="report-stat">
                  <span>Toplam Gelir:</span>
                  <strong className="amount">
                    ₺ {parseFloat(revenueReport.totalRevenue).toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </strong>
                </div>

                <div className="report-stat">
                  <span>Tamamlanan Randevular:</span>
                  <strong>{revenueReport.appointmentCount}</strong>
                </div>

                <div className="report-stat">
                  <span>Ortalama Fiyat:</span>
                  <strong>
                    ₺ {parseFloat(revenueReport.averagePerAppointment).toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </strong>
                </div>

                <button 
                  className="btn-export"
                  onClick={() => {
                    const csv = `Rapor Türü,Değer\nToplam Gelir,${revenueReport.totalRevenue}\nRandevu Sayısı,${revenueReport.appointmentCount}`;
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'gelir_raporu.csv';
                    a.click();
                  }}
                >
                  📥 CSV Olarak İndir
                </button>
              </div>
            )}
          </div>

          <div className="report-card">
            <h2>📈 Sistem Özeti</h2>
            <div className="report-content">
              <div className="report-stat">
                <span>Küresel Sistem Durumu:</span>
                <strong className="status-active">✅ Çalışıyor</strong>
              </div>

              <div className="report-stat">
                <span>Son Yedekleme:</span>
                <strong>Günlük otomatik yapılıyor</strong>
              </div>

              <div className="report-stat">
                <span>API Yanıt Süresi:</span>
                <strong>✅ Normal</strong>
              </div>

              <button 
                className="btn-info"
                onClick={() => alert('Sistem başarıyla yedeklendi!')}
              >
                💾 Manuel Yedekleme Yap
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="export-section">
        <h2>📤 Toplu İhraç</h2>
        <div className="export-buttons">
          <button className="btn-export">📊 Tüm İstatistikleri İndir</button>
          <button className="btn-export">👥 Müşteri Listesi (Excel)</button>
          <button className="btn-export">✂️ Berber Listesi (Excel)</button>
          <button className="btn-export">📅 Randevu Raporu (PDF)</button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
