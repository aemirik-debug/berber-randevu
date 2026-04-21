import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BarberProfile from './BarberProfile';
import ShopSettings from './ShopSettings';
import SlotDetailsModal from '../components/SlotDetailsModal';
import CreateManualSlotModal from '../components/CreateManualSlotModal';
import EditSlotModal from '../components/EditSlotModal';
import ActionConfirmModal from '../components/ActionConfirmModal';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import './BarberDashboard.css';

function BarberDashboard() {
  const navigate = useNavigate();
  const [barber, setBarber] = useState({
    subscription: { plan: 'basic', expiresAt: new Date() }
  });
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: '', price: '', duration: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingData, setEditingData] = useState({ name: '', price: '', duration: '' });
  const [serviceMessage, setServiceMessage] = useState({ text: '', type: 'success' });
  const [actionMessage, setActionMessage] = useState({ text: '', type: 'success' });

  // mesaj temizleme
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

  // gerçek profil ve hizmet verisini al
  useEffect(() => {
    const token = localStorage.getItem('barberToken');
    const barberId = localStorage.getItem('barberId');
    if (!token || !barberId) {
      navigate('/barber/login', { replace: true });
      return;
    }

    const socket = connectSocket();
    socket.emit('barber_login', barberId);
    socket.on('customer_reminder', (payload) => {
      const customerName = payload?.customerName || 'Müşteri';
      const dateLabel = payload?.date ? new Date(payload.date).toLocaleDateString() : '';
      const timeLabel = payload?.time || '';
      setActionMessage({
        text: `${customerName} ${dateLabel} ${timeLabel} için hatırlatma gönderdi.`,
        type: 'success'
      });
    });

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
  const [activeTab, setActiveTab] = useState('profile');
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
  const [nowTick, setNowTick] = useState(Date.now());
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const todayIso = useMemo(() => {
    const now = new Date(nowTick);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [nowTick]);

  const nowTimeHHmm = useMemo(() => {
    const now = new Date(nowTick);
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, [nowTick]);

  const visibleMySlots = useMemo(() => {
    return mySlots.map((slot) => ({
      ...slot,
      isPastSlot: slotDate === todayIso && String(slot.time || '') <= nowTimeHHmm,
    }));
  }, [mySlots, slotDate, todayIso, nowTimeHHmm]);

  const actionableSlots = useMemo(
    () => visibleMySlots.filter((slot) => !slot.isPastSlot),
    [visibleMySlots]
  );

  useEffect(() => {
    if (activeTab === 'calendar') {
      (async () => {
        setLoadingSlots(true);
        setSlotsError('');
        try {
          const res = await api.get('/slots/my-slots', { params: { date: slotDate } });
          console.log('✅ Slotlar yüklendi:', res.data);
          setMySlots(res.data.data || []);
        } catch (err) { 
          const errMsg = err.response?.data?.error || err.message || 'Slotlar yüklenemedi';
          console.error('❌ Slot yükleme hatası:', {
            status: err.response?.status,
            error: errMsg,
            fullError: err
          });
          setSlotsError(errMsg);
          setMySlots([]);
        } finally {
          setLoadingSlots(false);
        }
      })();
    }
  }, [activeTab, slotDate]);

  const handleLogout = () => {
    localStorage.removeItem('barberToken');
    localStorage.removeItem('barberId');
    navigate('/barber/login');
  };

  const renderStars = (value) => {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  };

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

  // hizmet işlemleri
  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/barbers/services', newService);
      setServices(prev => [...prev, res.data.service]);
      setNewService({ name: '', price: '', duration: '' });
      setServiceMessage({ text: 'Hizmet eklendi', type: 'success' });
    } catch (err) {
      console.error('Hizmet ekleme hatası', err);
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
      console.error('Hizmet güncelleme hatası', err);
      setServiceMessage({ text: err.response?.data?.error || err.message, type: 'error' });
    }
  };

  const handleDeleteService = async (id) => {
    try {
      await api.delete(`/barbers/services/${id}`);
      setServices(prev => prev.filter(s => s._id !== id));
      setServiceMessage({ text: 'Hizmet silindi', type: 'success' });
    } catch (err) {
      console.error('Hizmet silme hatası', err);
      setServiceMessage({ text: err.response?.data?.error || err.message, type: 'error' });
    }
  };

  const closeConfirmAction = () => setConfirmAction(null);

  const executeConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    const action = confirmAction;
    closeConfirmAction();

    if (action.kind === 'toggle-availability') {
      const slot = action.slot;
      try {
        if (slot.isPastSlot) return;
        await api.patch(`/slots/${slot._id}/status`, { status: action.newStatus });
        setMySlots((prev) => prev.map((item) => (item._id === slot._id ? { ...item, status: action.newStatus } : item)));
        setActionMessage({
          text: action.newStatus === 'blocked' ? 'Saat bloke edildi.' : 'Bloke kaldırıldı.',
          type: 'success',
        });
      } catch (err) {
        setSlotsError(err.response?.data?.error || 'Durum güncellenemedi');
      }
      return;
    }

    if (action.kind === 'cancel-slot') {
      const slot = action.slot;
      try {
        if (slot.isPastSlot) return;
        await api.patch(`/slots/${slot._id}/cancel`, { reason: action.reasonValue || 'Berber tarafından iptal edildi' });
        setMySlots((prev) => prev.map((item) => (item._id === slot._id ? { ...item, status: 'cancelled', cancelReason: action.reasonValue || 'Berber tarafından iptal edildi' } : item)));
        setActionMessage({ text: 'Randevu iptal edildi', type: 'success' });
      } catch (err) {
        setActionMessage({ text: err.response?.data?.error || 'İptal edilemedi', type: 'error' });
      }
    }
  };

  return (
    <div className="min-vh-100" style={{backgroundColor: '#f8f9fa'}}>
      {/* Üst kısım: küçük header */}
      <div className="bg-white shadow-sm sticky-top">
        <div className="container py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h4 className="mb-1 fw-bold" style={{color: '#2c3e50'}}>
                <span className="rounded-circle d-inline-flex align-items-center justify-content-center me-2 overflow-hidden bg-white border" 
                      style={{width: '40px', height: '40px', backgroundColor: '#fff', border: '1.5px solid #3498db'}}>
                  <img
                    src={require('../assets/barber-logo-sample.svg').default}
                    alt="Salon logosu"
                    style={{width: '36px', height: '36px', objectFit: 'cover', borderRadius: '50%'}}
                  />
                </span>
                {barber.subscription?.plan?.toUpperCase()} Panel
              </h4>
              <small className="text-muted">
                <span className="badge me-2 text-white" style={{backgroundColor: '#e74c3c'}}>{barber.subscription?.plan}</span>
                Bitiş: {new Date(barber.subscription?.expiresAt).toLocaleDateString()}
              </small>
            </div>
            <button onClick={handleLogout} className="btn btn-outline-danger btn-sm rounded-pill px-4">
              <i className="bi bi-box-arrow-right me-1"></i> Çıkış
            </button>
          </div>
        </div>
      </div>

      <div className="container mt-4 pb-5">
        {/* Sekmeler */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-2">
            <ul className="nav nav-pills nav-fill">
              <li className="nav-item">
                <button 
                  className={`nav-link rounded-pill ${activeTab === 'profile' ? 'active text-white' : 'text-dark'}`} 
                  onClick={() => setActiveTab('profile')}
                  style={activeTab === 'profile' ? {backgroundColor: '#3498db'} : {}}
                >
                  <span className="fs-5 me-2">👤</span>
                  <span className="fw-semibold">Profil</span>
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link rounded-pill ${activeTab === 'stats' ? 'active text-white' : 'text-dark'}`} 
                  onClick={() => setActiveTab('stats')}
                  style={activeTab === 'stats' ? {backgroundColor: '#3498db'} : {}}
                >
                  <span className="fs-5 me-2">📊</span>
                  <span className="fw-semibold">İstatistikler</span>
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link rounded-pill ${activeTab === 'services' ? 'active text-white' : 'text-dark'}`} 
                  onClick={() => setActiveTab('services')}
                  style={activeTab === 'services' ? {backgroundColor: '#3498db'} : {}}
                >
                  <span className="fs-5 me-2">✂️</span>
                  <span className="fw-semibold">Hizmetler</span>
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link rounded-pill ${activeTab === 'calendar' ? 'active text-white' : 'text-dark'}`} 
                  onClick={() => setActiveTab('calendar')}
                  style={activeTab === 'calendar' ? {backgroundColor: '#3498db'} : {}}
                >
                  <span className="fs-5 me-2">📅</span>
                  <span className="fw-semibold">Takvim</span>
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link rounded-pill ${activeTab === 'settings' ? 'active text-white' : 'text-dark'}`} 
                  onClick={() => setActiveTab('settings')}
                  style={activeTab === 'settings' ? {backgroundColor: '#f39c12'} : {}}
                >
                  <span className="fs-5 me-2">⚙️</span>
                  <span className="fw-semibold">Dükkan Ayarları</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Sekme içerikleri */}
        <div className="tab-content">
          {activeTab === 'profile' && (
            <div className="card shadow border-0 rounded-4 overflow-hidden">
              <div className="card-header text-white py-3" style={{backgroundColor: '#3498db'}}>
                <h5 className="mb-0 fw-semibold">Profil Yönetimi</h5>
              </div>
              <div className="card-body p-4">
                <BarberProfile />
              </div>
            </div>
          )}
          {activeTab === 'services' && (
            <div className="card shadow border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>Hizmetlerim</h5>
              </div>
              <div className="card-body p-4">
                {serviceMessage.text && (
                  <div className={`alert alert-${serviceMessage.type === 'success' ? 'success' : 'danger'} mb-3`}>
                    {serviceMessage.text}
                  </div>
                )}
                <div className="barber-service-picker mb-4">
                  <form className="barber-service-form" onSubmit={handleAddService}>
                    <input
                      type="text"
                      placeholder="Hizmet adı (örn: Traş, Kesim)"
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
                      placeholder="Süre (dakika)"
                      value={newService.duration}
                      onChange={e => setNewService({...newService, duration: e.target.value})}
                    />
                    <button type="submit" className="btn btn-primary">✂️ Hizmet Ekle</button>
                  </form>
                </div>

                {services.length > 0 ? (
                  <div className="barber-service-grid">
                    {services.map(svc => (
                      <div key={svc._id} className="barber-service-card">
                        {editingServiceId === svc._id ? (
                          <form onSubmit={(e) => { e.preventDefault(); handleUpdateService(svc._id); }} className="barber-service-form">
                            <input
                              type="text"
                              value={editingData.name}
                              onChange={e => setEditingData({...editingData, name: e.target.value})}
                            />
                            <input
                              type="number"
                              value={editingData.price}
                              onChange={e => setEditingData({...editingData, price: e.target.value})}
                            />
                            <input
                              type="number"
                              value={editingData.duration}
                              onChange={e => setEditingData({...editingData, duration: e.target.value})}
                            />
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
                  <div className="text-muted text-center py-5">Henüz hizmet eklenmemiş. Yukarıdan yeni hizmet ekleyerek başlayabilirsin.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="card shadow border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>Takvim</h5>
              </div>
              <div className="card-body p-4">
                {!barber.features?.calendarBooking && (
                  <div className="alert alert-warning">
                    <strong>Takvim özelliği paketinizde yok.</strong> Profil sayfanızdan etkinleştirin veya paket yükseltin.
                  </div>
                )}
                {slotsError && (
                  <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    <strong>Hata!</strong> {slotsError}
                    <button type="button" className="btn-close" onClick={() => setSlotsError('')}></button>
                  </div>
                )}

                <div className="barber-mini-calendar mb-4">
                  <div className="barber-calendar-head">
                    <div>
                      <div className="barber-calendar-title">Takvim Görünümü</div>
                      <div className="barber-calendar-subtitle">Randevularını görmek için gün seç.</div>
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
                              console.error('Slot yükleme hatası:', err);
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

                {/* İstatistik Kartları */}
                {visibleMySlots && visibleMySlots.length > 0 && (
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <div className="card border-0 rounded-3 shadow-sm h-100" style={{backgroundColor: '#e8f4f8', borderLeft: '4px solid #3498db'}}>
                        <div className="card-body">
                          <h6 className="text-muted small text-uppercase fw-bold mb-2">📲 Sistemden Gelen</h6>
                          <h3 className="fw-bold mb-0" style={{color: '#3498db'}}>
                            {actionableSlots.filter(s => !s.isManualAppointment && s.status !== 'cancelled').length}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-0 rounded-3 shadow-sm h-100" style={{backgroundColor: '#fef4e8', borderLeft: '4px solid #f39c12'}}>
                        <div className="card-body">
                          <h6 className="text-muted small text-uppercase fw-bold mb-2">✍️ Berber Oluşturdu</h6>
                          <h3 className="fw-bold mb-0" style={{color: '#f39c12'}}>
                            {actionableSlots.filter(s => s.isManualAppointment && s.status !== 'cancelled').length}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-0 rounded-3 shadow-sm h-100" style={{backgroundColor: '#e8f5e9', borderLeft: '4px solid #27ae60'}}>
                        <div className="card-body">
                          <h6 className="text-muted small text-uppercase fw-bold mb-2">👥 Toplam Müşteri</h6>
                          <h3 className="fw-bold mb-0" style={{color: '#27ae60'}}>
                            {actionableSlots.filter(s => (s.customerName || s.customer?.name) && s.status !== 'cancelled').length}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="list-group">
                  <div className="d-flex justify-content-end mb-2">
                    {slotDate <= todayIso && (
                      <button
                        type="button"
                        className="barber-history-entry-btn"
                        onClick={() => {
                          setSelectedSlotForManual({
                            date: slotDate,
                            time: '',
                            allowFlexibleDateTime: true,
                          });
                          setShowCreateManualSlot(true);
                        }}
                      >
                        📝 Geçmiş Randevu Ekle
                      </button>
                    )}
                  </div>
                  {visibleMySlots && visibleMySlots.length > 0 ? visibleMySlots.map(s => {
                    const statusLc = String(s.status || '').toLowerCase();
                    const hasAppointment = Boolean(s.customerName || s.customer?.name);
                    const showPastOnly = s.isPastSlot && statusLc === 'available' && !hasAppointment;
                    const hideActions = s.isPastSlot || statusLc === 'confirmed';

                    return (
                    <div key={s._id} className={`list-group-item d-flex justify-content-between align-items-center ${s.status === 'available' ? '' : s.status === 'blocked' ? 'bg-warning' : 'bg-light'} ${s.isPastSlot ? 'barber-past-slot-item' : ''}`}>
                      <div>
                        <strong>{s.time}</strong> - 
                        <span className={`badge ${
                          showPastOnly ? 'bg-dark' : (s.status === 'available' ? 'bg-secondary' :
                          s.status === 'blocked' ? 'bg-warning' :
                          s.status === 'confirmed' ? 'bg-success' :
                          s.status === 'cancelled' ? 'bg-danger' :
                          'bg-secondary')
                        }`}>{
                          showPastOnly ? 'Geçti' : (s.status === 'available' ? 'Müsait' :
                          s.status === 'blocked' ? 'Bloklu' :
                          s.status === 'confirmed' ? 'Randevu Alındı' :
                          s.status === 'cancelled' ? 'İptal Edildi' :
                          s.status)
                        }</span>
                        {(s.customerName || s.customer?.name) && <span className="ms-2">({s.customerName || s.customer?.name})</span>}
                      </div>
                      {!hideActions && <div>
                        {/* Müşteri olmayan slot - Blokla/Aç ve Randevu Oluştur */}
                        {!(s.customerName || s.customer?.name) && (
                          <div className="btn-group btn-group-sm" role="group">
                            <button 
                              className="btn btn-outline-primary" 
                              onClick={() => {
                                if (s.isPastSlot) return;
                                setSelectedSlotForManual({ date: slotDate, time: s.time, _id: s._id });
                                setShowCreateManualSlot(true);
                              }}
                              disabled={s.isPastSlot}
                              title="Randevu oluştur"
                            >
                              ➕ Randevu Oluştur
                            </button>
                            <button 
                              className="btn btn-outline-secondary" 
                              onClick={() => {
                                if (s.isPastSlot) return;
                                const newStatus = s.status === 'available' ? 'blocked' : 'available';
                                setConfirmAction({
                                  kind: 'toggle-availability',
                                  slot: s,
                                  newStatus,
                                  title: newStatus === 'blocked' ? 'Saati Bloke Et' : 'Blokeyi Kaldır',
                                  message: newStatus === 'blocked'
                                    ? 'Bu saati bloke etmek istiyor musunuz? Slot müşterilere kapatılacak.'
                                    : 'Bu saatin blokesini kaldırmak istiyor musunuz? Slot yeniden müsait olacak.',
                                  confirmText: newStatus === 'blocked' ? 'Bloke Et' : 'Blokeyi Kaldır',
                                  variant: newStatus === 'blocked' ? 'danger' : 'warning',
                                });
                              }}
                              disabled={s.isPastSlot}
                              title={s.status === 'available' ? 'Saati blokla' : 'Saati aç'}
                            >
                              {s.status === 'available' ? '🔒 Blokla' : '🔓 Aç'}
                            </button>
                          </div>
                        )}
                        {/* Müşteri var veya iptal edilmiş - Detay ve İptal */}
                        {(s.customerName || s.customer?.name || s.status === 'cancelled') && (
                          <div className="btn-group btn-group-sm" role="group">
                            <button className="btn btn-outline-info" onClick={() => { setSlotDetailsData(s); setShowSlotDetails(true); }}>📋 Detay</button>
                            {s.status !== 'cancelled' && (
                              <button 
                                className="btn btn-outline-danger" 
                                onClick={() => {
                                  if (s.isPastSlot) return;
                                  setConfirmAction({
                                    kind: 'cancel-slot',
                                    slot: s,
                                    title: 'Randevuyu İptal Et',
                                    message: `${s.time} saatindeki randevuyu iptal etmek istiyor musunuz?`,
                                    confirmText: 'İptal Et',
                                    variant: 'danger',
                                    reasonValue: 'Berber tarafından iptal edildi',
                                    showReason: true,
                                  });
                                }}
                                disabled={s.isPastSlot}
                                title="Randevuyu iptal et"
                              >
                                ❌ İptal
                              </button>
                            )}
                          </div>
                        )}
                      </div>}
                    </div>
                  )}) : <div className="text-muted text-center py-3">Bu tarihte gelecekteki slot yok.</div>}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'stats' && (
            <div className="card shadow border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0 fw-bold" style={{color: '#2c3e50'}}>İstatistikler</h5>
              </div>
              <div className="card-body p-4">
                <div className="row g-4 mb-4">
                  <div className="col-md-4">
                    <div className="card text-white border-0 h-100" style={{backgroundColor: '#3498db'}}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="card-subtitle mb-2 opacity-75">Toplam Randevu</h6>
                            <h2 className="mb-0 fw-bold">124</h2>
                          </div>
                          <span className="fs-1">📅</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card text-white border-0 h-100" style={{backgroundColor: '#27ae60'}}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="card-subtitle mb-2 opacity-75">Bu Ay Gelir</h6>
                            <h2 className="mb-0 fw-bold">₺15.4K</h2>
                          </div>
                          <span className="fs-1">💰</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card text-white border-0 h-100" style={{backgroundColor: '#f39c12'}}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="card-subtitle mb-2 opacity-75">Puanınız</h6>
                            <h2 className="mb-0 fw-bold">4.9 ⭐</h2>
                          </div>
                          <span className="fs-1">🏆</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="alert alert-light border rounded-4 mb-0">
                  <p className="text-muted mb-0">Burada randevu ve gelir istatistikleri olacak.</p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <ShopSettings />
          )}
        </div>
      </div>

      {/* slot detay modal */}
      <SlotDetailsModal
        show={showSlotDetails}
        slot={slotDetailsData}
        onClose={() => setShowSlotDetails(false)}
        onCancel={async (slotId, reason) => {
          try {
            // Slot detayından customer ID'yi al
            const slotData = mySlots.find(s => s._id === slotId);
            const customerId = slotData?.customerId || slotDetailsData?.customerId;
            
            const res = await api.patch(`/slots/${slotId}/action`, { 
              action: 'cancel', 
              reason,
              customerId  // Backend'e customer ID gönder
            });
            
            // Backend'den dönen güncellenmiş slot'u kullan (cancelReason dahil)
            setMySlots(prev => prev.map(s => s._id === slotId ? res.data.slot : s));
            setActionMessage({ text: 'Randevu iptal edildi', type: 'success' });
            setShowSlotDetails(false);
          } catch (err) {
            console.error('İptal hatası', err);
            setActionMessage({ text: 'İptal sırasında hata', type: 'error' });
          }
        }}

        onComplete={async (slotId) => {
          try {
            // Slot detayından customer ID'yi al
            const slotData = mySlots.find(s => s._id === slotId);
            const customerId = slotData?.customerId || slotDetailsData?.customerId;
            
            await api.patch(`/slots/${slotId}/action`, { 
              action: 'confirm',
              customerId  // Backend'e customer ID gönder
            });
            setMySlots(prev => prev.map(s => s._id === slotId ? { ...s, status: 'confirmed' } : s));
            setActionMessage({ text: 'Randevu onaylandı', type: 'success' });
            setShowSlotDetails(false);
          } catch (err) {
            console.error('Onay hatası', err);
            setActionMessage({ text: 'Onay sırasında hata', type: 'error' });
          }
        }}
        
        onEdit={(slot) => {
          setSelectedSlotForEdit(slot);
          setShowEditSlot(true);
          setShowSlotDetails(false);
        }}
      />

      {/* Manual slot oluşturma modal */}
      <CreateManualSlotModal
        show={showCreateManualSlot}
        slot={selectedSlotForManual}
        services={services}
        onClose={() => {
          setShowCreateManualSlot(false);
          setSelectedSlotForManual(null);
        }}
        onSuccess={async () => {
          try {
            const res = await api.get('/slots/my-slots', { params: { date: slotDate } });
            setMySlots(res.data.data || []);
          } catch (err) {
            console.error('Slotları yenileme hatası:', err);
          }

          setActionMessage({ text: '✅ Randevu başarıyla oluşturuldu!', type: 'success' });
        }}
      />

      {/* Randevu düzenleme modal */}
      <EditSlotModal
        show={showEditSlot}
        slot={selectedSlotForEdit}
        services={services}
        onClose={() => {
          setShowEditSlot(false);
          setSelectedSlotForEdit(null);
        }}
        onSuccess={(updatedSlot) => {
          // Slot listesini güncelle
          setMySlots(prev => prev.map(s => s._id === updatedSlot._id ? updatedSlot : s));
          setActionMessage({ text: '✅ Randevu başarıyla güncellendi!', type: 'success' });
        }}
      />

      {/* bootstrap notifications */}
      {serviceMessage.text && (
        <div className={`alert alert-dismissible fade show ${serviceMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`} 
          role="alert"
          style={{position: 'fixed', top: 20, right: 20, zIndex: 1050, maxWidth: '420px', boxShadow: '0 12px 28px rgba(44, 62, 80, 0.15)'}}>
          <strong className="me-1">{serviceMessage.type === 'success' ? 'Başarılı!' : 'Hata!'}</strong>
          {serviceMessage.text}
          <button type="button" className="btn-close" onClick={() => setServiceMessage({ text: '', type: 'success' })}></button>
        </div>
      )}
      {actionMessage.text && (
        <div className={`alert alert-dismissible fade show ${actionMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`} 
          role="alert"
          style={{position: 'fixed', top: 70, right: 20, zIndex: 1050, maxWidth: '420px', boxShadow: '0 12px 28px rgba(44, 62, 80, 0.15)'}}>
          <strong className="me-1">{actionMessage.type === 'success' ? 'Başarılı!' : 'Hata!'}</strong>
          {actionMessage.text}
          <button type="button" className="btn-close" onClick={() => setActionMessage({ text: '', type: 'success' })}></button>
        </div>
      )}

      <ActionConfirmModal
        show={Boolean(confirmAction)}
        title={confirmAction?.title || 'İşlemi Onayla'}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText || 'Onayla'}
        variant={confirmAction?.variant || 'danger'}
        showReason={Boolean(confirmAction?.showReason)}
        reasonValue={confirmAction?.reasonValue || ''}
        onReasonChange={(value) => setConfirmAction((prev) => (prev ? { ...prev, reasonValue: value } : prev))}
        onConfirm={executeConfirmAction}
        onClose={closeConfirmAction}
      />
    </div>
  );
}

export default BarberDashboard;