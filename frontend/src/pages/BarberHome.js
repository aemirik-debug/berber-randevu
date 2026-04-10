import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import BarberProfile from './BarberProfile';
import ShopSettings from './ShopSettings';
import CreateManualSlotModal from '../components/CreateManualSlotModal';
import EditSlotModal from '../components/EditSlotModal';
import ActionConfirmModal from '../components/ActionConfirmModal';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import './BarberShellLayout.css';

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const toLocalDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function BarberHome() {
  const navigate = useNavigate();
  const headerMenuRef = useRef(null);
  const [activeSection, setActiveSection] = useState('home');
  const [barber, setBarber] = useState({ subscription: { plan: 'basic', expiresAt: new Date() } });
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: '', price: '', duration: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingData, setEditingData] = useState({ name: '', price: '', duration: '' });
  const [serviceMessage, setServiceMessage] = useState({ text: '', type: 'success' });
  const [actionMessage, setActionMessage] = useState({ text: '', type: 'success' });
  const [mySlots, setMySlots] = useState([]);
  const [dashboardSlots, setDashboardSlots] = useState([]);
  const [dashboardPendingSlots, setDashboardPendingSlots] = useState([]);
  const [dashboardConfirmedSlots, setDashboardConfirmedSlots] = useState([]);
  const [slotDate, setSlotDate] = useState(toLocalDateInput(new Date()));
  const [showCreateManualSlot, setShowCreateManualSlot] = useState(false);
  const [selectedSlotForManual, setSelectedSlotForManual] = useState(null);
  const [showEditSlot, setShowEditSlot] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [pendingSlotActionId, setPendingSlotActionId] = useState('');
  const [editingAlertSlotId, setEditingAlertSlotId] = useState('');
  const [alertRescheduleDrafts, setAlertRescheduleDrafts] = useState({});
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [confirmAction, setConfirmAction] = useState(null);
  const todayIso = useMemo(() => toLocalDateInput(new Date()), []);
  const formatDateDayMonthYear = (dateStr) => {
    const [year, month, day] = String(dateStr || '').split('-');
    if (!year || !month || !day) {
      return dateStr || '-';
    }
    return `${day}.${month}.${year}`;
  };

  const barberInitials = `${(barber?.name?.[0] || 'B')}${(barber?.surname?.[0] || 'R')}`.toUpperCase();

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

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

  const navigationItems = [
    { key: 'home', label: 'Ana Sayfa', icon: '🏠' },
    { key: 'services', label: 'Hizmetler', icon: '✂️', count: services.length },
    { key: 'calendar', label: 'Takvim', icon: '📅' },
    { key: 'stats', label: 'İstatistikler', icon: '📊' },
    { key: 'settings', label: 'Mağaza Ayarları', icon: '⚙️' },
  ];

  const loadDashboardSlotsForToday = async () => {
    try {
      const slotsRes = await api.get('/slots/my-slots', { params: { date: todayIso } });
      setDashboardSlots(slotsRes.data.data || []);
    } catch (slotErr) {
      console.error('Bugünün slotları yüklenemedi', slotErr);
      setDashboardSlots([]);
    }
  };

  const loadDashboardPendingSlots = async () => {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const slotsRes = await api.get('/slots/my-slots', {
        params: {
          startDate: todayIso,
          endDate: toLocalDateInput(endDate),
        },
      });

      const allSlots = slotsRes.data.data || [];
      const pendingSlots = allSlots
        .filter((slot) => {
          const statusLc = String(slot.status || '').toLowerCase();
          return ['booked', 'reschedule_pending_customer', 'reschedule_pending_barber'].includes(statusLc);
        })
        .sort((a, b) => {
          const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
          if (dateCompare !== 0) {
            return dateCompare;
          }
          return String(a.time || '').localeCompare(String(b.time || ''));
        });

      const confirmedSlots = allSlots
        .filter((slot) => String(slot.status || '').toLowerCase() === 'confirmed')
        .sort((a, b) => {
          const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
          if (dateCompare !== 0) {
            return dateCompare;
          }
          return String(a.time || '').localeCompare(String(b.time || ''));
        });

      setDashboardPendingSlots(pendingSlots);
      setDashboardConfirmedSlots(confirmedSlots);
    } catch (slotErr) {
      console.error('Bekleyen randevular yüklenemedi', slotErr);
      setDashboardPendingSlots([]);
      setDashboardConfirmedSlots([]);
    }
  };

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerMenuRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    const handleRescheduleResponse = async (payload) => {
      if (activeSection === 'home') {
        await Promise.all([
          loadDashboardSlotsForToday(),
          loadDashboardPendingSlots(),
        ]);
      }
      if (payload?.message) {
        setActionMessage({ text: payload.message, type: 'success' });
      }
    };

    socket.on('barber_reschedule_response', handleRescheduleResponse);

    const fetchAll = async () => {
      try {
        const [profRes, svcRes] = await Promise.all([
          api.get('/barbers/profile'),
          api.get('/barbers/services')
        ]);
        setBarber(profRes.data);
        setServices(svcRes.data.services || []);

        await Promise.all([
          loadDashboardSlotsForToday(),
          loadDashboardPendingSlots(),
        ]);
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
      socket.off('barber_reschedule_response', handleRescheduleResponse);
      disconnectSocket();
    };
  }, [navigate, todayIso]);

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

  // Keep home dashboard counters in sync with DB changes.
  useEffect(() => {
    if (activeSection !== 'home') {
      return;
    }

    const loadHomeSlots = async () => {
      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
      ]);
    };

    loadHomeSlots();
    const timer = setInterval(loadHomeSlots, 15000);
    return () => clearInterval(timer);
  }, [activeSection, todayIso]);

  // Refresh profile when coming back to home so dashboard stats stay in sync with ShopSettings changes.
  useEffect(() => {
    if (activeSection !== 'home') {
      return;
    }

    const refreshProfileForHome = async () => {
      try {
        const res = await api.get('/barbers/profile');
        setBarber(res.data || {});
      } catch (err) {
        console.error('Ana sayfa profil tazeleme hatası', err);
      }
    };

    refreshProfileForHome();
  }, [activeSection]);

  const calendarDays = useMemo(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    return Array.from({ length: 5 }, (_, index) => {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + index);
      return {
        value: toLocalDateInput(currentDate),
        dayName: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(currentDate),
        monthName: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(currentDate),
        dayNumber: new Intl.DateTimeFormat('tr-TR', { day: '2-digit' }).format(currentDate),
      };
    });
  }, []);

  const activeWorkingDays = useMemo(() => {
    const hours = barber?.workingHours || {};
    return WEEK_DAYS.filter((dayKey) => {
      const day = hours[dayKey];
      return day?.isOpen === true || String(day?.isOpen).toLowerCase() === 'true';
    }).length;
  }, [barber]);
  const closedWorkingDays = useMemo(() => Math.max(0, WEEK_DAYS.length - activeWorkingDays), [activeWorkingDays]);
  const hasWorkingDayStatusData = useMemo(() => {
    const hours = barber?.workingHours || {};
    return WEEK_DAYS.every((dayKey) => {
      const day = hours[dayKey];
      return day
        && typeof day.isOpen !== 'undefined'
        && String(day.open || '').trim()
        && String(day.close || '').trim();
    });
  }, [barber]);
  const profileFieldsCompletion = useMemo(() => {
    const emailFilled = String(barber?.email || '').trim().length > 0;
    const completedParts = [emailFilled, hasWorkingDayStatusData].filter(Boolean).length;
    return Math.round((completedParts / 2) * 100);
  }, [barber, hasWorkingDayStatusData]);
  const dashboardAppointmentStats = useMemo(() => {
    const newRequests = dashboardSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'booked').length;
    const confirmed = dashboardSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'confirmed').length;
    const available = dashboardSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'available').length;
    const cancelled = dashboardSlots.filter((slot) => ['cancelled', 'rejected', 'reddedildi'].includes(String(slot.status || '').toLowerCase())).length;
    return {
      total: dashboardSlots.length,
      newRequests,
      confirmed,
      available,
      cancelled,
    };
  }, [dashboardSlots]);
  const dashboardRevenueEstimate = useMemo(() => {
    return dashboardSlots.reduce((sum, slot) => {
      if (String(slot.status || '').toLowerCase() !== 'confirmed') {
        return sum;
      }

      const slotRevenue = Number(
        slot.manualPrice
        ?? slot.payment?.amount
        ?? slot.service?.price
        ?? slot.customer?.totalPrice
        ?? 0
      ) || 0;

      return sum + slotRevenue;
    }, 0);
  }, [dashboardSlots]);
  const dashboardBookedSlots = useMemo(() => {
    return dashboardPendingSlots;
  }, [dashboardPendingSlots]);
  const todayConfirmedSlots = useMemo(() => {
    return dashboardConfirmedSlots.filter((slot) => String(slot.date || '') === todayIso);
  }, [dashboardConfirmedSlots, todayIso]);
  const upcomingConfirmedSlots = useMemo(() => {
    return dashboardConfirmedSlots.filter((slot) => String(slot.date || '') > todayIso);
  }, [dashboardConfirmedSlots, todayIso]);
  const actionableAlertCount = useMemo(() => {
    return dashboardBookedSlots.filter((slot) => {
      const statusLc = String(slot.status || '').toLowerCase();
      return statusLc === 'booked' || statusLc === 'reschedule_pending_barber';
    }).length;
  }, [dashboardBookedSlots]);
  const profileStatusCards = useMemo(() => {
    const emailFilled = String(barber?.email || '').trim();
    return [
      {
        key: 'email',
        icon: '✉️',
        title: 'E-posta',
        value: emailFilled ? emailFilled : 'Eksik',
        tone: emailFilled ? 'success' : 'warning',
        description: emailFilled ? 'Kaydedildi ve kilitli' : 'Bir kez eklenebilir',
      },
      {
        key: 'hours',
        icon: '⏰',
        title: 'Açık/Kapalı Gün',
        value: `${activeWorkingDays} açık • ${closedWorkingDays} kapalı`,
        tone: activeWorkingDays > 0 ? 'success' : 'warning',
        description: activeWorkingDays > 0 ? 'Mağaza ayarlarına göre güncel' : 'Çalışma saatlerini tamamlayın',
      },
      {
        key: 'phone',
        icon: '📱',
        title: 'Telefon Numarası',
        value: String(barber?.phone || '').trim() || 'Eksik',
        tone: String(barber?.phone || '').trim() ? 'success' : 'warning',
        description: String(barber?.phone || '').trim() ? 'Kayıtlı ve doğrulanmış' : 'Telefon bilgisi eksik',
      },
      {
        key: 'profile',
        icon: '🧩',
        title: 'Durum Tamamlığı',
        value: `%${profileFieldsCompletion}`,
        tone: profileFieldsCompletion >= 80 ? 'success' : 'warning',
        description: 'E-posta + açık/kapalı gün bilgisi doluluk oranı',
      },
    ];
  }, [barber, activeWorkingDays, closedWorkingDays, profileFieldsCompletion]);

  const businessAlerts = useMemo(() => {
    const alerts = [];
    if (!String(barber?.email || '').trim()) {
      alerts.push({ key: 'email', icon: '✉️', tone: 'warning', title: 'E-posta eksik', text: 'Müşteri tarafı ve güvenlik akışı için e-posta ekleyin.' });
    }
    if (activeWorkingDays === 0) {
      alerts.push({ key: 'hours', icon: '⏰', tone: 'danger', title: 'Çalışma saatleri yok', text: 'Takvim ve slot üretimi için çalışma günlerini açın.' });
    }
    if (!barber?.features?.calendarBooking) {
      alerts.push({ key: 'calendar', icon: '📅', tone: 'warning', title: 'Takvim kapalı', text: 'Müşterilerin randevu alabilmesi için takvimi açın.' });
    }
    if (!services.length) {
      alerts.push({ key: 'services', icon: '✂️', tone: 'info', title: 'Hizmet yok', text: 'İlk hizmetinizi ekleyerek satış akışını başlatın.' });
    }
    return alerts;
  }, [barber, activeWorkingDays, services.length]);

  const quickActions = useMemo(() => ([
    { key: 'create-appointment', label: 'Randevu Oluştur', icon: '🗓️', description: 'Saat seçip müşteri ekleyerek slotu doldur', action: () => setActiveSection('calendar') },
    {
      key: 'historical-entry',
      label: 'Geçmiş Randevu Kaydı Ekle',
      icon: '📝',
      description: 'Unutulan geçmiş müşteriyi takvime işle',
      action: () => {
        setSelectedSlotForManual({
          date: todayIso,
          time: '',
          allowFlexibleDateTime: true,
        });
        setShowCreateManualSlot(true);
      }
    },
    { key: 'calendar', label: 'Takvime Git', icon: '📅', description: 'Boş slotları kontrol et', action: () => setActiveSection('calendar') },
    { key: 'settings', label: 'Mağaza Ayarları', icon: '⚙️', description: 'Çalışma saatleri ve takvim', action: () => setActiveSection('settings') },
  ]), [todayIso]);

  const handleLogout = () => {
    localStorage.removeItem('barberToken');
    localStorage.removeItem('barberId');
    navigate('/barber/login');
  };

  const loadSlotsForDate = async (dateStr) => {
    setLoadingSlots(true);
    setSlotsError('');
    try {
      const res = await api.get('/slots/my-slots', { params: { date: dateStr } });
      setMySlots(res.data.data || []);
    } catch (err) {
      setSlotsError(err.response?.data?.error || 'Slotlar yüklenemedi');
      setMySlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleApproveFromAlerts = async (slot) => {
    try {
      setPendingSlotActionId(slot._id);
      const customerId = slot?.customer?.customerId || null;
      await api.patch(`/slots/${slot._id}/action`, {
        action: 'confirm',
        customerId,
      });
      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
      ]);
      if (activeSection === 'calendar' && slotDate === todayIso) {
        await loadSlotsForDate(slotDate);
      }
      setActionMessage({ text: 'Randevu onaylandı ve müşteriye bildirildi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Randevu onaylanamadı', type: 'error' });
    } finally {
      setPendingSlotActionId('');
    }
  };

  const closeConfirmAction = () => setConfirmAction(null);

  const executeConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    const action = confirmAction;
    closeConfirmAction();

    if (action.kind === 'cancel-alert') {
      await handleCancelFromAlerts(action.slot, action.reasonValue || 'Berber tarafından iptal edildi');
      return;
    }

    if (action.kind === 'toggle-availability') {
      await handleToggleAvailability(action.slot, action.newStatus);
      return;
    }

    if (action.kind === 'delete-slot') {
      await handleDeleteSlot(action.slot);
    }
  };

  const handleCancelFromAlerts = async (slot, reason = 'Berber tarafından iptal edildi') => {
    try {
      setPendingSlotActionId(slot._id);
      const customerId = slot?.customer?.customerId || null;
      await api.patch(`/slots/${slot._id}/action`, {
        action: 'cancel',
        reason,
        customerId,
      });
      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
      ]);
      if (activeSection === 'calendar' && slotDate === todayIso) {
        await loadSlotsForDate(slotDate);
      }
      setActionMessage({ text: 'Randevu iptal edildi ve müşteriye bildirildi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Randevu iptal edilemedi', type: 'error' });
    } finally {
      setPendingSlotActionId('');
    }
  };

  const handleToggleAvailability = async (slot, newStatus) => {
    try {
      setPendingSlotActionId(slot._id);
      await api.patch(`/slots/${slot._id}/status`, { status: newStatus });
      await loadSlotsForDate(slotDate);
      setActionMessage({
        text: newStatus === 'blocked' ? 'Saat bloke edildi.' : 'Bloke kaldırıldı.',
        type: 'success'
      });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Slot durumu güncellenemedi', type: 'error' });
    } finally {
      setPendingSlotActionId('');
    }
  };

  const handleDeleteSlot = async (slot) => {
    try {
      setPendingSlotActionId(slot._id);
      await api.delete(`/slots/${slot._id}`);
      await loadSlotsForDate(slotDate);
      setActionMessage({ text: 'Saat silindi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Saat silinemedi', type: 'error' });
    } finally {
      setPendingSlotActionId('');
    }
  };

  const startRescheduleFromAlerts = (slot) => {
    setEditingAlertSlotId(slot._id);
    setAlertRescheduleDrafts((prev) => ({
      ...prev,
      [slot._id]: {
        date: slot.date || todayIso,
        time: slot.time || '09:00',
      },
    }));
  };

  const handleRescheduleFromAlerts = async (slot) => {
    const draft = alertRescheduleDrafts[slot._id];
    if (!draft?.time) {
      setActionMessage({ text: 'Yeni saat seçmelisiniz', type: 'error' });
      return;
    }

    try {
      setPendingSlotActionId(slot._id);
      await api.patch(`/slots/${slot._id}/reschedule`, {
        newDate: draft.date || slot.date,
        newTime: draft.time,
      });
      setEditingAlertSlotId('');
      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
      ]);
      if (activeSection === 'calendar' && slotDate === (draft.date || todayIso)) {
        await loadSlotsForDate(slotDate);
      }
      setActionMessage({ text: 'Randevu saati güncellendi ve müşteriye bildirim gönderildi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Randevu saati güncellenemedi', type: 'error' });
    } finally {
      setPendingSlotActionId('');
    }
  };

  const handleFinalizeRescheduleFromAlerts = async (slot, decision) => {
    try {
      setPendingSlotActionId(slot._id);
      await api.patch(`/slots/${slot._id}/reschedule/finalize`, { decision });

      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
      ]);

      if (activeSection === 'calendar' && slotDate === todayIso) {
        await loadSlotsForDate(slotDate);
      }

      setActionMessage({
        text: decision === 'approve'
          ? 'Saat değişikliği son onaylandı ve müşteriye bildirildi.'
          : 'Saat değişikliği reddedildi, önceki saat korundu.',
        type: 'success',
      });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Final onay işlemi tamamlanamadı', type: 'error' });
    } finally {
      setPendingSlotActionId('');
    }
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
      {showMobileMenu && (
        <button
          type="button"
          className="mobile-menu-overlay"
          aria-label="Menüyü kapat"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

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

          <div className="topbar-actions" ref={headerMenuRef}>
            <button type="button" className="topbar-action-btn" title="Bildirimler">
              🔔
            </button>
            <button
              type="button"
              className="topbar-profile"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              aria-label="Profil menüsü"
            >
              <div className="topbar-profile-avatar">{barberInitials}</div>
              <div className="topbar-profile-name">{barber?.salonName || 'Berber'}</div>
            </button>

            {showProfileMenu && (
              <div className="topbar-menu-pop card shadow-sm">
                <div className="card-body">
                  <h6 className="card-title mb-3">Berber Hesabı</h6>
                  <p className="mb-1"><strong>Ad Soyad:</strong> {barber?.name || '-'} {barber?.surname || ''}</p>
                  <p className="mb-1"><strong>Salon:</strong> {barber?.salonName || '-'}</p>
                  <p className="mb-3"><strong>E-posta:</strong> {barber?.email || '-'}</p>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setActiveSection('profile');
                        setShowProfileMenu(false);
                      }}
                    >
                      Profil Bilgilerim
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm ms-auto"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                    >
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="content">
          {/* Main Section */}
          {activeSection === 'home' && (
            <div className="barber-home-dashboard">
              <div className="barber-home-hero">
                <div className="barber-home-hero-copy">
                  <div className="barber-home-kicker">İşletme Kontrol Merkezi</div>
                  <h1 className="page-title barber-home-title">Hoş geldiniz, {barber?.salonName || 'Berber'}</h1>
                  <p className="page-subtitle barber-home-subtitle">
                    {barber.subscription?.plan?.toUpperCase()} paketiniz aktif. Bugünün doluluğunu, hızlı aksiyonları ve profil eksiklerini tek ekranda görün.
                  </p>
                  <div className="barber-home-meta">
                    <span className="barber-home-pill">Plan: {barber.subscription?.plan || 'basic'}</span>
                    <span className="barber-home-pill">E-posta: {String(barber?.email || '').trim() ? 'Tamam' : 'Eksik'}</span>
                    <span className="barber-home-pill">Çalışma günü: {activeWorkingDays}</span>
                  </div>
                </div>

                <div className="barber-home-hero-stat">
                  <div className="barber-home-hero-stat-label">Bugünkü onaylı ciro</div>
                  <div className="barber-home-hero-stat-value">₺{dashboardRevenueEstimate.toLocaleString('tr-TR')}</div>
                  <div className="barber-home-hero-stat-subtitle">Onaylı randevu fiyatlarının toplamı</div>
                </div>
              </div>

              <div className="barber-home-actions-grid">
                {quickActions.map((item) => (
                  <button key={item.key} type="button" className="barber-home-action-card" onClick={item.action}>
                    <span className="barber-home-action-icon">{item.icon}</span>
                    <span className="barber-home-action-body">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="barber-home-panel barber-home-alert-queue-panel">
                <div className="barber-home-panel-head">
                  <div>
                    <h4 className="barber-home-panel-title">Uyarılar</h4>
                    <p className="barber-home-panel-subtitle">Yeni gelen randevular burada görünür. Onaylayabilir, iptal edebilir veya saati güncelleyebilirsiniz.</p>
                  </div>
                  <span className="barber-home-panel-badge info">{actionableAlertCount} aksiyon bekliyor</span>
                </div>

                {dashboardBookedSlots.length > 0 ? (
                  <div className="barber-home-alert-queue-list">
                    {dashboardBookedSlots.map((slot) => {
                      const slotStatusLc = String(slot.status || '').toLowerCase();
                      const isSaving = pendingSlotActionId === slot._id;
                      const isEditing = editingAlertSlotId === slot._id;
                      const draft = alertRescheduleDrafts[slot._id] || { date: slot.date, time: slot.time };

                      return (
                        <div key={slot._id} className="barber-home-alert-queue-item">
                          <div className="barber-home-alert-queue-meta">
                            <div className="barber-home-alert-queue-title">{slot.customerName || slot.customer?.name || 'İsimsiz Müşteri'}</div>
                            <div className="barber-home-alert-queue-subtitle">
                              {slotStatusLc === 'reschedule_pending_customer'
                                ? `${slot.rescheduleApproval?.oldDate || slot.date} • ${slot.rescheduleApproval?.oldTime || slot.time} → ${slot.rescheduleApproval?.proposedDate || '-'} ${slot.rescheduleApproval?.proposedTime || '-'} • Müşteri onayı bekleniyor`
                                : slotStatusLc === 'reschedule_pending_barber'
                                  ? `${slot.rescheduleApproval?.oldDate || slot.date} • ${slot.rescheduleApproval?.oldTime || slot.time} → ${slot.rescheduleApproval?.proposedDate || '-'} ${slot.rescheduleApproval?.proposedTime || '-'} • Son onay bekleniyor`
                                  : `${slot.date} • ${slot.time} • ${slot.service?.name || slot.customer?.service || 'Hizmet seçilmedi'}`}
                            </div>
                          </div>

                          {slotStatusLc === 'reschedule_pending_customer' ? (
                            <div className="barber-home-alert-queue-actions">
                              <span className="badge bg-warning text-dark">Müşteri yanıtı bekleniyor</span>
                            </div>
                          ) : slotStatusLc === 'reschedule_pending_barber' ? (
                            <div className="barber-home-alert-queue-actions">
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleFinalizeRescheduleFromAlerts(slot, 'approve')}
                                disabled={isSaving}
                              >
                                Son Onay Ver
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleFinalizeRescheduleFromAlerts(slot, 'reject')}
                                disabled={isSaving}
                              >
                                Son Onayı Reddet
                              </button>
                            </div>
                          ) : isEditing ? (
                            <div className="barber-home-alert-queue-editor">
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={draft.date || todayIso}
                                onChange={(e) => setAlertRescheduleDrafts((prev) => ({
                                  ...prev,
                                  [slot._id]: { ...draft, date: e.target.value },
                                }))}
                                disabled={isSaving}
                              />
                              <input
                                type="time"
                                className="form-control form-control-sm"
                                value={draft.time || ''}
                                onChange={(e) => setAlertRescheduleDrafts((prev) => ({
                                  ...prev,
                                  [slot._id]: { ...draft, time: e.target.value },
                                }))}
                                disabled={isSaving}
                              />
                              <div className="barber-home-alert-queue-actions compact">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleRescheduleFromAlerts(slot)}
                                  disabled={isSaving}
                                >
                                  Kaydet
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => setEditingAlertSlotId('')}
                                  disabled={isSaving}
                                >
                                  Vazgeç
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="barber-home-alert-queue-actions">
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleApproveFromAlerts(slot)}
                                disabled={isSaving}
                              >
                                Onayla
                              </button>
                              <button
                                type="button"
                                className="btn btn-warning btn-sm"
                                onClick={() => startRescheduleFromAlerts(slot)}
                                disabled={isSaving}
                              >
                                Saat Düzenle
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setConfirmAction({
                                  kind: 'cancel-alert',
                                  slot,
                                  title: 'Randevuyu İptal Et',
                                  message: `${slot.customerName || slot.customer?.name || 'Bu müşteri'} için iptal sebebini yazarak işlemi tamamlayın.`,
                                  confirmText: 'İptal Et',
                                  variant: 'danger',
                                  showReason: true,
                                  reasonValue: 'Berber tarafından iptal edildi',
                                })}
                                disabled={isSaving}
                              >
                                İptal
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="barber-home-empty-state">Şu an bekleyen yeni randevu yok.</div>
                )}
              </div>

              <div className="barber-home-panel barber-home-alert-queue-panel">
                <div className="barber-home-panel-head">
                  <div>
                    <h4 className="barber-home-panel-title">Onaylanan Randevular</h4>
                    <p className="barber-home-panel-subtitle">Onaylanan randevuları bugün ve yaklaşan olarak görün.</p>
                  </div>
                  <span className="barber-home-panel-badge success">{dashboardConfirmedSlots.length} onaylı</span>
                </div>

                {dashboardConfirmedSlots.length > 0 ? (
                  <div className="barber-home-alert-queue-list">
                    <div className="barber-home-confirmed-group">
                      <div className="barber-home-confirmed-group-title">Bugün ({todayConfirmedSlots.length})</div>
                      {todayConfirmedSlots.length > 0 ? todayConfirmedSlots.map((slot) => (
                        <div key={`confirmed-today-${slot._id}`} className="barber-home-alert-queue-item barber-home-confirmed-item">
                          <div className="barber-home-alert-queue-meta">
                            <div className="barber-home-alert-queue-title">{slot.customerName || slot.customer?.name || 'İsimsiz Müşteri'}</div>
                            <div className="barber-home-alert-queue-subtitle barber-home-confirmed-subtitle">
                              <span className="barber-home-confirmed-date">{formatDateDayMonthYear(slot.date)}</span>
                              <span className="barber-home-confirmed-time">{slot.time || '--:--'}</span>
                              <span>{slot.service?.name || slot.customer?.service || 'Hizmet seçilmedi'}</span>
                            </div>
                          </div>
                          <span className="badge bg-success">Bugün</span>
                        </div>
                      )) : <div className="barber-home-empty-state">Bugün onaylı randevu yok.</div>}
                    </div>

                    <div className="barber-home-confirmed-group">
                      <div className="barber-home-confirmed-group-title">Yaklaşan ({upcomingConfirmedSlots.length})</div>
                      {upcomingConfirmedSlots.length > 0 ? upcomingConfirmedSlots.slice(0, 8).map((slot) => (
                        <div key={`confirmed-upcoming-${slot._id}`} className="barber-home-alert-queue-item barber-home-confirmed-item">
                          <div className="barber-home-alert-queue-meta">
                            <div className="barber-home-alert-queue-title">{slot.customerName || slot.customer?.name || 'İsimsiz Müşteri'}</div>
                            <div className="barber-home-alert-queue-subtitle barber-home-confirmed-subtitle">
                              <span className="barber-home-confirmed-date">{formatDateDayMonthYear(slot.date)}</span>
                              <span className="barber-home-confirmed-time">{slot.time || '--:--'}</span>
                              <span>{slot.service?.name || slot.customer?.service || 'Hizmet seçilmedi'}</span>
                            </div>
                          </div>
                          <span className="badge bg-success">Yaklaşan</span>
                        </div>
                      )) : <div className="barber-home-empty-state">Yaklaşan onaylı randevu yok.</div>}
                    </div>
                  </div>
                ) : (
                  <div className="barber-home-empty-state">Henüz onaylanan randevu yok.</div>
                )}
              </div>

              <div className="stat-grid barber-home-stats-grid">
                <div className="stat-card">
                  <div className="stat-card-label">📅 Yeni Randevu</div>
                  <div className="stat-card-value">{dashboardAppointmentStats.newRequests}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">✅ Onaylı Randevu</div>
                  <div className="stat-card-value">{dashboardAppointmentStats.confirmed}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">⛔ Reddedilen Randevu</div>
                  <div className="stat-card-value">{dashboardAppointmentStats.cancelled}</div>
                </div>
              </div>

              <div className="barber-home-two-column">
                <div className="barber-home-panel">
                  <div className="barber-home-panel-head">
                    <div>
                      <h4 className="barber-home-panel-title">İşletme Durumu</h4>
                      <p className="barber-home-panel-subtitle">Açık/kapalı günler ve temel operasyon metrikleri.</p>
                    </div>
                    <span className={`barber-home-panel-badge ${profileFieldsCompletion >= 80 ? 'success' : 'warning'}`}>
                      {activeWorkingDays} Açık / {closedWorkingDays} Kapalı
                    </span>
                  </div>

                  <div className="barber-home-alert-grid">
                    {profileStatusCards.map((card) => (
                      <div key={card.key} className={`barber-home-alert-card ${card.tone}`}>
                        <div className="barber-home-alert-icon">{card.icon}</div>
                        <div className="barber-home-alert-copy">
                          <strong>{card.title}</strong>
                          <span>{card.value}</span>
                          <small>{card.description}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="barber-home-panel">
                  <div className="barber-home-panel-head">
                    <div>
                      <h4 className="barber-home-panel-title">Business Uyarıları</h4>
                      <p className="barber-home-panel-subtitle">Satış ve operasyonu etkileyen eksikleri görün.</p>
                    </div>
                    <span className="barber-home-panel-badge info">{businessAlerts.length} uyarı</span>
                  </div>

                  {businessAlerts.length > 0 ? (
                    <div className="barber-home-warning-list">
                      {businessAlerts.map((alert) => (
                        <div key={alert.key} className={`barber-home-warning-item ${alert.tone}`}>
                          <span className="barber-home-warning-icon">{alert.icon}</span>
                          <div className="barber-home-warning-copy">
                            <strong>{alert.title}</strong>
                            <p>{alert.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="barber-home-empty-state">
                      Tüm temel işletme ayarlarınız tamam. Şimdi doluluk ve satış optimizasyonuna odaklanabilirsiniz.
                    </div>
                  )}
                </div>
              </div>

              <div className="barber-home-two-column">
                <div className="barber-home-panel">
                  <div className="barber-home-panel-head">
                    <div>
                      <h4 className="barber-home-panel-title">Bugünün Operasyonu</h4>
                      <p className="barber-home-panel-subtitle">Slot ve stok mantığında günlük akışı özetleyin.</p>
                    </div>
                  </div>

                  <div className="barber-home-operation-grid">
                    <div className="barber-home-operation-card">
                      <span>Bugün ilk müsait saat</span>
                      <strong>{dashboardAppointmentStats.available > 0 ? 'Mevcut' : 'Doldu'}</strong>
                    </div>
                    <div className="barber-home-operation-card">
                      <span>İptal edilen slot</span>
                      <strong>{dashboardAppointmentStats.cancelled}</strong>
                    </div>
                    <div className="barber-home-operation-card">
                      <span>Çalışma günü</span>
                      <strong>{activeWorkingDays}</strong>
                    </div>
                    <div className="barber-home-operation-card">
                      <span>Onaylı ciro toplamı</span>
                      <strong>₺{dashboardRevenueEstimate.toLocaleString('tr-TR')}</strong>
                    </div>
                  </div>
                </div>

                <div className="barber-home-panel">
                  <div className="barber-home-panel-head">
                    <div>
                      <h4 className="barber-home-panel-title">Son Aktivite</h4>
                      <p className="barber-home-panel-subtitle">Bugün seçilen tarih için slot durumu.</p>
                    </div>
                  </div>

                  {dashboardSlots.length > 0 ? (
                    <div className="barber-home-activity-list">
                      {dashboardSlots.slice(0, 6).map((slot) => (
                        <div key={slot._id} className="barber-home-activity-item">
                          <div>
                            <strong>{slot.time}</strong>
                            <p>{slot.customerName || slot.customer?.name || 'Müsait slot'}</p>
                          </div>
                          <span className={`badge ${slot.status === 'confirmed' ? 'bg-success' : slot.status === 'available' ? 'bg-secondary' : 'bg-danger'}`}>
                            {slot.status === 'confirmed'
                              ? 'Onaylı'
                              : slot.status === 'available'
                                ? 'Müsait'
                                : slot.status === 'booked'
                                  ? 'Bekliyor'
                                  : slot.status === 'reschedule_pending_customer'
                                    ? 'Müşteri Onayı'
                                    : slot.status === 'reschedule_pending_barber'
                                      ? 'Son Onay'
                                      : 'İptal'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="barber-home-empty-state">
                      Bugün için veri yok. Takvim bölümünden slotları kontrol edebilirsiniz.
                    </div>
                  )}
                </div>
              </div>

              <div className="info-card mt-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <h4 className="mb-1">Üyelik Bilgileri</h4>
                    <p className="mb-0 text-muted">Plan ve yenileme tarihini takip edin.</p>
                  </div>
                  <span className="badge bg-primary">{barber.subscription?.plan?.toUpperCase()}</span>
                </div>
                <div className="mt-3 d-flex flex-wrap gap-3">
                  <div><strong>Plan:</strong> {barber.subscription?.plan}</div>
                  <div><strong>Bitiş Tarihi:</strong> {new Date(barber.subscription?.expiresAt).toLocaleDateString('tr-TR')}</div>
                </div>
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
                  <div className="barber-calendar-pill">5 Gün</div>
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

              {visibleMySlots.length > 0 ? (
                <div className="barber-calendar-slots">
                  <div className="barber-calendar-slots-header">
                    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                      <h4 className="mb-0">Seçilen Tarih: {new Date(`${slotDate}T00:00:00`).toLocaleDateString('tr-TR')}</h4>
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
                  </div>
                  <div className="barber-slots-grid">
                    {visibleMySlots.map(s => {
                      const statusLc = String(s.status || '').toLowerCase();
                      const hasAppointment = Boolean(s.customerName || s.customer?.name);
                      const showPastOnly = s.isPastSlot && statusLc === 'available' && !hasAppointment;
                      const hideActions = s.isPastSlot;
                      const canEditManual = !s.isPastSlot && Boolean(s.isManualAppointment);
                      const canManageAvailability = !s.isPastSlot && ['available', 'blocked'].includes(statusLc);

                      return (
                      <div key={s._id} className={`barber-slot-card barber-slot-${s.status} ${s.isPastSlot ? 'barber-slot-past' : ''}`}>
                        <div className="barber-slot-time">
                          <div className="barber-slot-time-value">{s.time}</div>
                          <div className="barber-slot-time-label">Saat</div>
                        </div>
                        <div className="barber-slot-info">
                          <div className="barber-slot-status">
                            <span className={`badge ${showPastOnly ? 'bg-dark' : (s.status === 'confirmed' ? 'bg-success' : s.status === 'available' ? 'bg-secondary' : s.status === 'booked' ? 'bg-info' : 'bg-danger')}`}>
                              {showPastOnly ? 'Geçti' : (s.status === 'confirmed' ? '✓ Onaylı' : s.status === 'available' ? '◯ Müsait' : s.status === 'booked' ? '◇ Yeni' : '✗ Kapalı')}
                            </span>
                          </div>
                          {(s.customerName || s.customer?.name) && (
                            <div className="barber-slot-customer">
                              {s.customerName || s.customer?.name}
                            </div>
                          )}
                          {s.service?.name && (
                            <div className="barber-slot-service">
                              {s.service.name}
                            </div>
                          )}
                        </div>
                        {!hideActions && <div className="barber-slot-actions">
                          {canEditManual && (
                            <button title="Düzenle" className="barber-slot-action-btn" onClick={() => {
                              setSelectedSlotForEdit(s);
                              setShowEditSlot(true);
                            }}>
                              ✏️
                            </button>
                          )}
                          {canManageAvailability && s.status === 'available' && (
                            <button title="Randevu Ekle" className="barber-slot-action-btn" onClick={() => {
                              setSelectedSlotForManual(s);
                              setShowCreateManualSlot(true);
                            }}>
                              ➕
                            </button>
                          )}
                          {canManageAvailability && <button
                            title={s.status === 'blocked' ? 'Blokeyi Kaldır' : 'Bloke Et'}
                            className="barber-slot-action-btn barber-slot-action-block"
                            onClick={() => {
                              if (!['available', 'blocked'].includes(String(s.status || '').toLowerCase())) {
                                setSlotsError('Sadece müsait veya bloklu slotlar için bu işlem yapılabilir');
                                return;
                              }

                              const isUnblock = String(s.status || '').toLowerCase() === 'blocked';
                              setConfirmAction({
                                kind: 'toggle-availability',
                                slot: s,
                                newStatus: isUnblock ? 'available' : 'blocked',
                                title: isUnblock ? 'Blokeyi Kaldır' : 'Saati Bloke Et',
                                message: isUnblock
                                  ? 'Bu saatin blokesini kaldırmak istiyor musunuz? Slot yeniden müsait olacak.'
                                  : 'Bu saati bloke etmek istiyor musunuz? Slot müşterilere kapatılacak.',
                                confirmText: isUnblock ? 'Blokeyi Kaldır' : 'Bloke Et',
                                variant: isUnblock ? 'warning' : 'danger',
                              });
                            }}
                          >
                            🚫
                          </button>}
                          {canManageAvailability && <button title="Sil" className="barber-slot-action-btn barber-slot-action-delete" onClick={() => {
                            setConfirmAction({
                              kind: 'delete-slot',
                              slot: s,
                              title: 'Saati Sil',
                              message: 'Bu saati silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
                              confirmText: 'Sil',
                              variant: 'danger',
                            });
                          }}>
                            🗑️
                          </button>}
                        </div>}
                      </div>
                    )})}
                  </div>
                </div>
              ) : (
                <div className="barber-calendar-empty">
                  <div className="barber-calendar-empty-title">Bu tarihte randevu yok</div>
                </div>
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

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div>
              <h1 className="page-title">Profil Bilgilerim</h1>
              <p className="page-subtitle">Berber adı, iletişim ve şifre güncelleme alanı</p>
              <BarberProfile />
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div>
              <h1 className="page-title">Mağaza Ayarları</h1>
              <p className="page-subtitle">Profil ve işletme ayarlarınızı yönetin</p>
              <ShopSettings />
            </div>
          )}
        </div>
      </main>

      {/* Messages - Bootstrap Alerts */}
      {actionMessage.text && (
        <div
          className={`alert alert-dismissible fade show ${actionMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}
          role="alert"
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            zIndex: 1050,
            maxWidth: '420px',
            boxShadow: '0 12px 28px rgba(44, 62, 80, 0.15)'
          }}
        >
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

      {/* Modals */}
      <CreateManualSlotModal
        show={showCreateManualSlot}
        slot={selectedSlotForManual}
        services={services}
        onClose={() => {
          setShowCreateManualSlot(false);
          setSelectedSlotForManual(null);
        }}
        onSuccess={() => {
          loadSlotsForDate(slotDate);
          setShowCreateManualSlot(false);
          setSelectedSlotForManual(null);
        }}
      />
      <EditSlotModal
        show={showEditSlot}
        slot={selectedSlotForEdit}
        services={services}
        onClose={() => {
          setShowEditSlot(false);
          setSelectedSlotForEdit(null);
        }}
        onSuccess={() => {
          loadSlotsForDate(slotDate);
          setShowEditSlot(false);
          setSelectedSlotForEdit(null);
        }}
      />
    </div>
  );
}

export default BarberHome;
