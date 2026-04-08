import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import BarberProfile from './BarberProfile';
import ShopSettings from './ShopSettings';
import SlotDetailsModal from '../components/SlotDetailsModal';
import CreateManualSlotModal from '../components/CreateManualSlotModal';
import EditSlotModal from '../components/EditSlotModal';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import './BarberShellLayout.css';

function BarberHome() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');
  const [barber, setBarber] = useState({ subscription: { plan: 'basic', expiresAt: new Date() } });
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: '', price: '', duration: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingData, setEditingData] = useState({ name: '', price: '', duration: '' });
  const [serviceMessage, setServiceMessage] = useState({ text: '', type: 'success' });
  const [actionMessage, setActionMessage] = useState({ text: '', type: 'success' });
  const [mySlots, setMySlots] = useState([]);
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSlotDetails, setShowSlotDetails] = useState(false);
  const [slotDetailsData, setSlotDetailsData] = useState(null);
  const [showCreateManualSlot, setShowCreateManualSlot] = useState(false);
  const [selectedSlotForManual, setSelectedSlotForManual] = useState(null);
  const [showEditSlot, setShowEditSlot] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const barberInitials = `${(barber?.name?.[0] || 'B')}${(barber?.surname?.[0] || 'R')}`.toUpperCase();

  const navigationItems = [
    { key: 'home', label: 'Ana Sayfa', icon: '🏠' },
    { key: 'services', label: 'Hizmetler', icon: '✂️', count: services.length },
    { key: 'calendar', label: 'Takvim', icon: '📅' },
    { key: 'stats', label: 'İstatistikler', icon: '📊' },
    { key: 'settings', label: 'Ayarlar', icon: '⚙️' },
  ];

  // Message cleanup
  useEffect(() => {
    if (serviceMessage.text) {
      const t = setTimeout(() => setServiceMessage({ text: '', type: 'success' }), 3000);
      return () => clearTimeout(t);
    }
  }, [serviceMessage]);

  useEffect(() => {
    if (actionMessage.text) {
      const t = setTimeout(() => setActionMessage({ text: '', type: 'success' }), 3000);
      return () => clearTimeout(t);
    }
  }, [actionMessage]);

  // Load profile and services
  useEffect(() => {
    const token = localStorage.getItem('barberToken');
    const barberId = localStorage.getItem('barberId');
    if (!token || !barberId) {
      navigate('/barber/login', { replace: true });
      return;
    }

    const socket = connectSocket();
    socket.emit('barber_login', barberId);

    const fetchAll = async () => {
      try {
        const [profRes, svcRes] = await Promise.all([
          api.get('/barbers/profile'),
          api.get('/barbers/services')
        ]);
        setBarber(profRes.data);
        setServices(svcRes.data.services || []);
      } catch (err) {
        console.error('Veri yükleme hatası', err);
        if (err.response?.status === 401) {
          localStorage.removeItem('barberToken');
          localStorage.removeItem('barberId');
          navigate('/barber/login', { replace: true });
        }
      }
    };
    fetchAll();

    return () => {
      socket.off('customer_reminder');
      disconnectSocket();
    };
  }, [navigate]);

  // Load slots when calendar section is active
  useEffect(() => {
    if (activeSection === 'calendar') {
      (async () => {
        setLoadingSlots(true);
        setSlotsError('');
        try {
          const res = await api.get('/slots/my-slots', { params: { date: slotDate } });
          setMySlots(res.data.data || []);
        } catch (err) {
          const errMsg = err.response?.data?.error || 'Slotlar yüklenemedi';
          setSlotsError(errMsg);
          setMySlots([]);
        } finally {
          setLoadingSlots(false);
        }
      })();
    }
  }, [activeSection, slotDate]);

  const calendarDays = useMemo(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + index);
      return {
        value: currentDate.toISOString().split('T')[0],
        dayName: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(currentDate),
        monthName: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(currentDate),
        dayNumber: new Intl.DateTimeFormat('tr-TR', { day: '2-digit' }).format(currentDate),
      };
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('barberToken');
    localStorage.removeItem('barberId');
    navigate('/barber/login');
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/barbers/services', newService);
      setServices(prev => [...prev, res.data.service]);
      setNewService({ name: '', price: '', duration: '' });
      setServiceMessage({ text: 'Hizmet eklendi', type: 'success' });
    } catch (err) {
      setServiceMessage({ text: err.response?.data?.error || err.message, type: 'error' });
    }
  };

  const startEdit = (svc) => {
    setEditingServiceId(svc._id);
    setEditingData({ name: svc.name, price: svc.price, duration: svc.duration || '' });
  };

  const cancelEdit = () => {
    setEditingServiceId(null);
    setEditingData({ name: '', price: '', duration: '' });
  };

  const handleUpdateService = async (id) => {
    try {
      const res = await api.put(`/barbers/services/${id}`, editingData);
      setServices(prev => prev.map(s => s._id === id ? res.data.service : s));
      cancelEdit();
      setServiceMessage({ text: 'Hizmet güncellendi', type: 'success' });
    } catch (err) {
      setServiceMessage({ text: err.response?.data?.error || err.message, type: 'error' });
    }
  };

  const handleDeleteService = async (id) => {
    try {
      await api.delete(`/barbers/services/${id}`);
      setServices(prev => prev.filter(s => s._id !== id));
      setServiceMessage({ text: 'Hizmet silindi', type: 'success' });
    } catch (err) {
      setServiceMessage({ text: err.response?.data?.error || err.message, type: 'error' });
    }
  };

  const renderNavItem = (item) => (
    <button
      key={item.key}
      type="button"
      className={`sidebar-nav-item ${activeSection === item.key ? 'active' : ''}`}
      onClick={() => {
        setActiveSection(item.key);
        setShowMobileMenu(false);
      }}
    >
      <span className="sidebar-nav-icon">{item.icon}</span>
      <span className="sidebar-nav-label">{item.label}</span>
      {typeof item.count === 'number' && (
        <span className="sidebar-nav-badge" style={{ backgroundColor: '#3498db', color: 'white' }}>
          {item.count}
        </span>
      )}
    </button>
  );

  return (
    <div className={`barber-shell ${showMobileMenu ? 'show-mobile-menu' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${showMobileMenu ? 'show' : ''}`}>
        <div className="sidebar-logo">✂️ Berber Paneli</div>
        <nav className="sidebar-nav">
          {navigationItems.map(renderNavItem)}
        </nav>
        <footer className="sidebar-footer">
          <small>© 2026 Berber Randevu</small>
        </footer>
      </aside>

      {/* Main Content */}
      <main>
        {/* Topbar */}
        <div className="topbar">
          <button
            type="button"
            className="mobile-menu-toggle d-lg-none"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            ☰
          </button>

          <div className="topbar-actions">
            <button type="button" className="topbar-action-btn" title="Bildirimler">
              🔔
            </button>
            <div className="topbar-profile" onClick={() => setActiveSection('settings')}>
              <div className="topbar-profile-avatar">{barberInitials}</div>
              <div className="topbar-profile-name">{barber?.salonName || 'Berber'}</div>
            </div>
            <button
              type="button"
              className="topbar-action-btn"
              onClick={handleLogout}
              title="Çıkış Yap"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="content">
          {/* Main Section */}
          {activeSection === 'home' && (
            <div>
              <h1 className="page-title">Hoş Geldiniz, {barber?.salonName || 'Berber'}</h1>
              <p className="page-subtitle">
                {barber.subscription?.plan?.toUpperCase()} paketiniz - Bitiş: {new Date(barber.subscription?.expiresAt).toLocaleDateString()}
              </p>

              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">📅 Bugünün Randevuları</div>
                  <div className="stat-card-value">{mySlots.length || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">✂️ Toplam Hizmet</div>
                  <div className="stat-card-value">{services.length}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">⭐ Puanınız</div>
                  <div className="stat-card-value">4.9</div>
                </div>
              </div>

              <div className="info-card">
                <h4>Üyelik Bilgileri</h4>
                <p><strong>Plan:</strong> {barber.subscription?.plan}</p>
                <p><strong>Bitiş Tarihi:</strong> {new Date(barber.subscription?.expiresAt).toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
          )}

          {/* Services Section */}
          {activeSection === 'services' && (
            <div>
              <h1 className="page-title">Hizmetler</h1>
              <p className="page-subtitle">Sunduğunuz hizmetleri yönetin</p>

              {serviceMessage.text && (
                <div className={`alert alert-${serviceMessage.type === 'success' ? 'success' : 'danger'} mb-3`}>
                  {serviceMessage.text}
                </div>
              )}

              <div className="barber-service-picker mb-4">
                <form className="barber-service-form" onSubmit={handleAddService}>
                  <input
                    type="text"
                    placeholder="Hizmet adı"
                    value={newService.name}
                    onChange={e => setNewService({...newService, name: e.target.value})}
                  />
                  <input
                    type="number"
                    placeholder="Fiyat (₺)"
                    value={newService.price}
                    onChange={e => setNewService({...newService, price: e.target.value})}
                  />
                  <input
                    type="number"
                    placeholder="Süre (dk)"
                    value={newService.duration}
                    onChange={e => setNewService({...newService, duration: e.target.value})}
                  />
                  <button type="submit" className="btn btn-primary">✂️ Ekle</button>
                </form>
              </div>

              {services.length > 0 ? (
                <div className="barber-service-grid">
                  {services.map(svc => (
                    <div key={svc._id} className="barber-service-card">
                      {editingServiceId === svc._id ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleUpdateService(svc._id); }} className="barber-service-form">
                          <input type="text" value={editingData.name} onChange={e => setEditingData({...editingData, name: e.target.value})} />
                          <input type="number" value={editingData.price} onChange={e => setEditingData({...editingData, price: e.target.value})} />
                          <input type="number" value={editingData.duration} onChange={e => setEditingData({...editingData, duration: e.target.value})} />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" className="btn btn-success btn-sm" style={{ flex: 1 }}>✅ Kaydet</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit} style={{ flex: 1 }}>✕ İptal</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="barber-service-card-header">
                            <span className="barber-service-card-icon">✂️</span>
                            <span className="barber-service-card-name">{svc.name}</span>
                          </div>
                          <div className="barber-service-card-body">
                            <div className="barber-service-card-price">
                              <label>Fiyat</label>
                              <strong>₺{Number(svc.price || 0)}</strong>
                            </div>
                            <div className="barber-service-card-duration">
                              <label>Süre</label>
                              <strong>{Number(svc.duration || 0)} dk</strong>
                            </div>
                          </div>
                          <div className="barber-service-card-actions">
                            <button className="edit-btn" onClick={() => startEdit(svc)}>✏️ Düzenle</button>
                            <button className="delete-btn" onClick={() => handleDeleteService(svc._id)}>🗑️ Sil</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted text-center py-5">Henüz hizmet eklenmemiş</div>
              )}
            </div>
          )}

          {/* Calendar Section */}
          {activeSection === 'calendar' && (
            <div>
              <h1 className="page-title">Takvim</h1>
              <p className="page-subtitle">Randevularınızı yönetin</p>

              {slotsError && (
                <div className="alert alert-danger alert-dismissible fade show">
                  <strong>Hata!</strong> {slotsError}
                  <button type="button" className="btn-close" onClick={() => setSlotsError('')}></button>
                </div>
              )}

              <div className="barber-mini-calendar mb-4">
                <div className="barber-calendar-head">
                  <div>
                    <div className="barber-calendar-title">Takvim Tablo</div>
                    <div className="barber-calendar-subtitle">Randevularınızı görmek için tarih seçin</div>
                  </div>
                  <div className="barber-calendar-pill">14 Gün</div>
                </div>
                <div className="barber-calendar-grid">
                  {calendarDays.map((day) => {
                    const isSelected = slotDate === day.value;
                    return (
                      <button
                        key={day.value}
                        type="button"
                        className={`barber-calendar-day ${isSelected ? 'active' : ''}`}
                        onClick={async () => {
                          setSlotDate(day.value);
                          setLoadingSlots(true);
                          setSlotsError('');
                          try {
                            const res = await api.get('/slots/my-slots', { params: { date: day.value } });
                            setMySlots(res.data.data || []);
                          } catch (err) {
                            setSlotsError(err.response?.data?.error || 'Slotlar yüklenemedi');
                          } finally {
                            setLoadingSlots(false);
                          }
                        }}
                      >
                        <span className="barber-calendar-day-name">{day.dayName}</span>
                        <strong className="barber-calendar-day-number">{day.dayNumber}</strong>
                        <span className="barber-calendar-day-month">{day.monthName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {mySlots.length > 0 ? (
                <div className="info-card">
                  <h4 className="mb-3">Seçilen Tarih: {new Date(slotDate).toLocaleDateString('tr-TR')}</h4>
                  <div className="list-group">
                    {mySlots.map(s => (
                      <div key={s._id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{s.time}</strong> -
                          <span className={`badge ms-2 ${s.status === 'confirmed' ? 'bg-success' : s.status === 'available' ? 'bg-secondary' : 'bg-danger'}`}>
                            {s.status === 'confirmed' ? 'Randevu Alındı' : s.status === 'available' ? 'Müsait' : 'İptal'}
                          </span>
                          {(s.customerName || s.customer?.name) && <span className="ms-2">({s.customerName || s.customer?.name})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-muted text-center py-5">Bu tarihte randevu yok</div>
              )}
            </div>
          )}

          {/* Stats Section */}
          {activeSection === 'stats' && (
            <div>
              <h1 className="page-title">İstatistikler</h1>
              <p className="page-subtitle">İşletmeniz hakkında metrikler</p>

              <div className="stat-grid">
                <div className="stat-card" style={{ borderColor: '#3498db' }}>
                  <div className="stat-card-label">📅 Toplam Randevu</div>
                  <div className="stat-card-value">124</div>
                </div>
                <div className="stat-card" style={{ borderColor: '#27ae60' }}>
                  <div className="stat-card-label">💰 Bu Ay Gelir</div>
                  <div className="stat-card-value">₺15.4K</div>
                </div>
                <div className="stat-card" style={{ borderColor: '#f39c12' }}>
                  <div className="stat-card-label">⭐ Puanınız</div>
                  <div className="stat-card-value">4.9</div>
                </div>
              </div>

              <div className="info-card">
                <h4>Detaylı İstatistikler</h4>
                <p className="text-muted">Burada daha detaylı raporlar görüntülenecek...</p>
              </div>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div>
              <h1 className="page-title">Ayarlar</h1>
              <p className="page-subtitle">Profil ve işletme ayarlarınızı yönetin</p>
              <ShopSettings />
            </div>
          )}
        </div>
      </main>

      {/* Messages - Toast Notifications */}
      {serviceMessage.text && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: serviceMessage.type === 'success' ? '#27ae60' : '#e74c3c',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.8rem',
            zIndex: 1050,
            maxWidth: '400px',
          }}
        >
          {serviceMessage.text}
        </div>
      )}
      {actionMessage.text && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            backgroundColor: actionMessage.type === 'success' ? '#27ae60' : '#e74c3c',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.8rem',
            zIndex: 1050,
            maxWidth: '400px',
          }}
        >
          {actionMessage.text}
        </div>
      )}
    </div>
  );
}

export default BarberHome;
