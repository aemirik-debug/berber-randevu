import React from 'react';
import '../../styles/AdminLayout.css';

const AdminHeader = ({ adminUser, onLogout }) => {
  return (
    <div className="admin-header">
      <div className="header-left">
        <h1>📊 Admin Panel</h1>
      </div>

      <div className="header-right">
        <div className="admin-info">
          <div className="avatar">👤</div>
          <div className="user-details">
            <p className="username">{adminUser?.name || 'Admin'}</p>
            <p className="role">
              {adminUser?.role === 'superadmin' ? '👑 Super Admin' :
               adminUser?.role === 'admin' ? '🔑 Admin' :
               '⚙️ Moderator'}
            </p>
          </div>
        </div>

        <button className="btn-logout" onClick={onLogout}>
          🚪 Çıkış
        </button>
      </div>
    </div>
  );
};

export default AdminHeader;
