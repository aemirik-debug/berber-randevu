import React, { useState, useEffect } from 'react';
import '../../styles/AdminComponents.css';
import axios from 'axios';

const DashboardStats = ({ stats, loading, onRefresh }) => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📊 Dashboard</h1>
        <button onClick={onRefresh} className="refresh-btn">
          🔄 Yenile
        </button>
      </div>

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : stats ? (
        <div className="stats-grid">
          <StatCard 
            title="Toplam Müşteriler" 
            value={stats.totalCustomers} 
            icon="👥" 
            color="#3498db"
          />
          <StatCard 
            title="Toplam Berberler" 
            value={stats.totalBarbers} 
            icon="✂️" 
            color="#e74c3c"
          />
          <StatCard 
            title="Toplam Randevular" 
            value={stats.totalAppointments} 
            icon="📅" 
            color="#2ecc71"
          />
          <StatCard 
            title="Son 7 Gün" 
            value={stats.appointmentsLast7Days} 
            icon="📈" 
            color="#f39c12"
          />
          <StatCard 
            title="Onaylı Randevular" 
            value={stats.approvedAppointments} 
            icon="✅" 
            color="#27ae60"
          />
          <StatCard 
            title="Beklemede Randevular" 
            value={stats.pendingAppointments} 
            icon="⏳" 
            color="#e67e22"
          />
          <StatCard 
            title="İptal Edilen" 
            value={stats.cancelledAppointments} 
            icon="❌" 
            color="#c0392b"
          />
        </div>
      ) : (
        <div className="error">İstatistikler yüklenemedi</div>
      )}

      <div className="recent-activity">
        <h2>📋 Son Etkinlikler</h2>
        <p>Sistem her bir aksiyonu kaydeder - yöneticiler sadece önemli işlemleri görebilir</p>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => (
  <div className="stat-card" style={{ borderLeftColor: color }}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <h3>{title}</h3>
      <p className="stat-value">{value.toLocaleString('tr-TR')}</p>
    </div>
  </div>
);

export default DashboardStats;
