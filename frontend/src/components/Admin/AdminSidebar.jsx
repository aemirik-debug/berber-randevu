import React from 'react';
import '../../styles/AdminLayout.css';

const AdminSidebar = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'customers', label: 'Müşteriler', icon: '👥' },
    { id: 'barbers', label: 'Berberler', icon: '✂️' },
    { id: 'appointments', label: 'Randevular', icon: '📅' },
    { id: 'admins', label: 'Adminler', icon: '🔑' },
    { id: 'reports', label: 'Raporlar', icon: '📈' },
  ];

  return (
    <div className="admin-sidebar">
      <div className="sidebar-header">
        <h2>🔐 BERBERGO</h2>
        <p>Admin Panel</p>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>Admin v1.0</p>
        <p className="system-status">🟢 Aktif</p>
      </div>
    </div>
  );
};

export default AdminSidebar;
