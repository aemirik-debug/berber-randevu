import React, { useState, useEffect } from 'react';
import '../styles/AdminLayout.css';
import axios from 'axios';
import AdminSidebar from '../components/Admin/AdminSidebar';
import AdminHeader from '../components/Admin/AdminHeader';
import DashboardStats from '../components/Admin/DashboardStats';
import CustomerManagement from '../components/Admin/CustomerManagement';
import BarberManagement from '../components/Admin/BarberManagement';
import AppointmentManagement from '../components/Admin/AppointmentManagement';
import AdminManagement from '../components/Admin/AdminManagement';
import ReportsPage from '../components/Admin/ReportsPage';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    setAdminUser(user);
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/dashboard/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data.stats);
    } catch (err) {
      console.error('İstatistikler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin/login';
  };

  return (
    <div className="admin-dashboard">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="admin-main">
        <AdminHeader adminUser={adminUser} onLogout={handleLogout} />
        
        <div className="admin-content">
          {activeTab === 'dashboard' && (
            <DashboardStats stats={stats} loading={loading} onRefresh={fetchDashboardStats} />
          )}
          
          {activeTab === 'customers' && <CustomerManagement />}
          {activeTab === 'barbers' && <BarberManagement />}
          {activeTab === 'appointments' && <AppointmentManagement />}
          {activeTab === 'admins' && <AdminManagement />}
          {activeTab === 'reports' && <ReportsPage />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
