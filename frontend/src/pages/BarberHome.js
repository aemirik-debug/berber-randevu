import React, { useState, useEffect, useMemo, useRef } from 'react';
import barberLogoSample from '../assets/barber-logo-sample.svg';
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
const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
const MASTER_PERMISSION_META = [
  { key: 'home', label: 'Ana Sayfa' },
  { key: 'calendar', label: 'Takvim' },
  { key: 'services', label: 'Hizmetler' },
  { key: 'stats', label: 'İstatistikler' },
  { key: 'settings', label: 'Mağaza Ayarları' },
  { key: 'masters', label: 'Usta Yönetimi' },
];
const defaultMasterPermissions = () => ({
  home: true,
  calendar: true,
  services: false,
  stats: false,
  settings: false,
  masters: false,
});
const buildEmptyMasterDraft = () => ({
  name: '',
  specialty: '',
  username: '',
  password: '',
  isActive: true,
  permissions: defaultMasterPermissions(),
});
const toLocalDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toSlotRevenueAmount = (slot) => {
  return Number(
    slot?.manualPrice
    ?? slot?.payment?.amount
    ?? slot?.service?.price
    ?? slot?.customer?.totalPrice
    ?? 0
  ) || 0;
};

const parseIsoDateParts = (dateStr) => {
  const [year, month, day] = String(dateStr || '').split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  return { year, monthIndex: month - 1, day };
};

const formatMonthRange = (year, monthIndex) => {
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);
  return `${toLocalDateInput(startDate).split('-').reverse().join('.')} - ${toLocalDateInput(endDate).split('-').reverse().join('.')}`;
};

const getCurrentYearBounds = (year) => ({
  startDate: `${year}-01-01`,
  endDate: `${year}-12-31`,
});

const toDateTimeFromSlot = (slot) => {
  const date = String(slot?.date || '').trim();
  const time = String(slot?.time || '').trim().slice(0, 5);
  if (!date || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
    return null;
  }

  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const isCompletionActionReady = (slot, nowDate) => {
  const slotDateTime = toDateTimeFromSlot(slot);
  if (!slotDateTime) {
    return false;
  }

  return nowDate.getTime() >= (slotDateTime.getTime() + (60 * 60 * 1000));
};

const splitCustomerFullName = (slot) => {
  const rawName = String(slot?.customer?.name || slot?.customerName || '').trim();
  if (!rawName) {
    return { firstName: 'İsimsiz', lastName: 'Müşteri', fullName: 'İsimsiz Müşteri' };
  }

  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '-', fullName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    fullName: rawName,
  };
};

const getSlotServiceName = (slot) => slot?.service?.name || slot?.customer?.service || 'Hizmet seçilmedi';

const getSlotStatusLabel = (status) => {
  const statusLc = String(status || '').toLowerCase();
  if (statusLc === 'confirmed' || statusLc === 'completed') return 'Onaylı';
  if (statusLc === 'cancelled' || statusLc === 'rejected' || statusLc === 'reddedildi' || statusLc === 'rejected_by_barber') return 'Reddedildi';
  if (statusLc === 'booked') return 'Bekliyor';
  if (statusLc === 'reschedule_pending_customer') return 'Müşteri Onayı';
  if (statusLc === 'reschedule_pending_barber') return 'Son Onay';
  return 'Bilinmiyor';
};

const getSlotStatusTone = (status) => {
  const statusLc = String(status || '').toLowerCase();
  if (statusLc === 'confirmed' || statusLc === 'completed') return 'success';
  if (statusLc === 'cancelled' || statusLc === 'rejected' || statusLc === 'reddedildi' || statusLc === 'rejected_by_barber') return 'danger';
  if (statusLc === 'booked' || statusLc === 'reschedule_pending_customer' || statusLc === 'reschedule_pending_barber') return 'warning';
  return 'secondary';
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
  const [dashboardRevenueSlots, setDashboardRevenueSlots] = useState([]);
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
  const [summaryModal, setSummaryModal] = useState(null);
  const [completionNoticeModal, setCompletionNoticeModal] = useState({ show: false, text: '' });
  const [recentlyDeletedSlot, setRecentlyDeletedSlot] = useState(null);
  const [recentlyDeletedSlotId, setRecentlyDeletedSlotId] = useState('');
  const [mobileHomeTab, setMobileHomeTab] = useState('actions');
  const [masterDraft, setMasterDraft] = useState(buildEmptyMasterDraft());
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  const [editingHomeMasterIndex, setEditingHomeMasterIndex] = useState(-1);
  const [editingHomeMasterDraft, setEditingHomeMasterDraft] = useState(buildEmptyMasterDraft());
  const [currentUserRole, setCurrentUserRole] = useState('barber');
  const [currentMasterPermissions, setCurrentMasterPermissions] = useState(defaultMasterPermissions());
  const [slotMasterDrafts, setSlotMasterDrafts] = useState({});
  const todayIso = useMemo(() => toLocalDateInput(new Date()), []);
  const currentCalendarDate = useMemo(() => new Date(nowTick), [nowTick]);
  const currentYear = currentCalendarDate.getFullYear();
  const currentMonthIndex = currentCalendarDate.getMonth();
  const spotlightMeta = useMemo(() => {
    const hour = currentCalendarDate.getHours();
    if (hour < 12) {
      return {
        emoji: '☀️',
        title: 'Günün odağı',
        text: 'Sabah saatleri yeni müşteri kazanmak için en güçlü zaman. Uyarıları hızlı kapat, gününü temiz başlat.',
        tone: 'morning',
      };
    }

    if (hour < 18) {
      return {
        emoji: '🌤️',
        title: 'Günün odağı',
        text: 'Öğleden sonra randevu akışı hızlanır. Onay ve reschedule taleplerini sırayla kapat.',
        tone: 'day',
      };
    }

    return {
      emoji: '🌙',
      title: 'Günün odağı',
      text: 'Akşam kapanışa yakın en kritik şey yarının takvimi. Onaylı randevuları ve eksikleri gözden geçir.',
      tone: 'evening',
    };
  }, [currentCalendarDate]);
  const formatDateDayMonthYear = (dateStr) => {
    const [year, month, day] = String(dateStr || '').split('-');
    if (!year || !month || !day) {
      return dateStr || '-';
    }
    return `${day}.${month}.${year}`;
  };
  const formatDateTimeShortTr = (dateStr) => {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }
    return parsed.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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
      isPastSlot:
        String(slot.date || '') < todayIso
        || (String(slot.date || '') === todayIso && String(slot.time || '') <= nowTimeHHmm),
    }));
  }, [mySlots, slotDate, todayIso, nowTimeHHmm]);

  const calendarSlotsForView = useMemo(() => {
    if (currentUserRole === 'master') {
      return visibleMySlots;
    }

    return visibleMySlots.filter((slot) => {
      const statusLc = String(slot.status || '').toLowerCase();
      const hasAppointment = Boolean(slot.customerName || slot.customer?.name);
      const isMasterOwned = Boolean(slot.assignedMaster?.masterId);
      const isFilledAppointment = [
        'booked',
        'confirmed',
        'completed',
        'reschedule_pending_customer',
        'reschedule_pending_barber',
      ].includes(statusLc);

      // Isletme takviminde, usta tarafinda olusturulan dolu randevular gorunmez.
      if (isMasterOwned && hasAppointment && isFilledAppointment) {
        return false;
      }

      return true;
    });
  }, [visibleMySlots, currentUserRole]);

  const navigationItems = [
    { key: 'home', label: 'Ana Sayfa', icon: '🏠' },
    { key: 'services', label: 'Hizmetler', icon: '✂️', count: services.length },
    { key: 'masters', label: 'Ustalar', icon: '🧑‍🔧', count: Array.isArray(barber?.masters) ? barber.masters.length : 0 },
    { key: 'calendar', label: 'Takvim', icon: '📅' },
    { key: 'stats', label: 'İstatistikler', icon: '📊' },
    { key: 'settings', label: 'Mağaza Ayarları', icon: '⚙️' },
    { key: 'store', label: 'Berber Store', icon: '🛒' },
    { key: 'gallery', label: 'Galeri', icon: '🖼️' },
  ];
  const isMasterUser = currentUserRole === 'master';
  const canAccessSection = (sectionKey) => {
    if (!isMasterUser) {
      return true;
    }

    if (sectionKey === 'home') return currentMasterPermissions.home !== false;
    if (sectionKey === 'store') return true;
    if (sectionKey === 'gallery') return true;
    if (sectionKey === 'calendar') return Boolean(currentMasterPermissions.calendar);
    if (sectionKey === 'services') return Boolean(currentMasterPermissions.services);
    if (sectionKey === 'stats') return Boolean(currentMasterPermissions.stats);
    if (sectionKey === 'settings') return Boolean(currentMasterPermissions.settings);
    if (sectionKey === 'masters') return Boolean(currentMasterPermissions.masters);
    return false;
  };
  const visibleNavigationItems = useMemo(
    () => navigationItems.filter((item) => canAccessSection(item.key)),
    [navigationItems, currentUserRole, currentMasterPermissions]
  );

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

  const loadDashboardRevenueSlots = async () => {
    try {
      const runtimeYear = new Date().getFullYear();
      const { startDate, endDate } = getCurrentYearBounds(runtimeYear);
      const slotsRes = await api.get('/slots/my-slots', {
        params: {
          startDate,
          endDate,
        },
      });

      setDashboardRevenueSlots(slotsRes.data.data || []);
    } catch (slotErr) {
      console.error('Aylık ciro verileri yüklenemedi', slotErr);
      setDashboardRevenueSlots([]);
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
    const role = localStorage.getItem('barberRole') || 'barber';
    const permissionRaw = localStorage.getItem('masterPermissions');
    let parsedPermissions = defaultMasterPermissions();
    if (permissionRaw) {
      try {
        parsedPermissions = { ...defaultMasterPermissions(), ...JSON.parse(permissionRaw) };
      } catch (_) {
        parsedPermissions = defaultMasterPermissions();
      }
    }
    setCurrentUserRole(role);
    setCurrentMasterPermissions(parsedPermissions);

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
          loadDashboardRevenueSlots(),
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
          loadDashboardRevenueSlots(),
        ]);
      } catch (err) {
        console.error('Veri yükleme hatası', err);
        if (err.response?.status === 401) {
          localStorage.removeItem('barberToken');
          localStorage.removeItem('barberId');
          localStorage.removeItem('barberRole');
          localStorage.removeItem('masterId');
          localStorage.removeItem('masterPermissions');
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

  useEffect(() => {
    if (canAccessSection(activeSection)) {
      return;
    }
    setActiveSection('home');
  }, [activeSection, currentUserRole, currentMasterPermissions]);

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
        loadDashboardRevenueSlots(),
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
    const completed = dashboardSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'completed').length;
    const available = dashboardSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'available').length;
    const cancelled = dashboardSlots.filter((slot) => ['cancelled', 'rejected', 'reddedildi'].includes(String(slot.status || '').toLowerCase())).length;
    return {
      total: dashboardSlots.length,
      newRequests,
      confirmed,
      completed,
      available,
      cancelled,
    };
  }, [dashboardSlots]);
  const dashboardRevenueEstimate = useMemo(() => {
    const revenueStatuses = new Set(['confirmed', 'completed']);
    return dashboardRevenueSlots.reduce((sum, slot) => {
      const slotDateParts = parseIsoDateParts(slot.date);
      if (!slotDateParts || slotDateParts.year !== currentYear || slotDateParts.monthIndex !== currentMonthIndex) {
        return sum;
      }

      if (!revenueStatuses.has(String(slot.status || '').toLowerCase())) {
        return sum;
      }

      return sum + toSlotRevenueAmount(slot);
    }, 0);
  }, [dashboardRevenueSlots, currentMonthIndex, currentYear]);
  const monthlyRevenueList = useMemo(() => {
    const revenueStatuses = new Set(['confirmed', 'completed']);
    const monthMap = Array.from({ length: 12 }, (_, monthIndex) => ({
      key: `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`,
      monthIndex,
      label: MONTH_NAMES_TR[monthIndex] || new Intl.DateTimeFormat('tr-TR', { month: 'long' }).format(new Date(currentYear, monthIndex, 1)),
      range: formatMonthRange(currentYear, monthIndex),
      amount: 0,
      count: 0,
    }));

    dashboardRevenueSlots.forEach((slot) => {
      const slotDateParts = parseIsoDateParts(slot.date);
      if (!slotDateParts || slotDateParts.year !== currentYear) {
        return;
      }

      if (!revenueStatuses.has(String(slot.status || '').toLowerCase())) {
        return;
      }

      const bucket = monthMap[slotDateParts.monthIndex];
      if (!bucket) {
        return;
      }

      bucket.amount += toSlotRevenueAmount(slot);
      bucket.count += 1;
    });

    return monthMap.map((bucket) => ({
      ...bucket,
      isCurrentMonth: bucket.monthIndex === currentMonthIndex,
    }));
  }, [dashboardRevenueSlots, currentMonthIndex, currentYear]);
  const monthlyRevenueTrend = useMemo(() => {
    const currentMonth = monthlyRevenueList.find((month) => month.isCurrentMonth) || null;
    const previousMonthIndex = (currentMonthIndex + 11) % 12;
    const previousMonth = monthlyRevenueList.find((month) => month.monthIndex === previousMonthIndex) || null;
    const currentAmount = currentMonth?.amount || 0;
    const previousAmount = previousMonth?.amount || 0;
    const diff = currentAmount - previousAmount;
    const percentChange = previousAmount > 0 ? Math.round((diff / previousAmount) * 100) : null;

    return {
      currentMonth,
      previousMonth,
      diff,
      percentChange,
      isIncrease: diff >= 0,
    };
  }, [currentMonthIndex, monthlyRevenueList]);
  const revenueChartMonths = useMemo(() => {
    return monthlyRevenueList.slice(-6);
  }, [monthlyRevenueList]);
  const revenueChartMax = useMemo(() => {
    return Math.max(...revenueChartMonths.map((month) => Number(month.amount || 0)), 1);
  }, [revenueChartMonths]);
  const topServices = useMemo(() => {
    const revenueStatuses = new Set(['confirmed', 'completed']);
    const serviceMap = new Map();

    dashboardRevenueSlots.forEach((slot) => {
      const statusLc = String(slot.status || '').toLowerCase();
      if (!revenueStatuses.has(statusLc)) {
        return;
      }

      const serviceName = String(getSlotServiceName(slot) || '').trim() || 'Hizmet seçilmedi';
      const existing = serviceMap.get(serviceName) || { name: serviceName, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += toSlotRevenueAmount(slot);
      serviceMap.set(serviceName, existing);
    });

    return Array.from(serviceMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return b.revenue - a.revenue;
      })
      .slice(0, 6);
  }, [dashboardRevenueSlots]);
  const masterPerformanceStats = useMemo(() => {
    if (isMasterUser) {
      return [];
    }

    const revenueStatuses = new Set(['confirmed', 'completed']);
    const masterMap = new Map();

    dashboardRevenueSlots.forEach((slot) => {
      const statusLc = String(slot.status || '').toLowerCase();
      if (!revenueStatuses.has(statusLc)) {
        return;
      }

      const masterId = String(slot?.assignedMaster?.masterId || '').trim();
      if (!masterId) {
        return;
      }

      const masterName = String(slot?.assignedMaster?.name || 'İsimsiz Usta').trim() || 'İsimsiz Usta';
      const existing = masterMap.get(masterId) || { id: masterId, name: masterName, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += toSlotRevenueAmount(slot);
      masterMap.set(masterId, existing);
    });

    return Array.from(masterMap.values())
      .sort((a, b) => {
        if (b.revenue !== a.revenue) {
          return b.revenue - a.revenue;
        }
        return b.count - a.count;
      })
      .slice(0, 6);
  }, [dashboardRevenueSlots, isMasterUser]);
  const actionableDecisionRate = useMemo(() => {
    const decidedTotal = dashboardAppointmentStats.confirmed + dashboardAppointmentStats.completed + dashboardAppointmentStats.cancelled;
    if (decidedTotal === 0) {
      return 0;
    }
    return Math.round(((dashboardAppointmentStats.confirmed + dashboardAppointmentStats.completed) / decidedTotal) * 100);
  }, [dashboardAppointmentStats]);
  const statsStatusItems = useMemo(() => {
    const rows = [
      { key: 'new', label: 'Yeni Talepler', value: dashboardAppointmentStats.newRequests },
      { key: 'confirmed', label: 'Onaylanan', value: dashboardAppointmentStats.confirmed },
      { key: 'completed', label: 'Tamamlanan', value: dashboardAppointmentStats.completed },
      { key: 'cancelled', label: 'Reddedilen/İptal', value: dashboardAppointmentStats.cancelled },
      { key: 'available', label: 'Müsait Slotlar', value: dashboardAppointmentStats.available },
    ];
    const maxValue = Math.max(...rows.map((row) => row.value), 1);

    return rows.map((row) => ({
      ...row,
      percent: Math.round((row.value / maxValue) * 100),
    }));
  }, [dashboardAppointmentStats]);
  const confirmedSummarySlots = useMemo(() => {
    return dashboardRevenueSlots
      .filter((slot) => ['confirmed', 'completed'].includes(String(slot.status || '').toLowerCase()))
      .sort((a, b) => {
        const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return String(a.time || '').localeCompare(String(b.time || ''));
      });
  }, [dashboardRevenueSlots]);
  const todayApprovedSummarySlots = useMemo(() => {
    return dashboardSlots
      .filter((slot) => {
        if (String(slot.date || '') !== todayIso) {
          return false;
        }
        return ['confirmed', 'completed'].includes(String(slot.status || '').toLowerCase());
      })
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [dashboardSlots, todayIso]);
  const rejectedSummarySlots = useMemo(() => {
    return dashboardRevenueSlots
      .filter((slot) => ['cancelled', 'rejected', 'reddedildi', 'rejected_by_barber'].includes(String(slot.status || '').toLowerCase()))
      .sort((a, b) => {
        const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return String(a.time || '').localeCompare(String(b.time || ''));
      });
  }, [dashboardRevenueSlots]);
  const currentMonthSummarySlots = useMemo(() => {
    return dashboardRevenueSlots
      .filter((slot) => {
        const slotDateParts = parseIsoDateParts(slot.date);
        if (!slotDateParts || slotDateParts.year !== currentYear || slotDateParts.monthIndex !== currentMonthIndex) {
          return false;
        }

        return ['confirmed', 'completed'].includes(String(slot.status || '').toLowerCase());
      })
      .sort((a, b) => {
        const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return String(a.time || '').localeCompare(String(b.time || ''));
      });
  }, [dashboardRevenueSlots, currentMonthIndex, currentYear]);
  const summaryModalData = useMemo(() => {
    if (!summaryModal) {
      return null;
    }

    if (summaryModal.type === 'today-approved') {
      return {
        title: 'Bugünkü Onaylı Randevular',
        subtitle: 'Bugün onaylanan ve tamamlanan tüm randevular',
        items: todayApprovedSummarySlots,
      };
    }

    if (summaryModal.type === 'rejected') {
      return {
        title: 'Reddedilen Randevular',
        subtitle: 'Reddedilen ve iptal edilen randevuların detayları',
        items: rejectedSummarySlots,
      };
    }

    return {
      title: 'Bu Ayki Randevular',
      subtitle: `${MONTH_NAMES_TR[currentMonthIndex]} ayı onaylanan randevuların detayları`,
      items: currentMonthSummarySlots,
    };
  }, [currentMonthIndex, currentMonthSummarySlots, rejectedSummarySlots, summaryModal, todayApprovedSummarySlots]);
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
  const latestReviews = useMemo(() => {
    const reviews = Array.isArray(barber?.reviews) ? barber.reviews : [];
    return [...reviews]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [barber]);
  const salonMasters = useMemo(() => {
    return Array.isArray(barber?.masters) ? barber.masters : [];
  }, [barber]);
  const homeVisibleMasters = useMemo(() => salonMasters.slice(0, 5), [salonMasters]);
  const openSummaryModal = (type) => setSummaryModal({ type });
  const closeSummaryModal = () => setSummaryModal(null);
  const mobileSectionClass = (tabKey) => `barber-mobile-section ${mobileHomeTab === tabKey ? '' : 'is-mobile-hidden'}`;
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
    localStorage.removeItem('barberRole');
    localStorage.removeItem('masterId');
    localStorage.removeItem('masterPermissions');
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
      return;
    }

    if (action.kind === 'cancel-slot') {
      await handleCancelSlotFromCalendar(action.slot, action.reasonValue || 'Takvimden kaldırıldı');
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

  const handleCompleteConfirmedSlot = async (slot) => {
    try {
      setPendingSlotActionId(slot._id);
      await api.patch(`/slots/${slot._id}/action`, {
        action: 'complete',
      });

      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
        loadDashboardRevenueSlots(),
      ]);

      if (activeSection === 'calendar' && slotDate === todayIso) {
        await loadSlotsForDate(slotDate);
      }

      setActionMessage({ text: 'Randevu tamamlandı olarak işaretlendi.', type: 'success' });
      setCompletionNoticeModal({
        show: true,
        text: 'Randevu tamamlandı olarak işaretlendi.',
      });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Randevu tamamlanamadı', type: 'error' });
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
      setSlotsError('');
      if (!slot?.isManualAppointment) {
        throw new Error('Sadece manuel oluşturduğunuz randevuları gizleyebilirsiniz');
      }
      if (slot?.isHistoricalRecord) {
        throw new Error('Tarihi kayıtlar gizlenemez');
      }
      await api.delete(`/slots/${slot._id}`);
      setRecentlyDeletedSlot({
        _id: slot._id,
        customerName: slot.customerName || slot.customer?.name || 'Müşteri',
        date: slot.date,
        time: slot.time,
      });
      setRecentlyDeletedSlotId(String(slot._id));
      await loadSlotsForDate(slotDate);
    } catch (err) {
      setSlotsError(err.response?.data?.error || err.message || 'Saat silinemedi');
    } finally {
      setPendingSlotActionId('');
    }
  };

  const handleCancelSlotFromCalendar = async (slot, reason = 'Takvimden kaldırıldı') => {
    try {
      setPendingSlotActionId(slot._id);
      setSlotsError('');

      await api.patch(`/slots/${slot._id}/cancel`, { reason });

      await Promise.all([
        loadSlotsForDate(slotDate),
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
        loadDashboardRevenueSlots(),
      ]);

      setActionMessage({ text: 'Randevu iptal edildi.', type: 'success' });
    } catch (err) {
      setSlotsError(err.response?.data?.error || 'Randevu iptal edilemedi');
    } finally {
      setPendingSlotActionId('');
    }
  };

  const handleUndoDeleteSlot = async () => {
    if (!recentlyDeletedSlot?._id) {
      return;
    }

    try {
      setPendingSlotActionId(recentlyDeletedSlot._id);
      setSlotsError('');
      await api.patch(`/slots/${recentlyDeletedSlot._id}/restore`);
      await loadSlotsForDate(slotDate);
      setRecentlyDeletedSlot(null);
      setRecentlyDeletedSlotId('');
    } catch (err) {
      setSlotsError(err.response?.data?.error || 'Randevu geri alınamadı');
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

  const handleAddMaster = async (e) => {
    e.preventDefault();

    const name = String(masterDraft.name || '').trim();
    const specialty = String(masterDraft.specialty || '').trim();
    const username = String(masterDraft.username || '').trim().toLowerCase();
    const password = String(masterDraft.password || '').trim();

    if (!name) {
      setActionMessage({ text: 'Usta adı zorunludur', type: 'error' });
      return;
    }

    if (!username || username.length < 3) {
      setActionMessage({ text: 'Usta kullanıcı adı en az 3 karakter olmalıdır', type: 'error' });
      return;
    }

    if (!password || password.length < 6) {
      setActionMessage({ text: 'Usta şifresi en az 6 karakter olmalıdır', type: 'error' });
      return;
    }

    const nextMasters = [
      ...salonMasters,
      {
        name,
        specialty,
        username,
        password,
        permissions: { ...defaultMasterPermissions(), ...(masterDraft.permissions || {}) },
        isActive: true,
      },
    ];

    try {
      setIsSavingMaster(true);
      const res = await api.patch('/barbers/profile', { masters: nextMasters });
      const updatedBarber = res.data?.data || null;

      if (updatedBarber) {
        setBarber(updatedBarber);
      } else {
        const profileRes = await api.get('/barbers/profile');
        setBarber(profileRes.data || {});
      }

      setMasterDraft(buildEmptyMasterDraft());
      setActionMessage({ text: 'Usta eklendi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Usta eklenemedi', type: 'error' });
    } finally {
      setIsSavingMaster(false);
    }
  };

  const startEditHomeMaster = (master, index) => {
    setEditingHomeMasterIndex(index);
    setEditingHomeMasterDraft({
      name: String(master?.name || ''),
      specialty: String(master?.specialty || ''),
      username: String(master?.username || ''),
      password: '',
      isActive: master?.isActive !== false,
      permissions: { ...defaultMasterPermissions(), ...(master?.permissions || {}) },
    });
  };

  const cancelEditHomeMaster = () => {
    setEditingHomeMasterIndex(-1);
    setEditingHomeMasterDraft(buildEmptyMasterDraft());
  };

  const handleUpdateHomeMaster = async (index) => {
    const name = String(editingHomeMasterDraft.name || '').trim();
    const specialty = String(editingHomeMasterDraft.specialty || '').trim();
    const username = String(editingHomeMasterDraft.username || '').trim().toLowerCase();
    const password = String(editingHomeMasterDraft.password || '').trim();

    if (!name) {
      setActionMessage({ text: 'Usta adı zorunludur', type: 'error' });
      return;
    }

    if (!username || username.length < 3) {
      setActionMessage({ text: 'Usta kullanıcı adı en az 3 karakter olmalıdır', type: 'error' });
      return;
    }

    if (password && password.length < 6) {
      setActionMessage({ text: 'Yeni şifre en az 6 karakter olmalıdır', type: 'error' });
      return;
    }

    const nextMasters = salonMasters.map((master, currentIndex) => (
      currentIndex === index
        ? {
            _id: master?._id,
            ...master,
            name,
            specialty,
            username,
            permissions: { ...defaultMasterPermissions(), ...(editingHomeMasterDraft.permissions || {}) },
            isActive: editingHomeMasterDraft.isActive !== false,
            ...(password ? { password } : {}),
          }
        : master
    ));

    try {
      setIsSavingMaster(true);
      const res = await api.patch('/barbers/profile', { masters: nextMasters });
      setBarber(res.data?.data || barber);
      cancelEditHomeMaster();
      setActionMessage({ text: 'Usta bilgisi güncellendi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Usta güncellenemedi', type: 'error' });
    } finally {
      setIsSavingMaster(false);
    }
  };

  const handleDeleteHomeMaster = async (index) => {
    const target = salonMasters[index];
    const targetName = String(target?.name || 'Bu usta');
    const isConfirmed = window.confirm(`${targetName} kaydını silmek istiyor musunuz?`);
    if (!isConfirmed) {
      return;
    }

    const nextMasters = salonMasters.filter((_, currentIndex) => currentIndex !== index);

    try {
      setIsSavingMaster(true);
      const res = await api.patch('/barbers/profile', { masters: nextMasters });
      setBarber(res.data?.data || barber);
      if (editingHomeMasterIndex === index) {
        cancelEditHomeMaster();
      }
      setActionMessage({ text: 'Usta silindi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Usta silinemedi', type: 'error' });
    } finally {
      setIsSavingMaster(false);
    }
  };

  const handleAssignMasterToSlot = async (slot, masterId) => {
    try {
      setPendingSlotActionId(slot._id);
      await api.patch(`/slots/${slot._id}/assign-master`, {
        masterId: masterId || null,
      });

      if (activeSection === 'calendar') {
        await loadSlotsForDate(slotDate);
      }

      await Promise.all([
        loadDashboardSlotsForToday(),
        loadDashboardPendingSlots(),
      ]);

      setActionMessage({ text: 'Usta ataması güncellendi.', type: 'success' });
    } catch (err) {
      setActionMessage({ text: err.response?.data?.error || 'Usta ataması güncellenemedi', type: 'error' });
    } finally {
      setPendingSlotActionId('');
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
        {/* Büyük logo sadece masaüstünde */}
        <div className="sidebar-logo d-none d-lg-flex">
          <img
            src={barberLogoSample}
            alt="Berber Paneli Logo"
            style={{ width: '200px', height: '190px', objectFit: 'cover', borderRadius: '30%' }}
          />
        </div>
        {/* Küçük logo sadece mobilde, menü açıldığında Ana Sayfa'nın üstünde */}
        {showMobileMenu && (
          <div className="sidebar-logo d-flex d-lg-none justify-content-center align-items-center" style={{marginBottom: '1rem'}}>
            <img
              src={barberLogoSample}
              alt="Berber Paneli Logo"
              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%' }}
            />
          </div>
        )}
        <nav className="sidebar-nav">
          {visibleNavigationItems.map(renderNavItem)}
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
                    Bu ayın doluluğunu, hızlı aksiyonları ve profil eksiklerini tek ekranda görün.
                  </p>
                  <div className="barber-home-meta">
                    <span className="barber-home-pill">E-posta: {String(barber?.email || '').trim() ? 'Tamam' : 'Eksik'}</span>
                    <span className="barber-home-pill">Çalışma günü: {activeWorkingDays}</span>
                  </div>
                </div>


                <div className="barber-home-hero-stat">
                  <div className="barber-home-hero-stat-label">Bu ay onaylı ciro</div>
                  <div className="barber-home-hero-stat-value">₺{dashboardRevenueEstimate.toLocaleString('tr-TR')}</div>
                  <div className="barber-home-hero-stat-subtitle">{formatMonthRange(currentYear, currentMonthIndex)} arası onaylı ve tamamlanan randevular</div>
                </div>
              </div>

              <div className={`barber-home-panel barber-home-critical-panel mt-3 barber-home-spotlight-${spotlightMeta.tone}`}>
                <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #fff3cd 0%, #fde68a 100%)', fontSize: '1.4rem' }}>
                      {spotlightMeta.emoji}
                    </div>
                    <div>
                      <div className="barber-home-panel-title mb-1">{spotlightMeta.title}</div>
                      <div className="barber-home-panel-subtitle mb-0">{spotlightMeta.text}</div>
                    </div>
                  </div>
                  <span className="badge rounded-pill bg-dark text-white align-self-center">{currentCalendarDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className={`barber-home-panel barber-home-alert-queue-panel barber-home-critical-panel ${mobileSectionClass('actions')}`}>
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

              <div className="barber-home-mobile-tabs" role="tablist" aria-label="Mobil ana sayfa sekmeleri">
                <button type="button" className={`barber-home-mobile-tab ${mobileHomeTab === 'actions' ? 'active' : ''}`} onClick={() => setMobileHomeTab('actions')}>Aksiyon</button>
                <button type="button" className={`barber-home-mobile-tab ${mobileHomeTab === 'today' ? 'active' : ''}`} onClick={() => setMobileHomeTab('today')}>Bugün</button>
                <button type="button" className={`barber-home-mobile-tab ${mobileHomeTab === 'revenue' ? 'active' : ''}`} onClick={() => setMobileHomeTab('revenue')}>Yorumlar</button>
                <button type="button" className={`barber-home-mobile-tab ${mobileHomeTab === 'settings' ? 'active' : ''}`} onClick={() => setMobileHomeTab('settings')}>Ayarlar</button>
              </div>

              <div className={`barber-home-actions-strip ${mobileSectionClass('actions')}`}>
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

              <div className={`barber-home-panel barber-home-alert-queue-panel barber-home-confirmed-panel ${mobileSectionClass('today')}`}>
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
                      {todayConfirmedSlots.length > 0 ? todayConfirmedSlots.map((slot) => {
                        const isSaving = pendingSlotActionId === slot._id;
                        const canShowCompleteAction = isCompletionActionReady(slot, currentCalendarDate);
                        const confirmedMasterName = String(slot?.assignedMaster?.name || '').trim();

                        return (
                          <div key={`confirmed-today-${slot._id}`} className="barber-home-alert-queue-item barber-home-confirmed-item">
                            <div className="barber-home-alert-queue-meta">
                              <div className="barber-home-alert-queue-title">{slot.customerName || slot.customer?.name || 'İsimsiz Müşteri'}</div>
                              <div className="barber-home-alert-queue-subtitle barber-home-confirmed-subtitle">
                                <span className="barber-home-confirmed-date">{formatDateDayMonthYear(slot.date)}</span>
                                <span className="barber-home-confirmed-time">{slot.time || '--:--'}</span>
                                {confirmedMasterName && (
                                  <span className="barber-home-confirmed-master">🧑‍🔧 {confirmedMasterName}</span>
                                )}
                                <span>{slot.service?.name || slot.customer?.service || 'Hizmet seçilmedi'}</span>
                              </div>
                            </div>
                            <div className="barber-home-alert-queue-actions">
                              <span className="badge bg-success">Bugün</span>
                              {canShowCompleteAction && (
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() => handleCompleteConfirmedSlot(slot)}
                                  disabled={isSaving}
                                >
                                  Tamamlandı
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }) : <div className="barber-home-empty-state">Bugün onaylı randevu yok.</div>}
                    </div>

                    <div className="barber-home-confirmed-group">
                      <div className="barber-home-confirmed-group-title">Yaklaşan ({upcomingConfirmedSlots.length})</div>
                      {upcomingConfirmedSlots.length > 0 ? upcomingConfirmedSlots.slice(0, 8).map((slot) => {
                        const confirmedMasterName = String(slot?.assignedMaster?.name || '').trim();
                        return (
                          <div key={`confirmed-upcoming-${slot._id}`} className="barber-home-alert-queue-item barber-home-confirmed-item">
                            <div className="barber-home-alert-queue-meta">
                              <div className="barber-home-alert-queue-title">{slot.customerName || slot.customer?.name || 'İsimsiz Müşteri'}</div>
                              <div className="barber-home-alert-queue-subtitle barber-home-confirmed-subtitle">
                                <span className="barber-home-confirmed-date">{formatDateDayMonthYear(slot.date)}</span>
                                <span className="barber-home-confirmed-time">{slot.time || '--:--'}</span>
                                {confirmedMasterName && (
                                  <span className="barber-home-confirmed-master">🧑‍🔧 {confirmedMasterName}</span>
                                )}
                                <span>{slot.service?.name || slot.customer?.service || 'Hizmet seçilmedi'}</span>
                              </div>
                            </div>
                            <span className="badge bg-success">Yaklaşan</span>
                          </div>
                        );
                      }) : <div className="barber-home-empty-state">Yaklaşan onaylı randevu yok.</div>}
                    </div>
                  </div>
                ) : (
                  <div className="barber-home-empty-state">Henüz onaylanan randevu yok.</div>
                )}
              </div>

              <div className={`stat-grid barber-home-stats-grid ${mobileSectionClass('today')}`}>
                <button type="button" className="stat-card barber-home-stat-card-button" onClick={() => openSummaryModal('today-approved')}>
                  <div className="stat-card-label">✅ Bugünkü Onaylı Randevu</div>
                  <div className="stat-card-value">{todayApprovedSummarySlots.length}</div>
                </button>
                <button type="button" className="stat-card barber-home-stat-card-button" onClick={() => openSummaryModal('rejected')}>
                  <div className="stat-card-label">⛔ Reddedilen Randevu</div>
                  <div className="stat-card-value">{dashboardAppointmentStats.cancelled}</div>
                </button>
                <button type="button" className="stat-card barber-home-stat-card-button" onClick={() => openSummaryModal('current-month')}>
                  <div className="stat-card-label">📆 Bu Ayki Randevu</div>
                  <div className="stat-card-value">{currentMonthSummarySlots.length}</div>
                </button>
              </div>

              <div className={`barber-home-two-column barber-home-lower-grid ${mobileSectionClass('settings')}`}>
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

                <div className="barber-home-panel barber-home-monthly-panel">
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

              <div className={`barber-home-two-column ${mobileSectionClass('revenue')}`}>
                <div className="barber-home-panel">
                  <div className="barber-home-panel-head">
                    <div>
                      <h4 className="barber-home-panel-title">Müşteri Yorumları</h4>
                      <p className="barber-home-panel-subtitle">Müşterilerden gelen son yorumları burada görün.</p>
                    </div>
                    <span className="barber-home-panel-badge info">{latestReviews.length} yorum</span>
                  </div>

                  {latestReviews.length > 0 ? (
                    <div className="barber-home-review-list">
                      {latestReviews.map((review, index) => (
                        <div key={`${review.customerId || 'customer'}-${review.createdAt || index}`} className="barber-home-review-item">
                          <div className="barber-home-review-head">
                            <strong>{review.customerName || 'Müşteri'}</strong>
                            <span>⭐ {Number(review.rating || 0).toFixed(1)}</span>
                          </div>
                          <p>{String(review.comment || '').trim() || 'Yorum bırakılmadı.'}</p>
                          <small>{formatDateTimeShortTr(review.createdAt)}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="barber-home-empty-state">Henüz müşteri yorumu yok.</div>
                  )}
                </div>

                <div className="barber-home-panel">
                  <div className="barber-home-panel-head">
                    <div>
                      <h4 className="barber-home-panel-title">Ustalar</h4>
                      <p className="barber-home-panel-subtitle">Usta ekleme, düzenleme, silme ve yetki ayarları artık sol menüdeki Ustalar alanında.</p>
                    </div>
                    <span className="barber-home-panel-badge success">{salonMasters.length} usta</span>
                  </div>
                  <div className="barber-home-master-list">
                    {homeVisibleMasters.length > 0 ? homeVisibleMasters.map((master, index) => (
                      <div key={`${master.name || 'master'}-${index}`} className="barber-home-master-item">
                        <div>
                          <strong>{master.name || 'İsimsiz Usta'}</strong>
                          <p>@{String(master.username || '').trim() || 'kullanici-adi-yok'}</p>
                        </div>
                        <span className={`badge ${master.isActive === false ? 'bg-secondary' : 'bg-success'}`}>
                          {master.isActive === false ? 'Pasif' : 'Aktif'}
                        </span>
                      </div>
                    )) : <div className="barber-home-empty-state">Henüz usta eklenmedi.</div>}
                  </div>

                  {canAccessSection('masters') && (
                    <div className="d-grid mt-3">
                      <button type="button" className="btn btn-outline-primary" onClick={() => setActiveSection('masters')}>
                        Usta Yönetimine Git
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {activeSection === 'store' && (
            <div className="barber-home-dashboard">
              <div className="barber-home-hero" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #334155 100%)' }}>
                <div className="barber-home-hero-copy">
                  <div className="barber-home-kicker text-white-50">Berber Store</div>
                  <h1 className="page-title barber-home-title text-white">Hazırlanıyor</h1>
                  <p className="page-subtitle barber-home-subtitle text-white-50">
                    Berberlerin profesyonel ürünleri toptan ve en uygun fiyatlarla sipariş verebileceği yeni market çok yakında burada olacak.
                  </p>
                </div>
                <div className="barber-home-hero-stat">
                  <div className="barber-home-hero-stat-label text-white-50">Yakında</div>
                  <div className="barber-home-hero-stat-value text-white">Toptan market</div>
                  <div className="barber-home-hero-stat-subtitle text-white-50">Salonlar için özel ürün tedarik merkezi</div>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-lg-7">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4 p-lg-5">
                      <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '54px', height: '54px', background: '#e8f3ff', fontSize: '1.4rem' }}>🛒</div>
                        <div>
                          <h2 className="h4 mb-1">Berber Store çok yakında açılıyor</h2>
                          <div className="text-muted">Salonunuzun ihtiyaç duyduğu ürünler tek merkezde toplanacak.</div>
                        </div>
                      </div>

                      <p className="mb-3">
                        Berberler bu market üzerinden ürünlerini <strong>toptan</strong> ve <strong>en uygun fiyatlarla</strong> sipariş verebilecek.
                        Siparişler <strong>kargo</strong> veya <strong>özel araçlarla</strong> teslim edilecek, ayrıca <strong>haftalık sevkiyat</strong> planı uygulanacak.
                        Ödemelerde <strong>kredi kartı</strong> ve <strong>kapıda ödeme</strong> seçenekleri sunulacak.
                      </p>

                      <div className="d-grid gap-2">
                        <div className="d-flex align-items-start gap-3 p-3 rounded-3 bg-light">
                          <span className="fs-4">📦</span>
                          <div>
                            <div className="fw-semibold">Toptan alım avantajı</div>
                            <div className="text-muted small">Ürünler salonların ihtiyacına göre toplu sipariş mantığıyla sunulacak.</div>
                          </div>
                        </div>
                        <div className="d-flex align-items-start gap-3 p-3 rounded-3 bg-light">
                          <span className="fs-4">🚚</span>
                          <div>
                            <div className="fw-semibold">Kargo veya özel araç teslimatı</div>
                            <div className="text-muted small">Siparişler bölgeye göre hızlı ve güvenli teslimat seçenekleriyle ulaştırılacak.</div>
                          </div>
                        </div>
                        <div className="d-flex align-items-start gap-3 p-3 rounded-3 bg-light">
                          <span className="fs-4">💳</span>
                          <div>
                            <div className="fw-semibold">Esnek ödeme seçenekleri</div>
                            <div className="text-muted small">Kredi kartı ya da kapıda ödeme ile alışveriş yapılabilecek.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-5">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4 p-lg-5">
                      <h3 className="h5 mb-3">Planlanan sistem</h3>
                      <div className="d-grid gap-3">
                        <div className="p-3 rounded-3 border">
                          <div className="fw-semibold mb-1">Haftalık sevkiyat</div>
                          <div className="text-muted small">Tedarik planı düzenli sevkiyatlarla işletmelere ulaşacak.</div>
                        </div>
                        <div className="p-3 rounded-3 border">
                          <div className="fw-semibold mb-1">Ürün çeşitliliği</div>
                          <div className="text-muted small">Bakım, sarf ve profesyonel salon ürünleri tek çatı altında toplanacak.</div>
                        </div>
                        <div className="p-3 rounded-3 border">
                          <div className="fw-semibold mb-1">Sipariş takibi</div>
                          <div className="text-muted small">Hazırlanıyor, yolda ve teslim edildi adımları sonradan eklenebilir.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'gallery' && (
            <div className="barber-home-dashboard">
              <div className="barber-home-hero">
                <div className="barber-home-hero-copy">
                  <div className="barber-home-kicker">Galeri</div>
                  <h1 className="page-title barber-home-title">Salon vitrini</h1>
                  <p className="page-subtitle barber-home-subtitle">
                    Çalışmalarınızın, salon ortamınızın ve öncesi-sonrası görsellerinin paylaşılacağı alan burada yer alacak.
                  </p>
                </div>
                <div className="barber-home-hero-stat">
                  <div className="barber-home-hero-stat-label">Yakında</div>
                  <div className="barber-home-hero-stat-value">Görsel vitrin</div>
                  <div className="barber-home-hero-stat-subtitle">Salonunuzu daha güçlü anlatın</div>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4 text-center">
                      <div className="display-6 mb-2">📸</div>
                      <div className="fw-semibold mb-1">Çalışma Kareleri</div>
                      <div className="text-muted small">Öne çıkan saç ve sakal çalışmaları.</div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4 text-center">
                      <div className="display-6 mb-2">✨</div>
                      <div className="fw-semibold mb-1">Salon Atmosferi</div>
                      <div className="text-muted small">Müşterinin mekana güven duymasını sağlar.</div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4 text-center">
                      <div className="display-6 mb-2">🪞</div>
                      <div className="fw-semibold mb-1">Önce / Sonra</div>
                      <div className="text-muted small">Dönüşümü en net şekilde gösterir.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="alert alert-info mt-3 mb-0">
                Galeri bölümü hazırlanıyor. Görsel yükleme ve düzenleme alanları daha sonra buraya eklenecek.
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

          {/* Masters Section */}
          {activeSection === 'masters' && (
            <div>
              <h1 className="page-title">Ustalar</h1>
              <p className="page-subtitle">Usta hesaplarını, şifrelerini ve panel yetkilerini yönetin</p>

              <div className="barber-home-panel mb-4">
                <div className="barber-home-panel-head">
                  <div>
                    <h4 className="barber-home-panel-title">Yeni Usta Ekle</h4>
                    <p className="barber-home-panel-subtitle">Usta hesabı için kullanıcı adı ve şifre belirleyin.</p>
                  </div>
                </div>
                <form className="barber-home-master-advanced-form" onSubmit={handleAddMaster}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Usta adı"
                    value={masterDraft.name}
                    onChange={(e) => setMasterDraft((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={isSavingMaster}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Uzmanlık (opsiyonel)"
                    value={masterDraft.specialty}
                    onChange={(e) => setMasterDraft((prev) => ({ ...prev, specialty: e.target.value }))}
                    disabled={isSavingMaster}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Kullanıcı adı"
                    value={masterDraft.username}
                    onChange={(e) => setMasterDraft((prev) => ({ ...prev, username: e.target.value }))}
                    disabled={isSavingMaster}
                  />
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Şifre (min 6)"
                    value={masterDraft.password}
                    onChange={(e) => setMasterDraft((prev) => ({ ...prev, password: e.target.value }))}
                    disabled={isSavingMaster}
                  />

                  <div className="barber-home-master-permissions">
                    {MASTER_PERMISSION_META.map((permission) => (
                      <label key={`new-master-perm-${permission.key}`} className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={Boolean(masterDraft.permissions?.[permission.key])}
                          onChange={(e) => setMasterDraft((prev) => ({
                            ...prev,
                            permissions: {
                              ...(prev.permissions || defaultMasterPermissions()),
                              [permission.key]: e.target.checked,
                            },
                          }))}
                          disabled={isSavingMaster}
                        />
                        <span className="form-check-label">{permission.label}</span>
                      </label>
                    ))}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={isSavingMaster}>
                    {isSavingMaster ? 'Ekleniyor...' : 'Usta Ekle'}
                  </button>
                </form>
              </div>

              <div className="barber-home-panel">
                <div className="barber-home-panel-head">
                  <div>
                    <h4 className="barber-home-panel-title">Kayıtlı Ustalar</h4>
                    <p className="barber-home-panel-subtitle">Düzenle, şifre yenile veya sil.</p>
                  </div>
                  <span className="barber-home-panel-badge success">{salonMasters.length} usta</span>
                </div>

                {salonMasters.length > 0 ? (
                  <div className="barber-home-master-list">
                    {salonMasters.map((master, index) => {
                      if (editingHomeMasterIndex === index) {
                        return (
                          <div key={`${master._id || master.name || 'master'}-${index}`} className="barber-home-master-item barber-home-master-item-advanced">
                            <div className="barber-home-master-inline-editor barber-home-master-inline-editor-advanced">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Usta adı"
                                value={editingHomeMasterDraft.name}
                                onChange={(e) => setEditingHomeMasterDraft((prev) => ({ ...prev, name: e.target.value }))}
                                disabled={isSavingMaster}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Uzmanlık"
                                value={editingHomeMasterDraft.specialty}
                                onChange={(e) => setEditingHomeMasterDraft((prev) => ({ ...prev, specialty: e.target.value }))}
                                disabled={isSavingMaster}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Kullanıcı adı"
                                value={editingHomeMasterDraft.username}
                                onChange={(e) => setEditingHomeMasterDraft((prev) => ({ ...prev, username: e.target.value }))}
                                disabled={isSavingMaster}
                              />
                              <input
                                type="password"
                                className="form-control form-control-sm"
                                placeholder="Yeni şifre (opsiyonel)"
                                value={editingHomeMasterDraft.password}
                                onChange={(e) => setEditingHomeMasterDraft((prev) => ({ ...prev, password: e.target.value }))}
                                disabled={isSavingMaster}
                              />
                              <label className="form-check form-switch m-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={editingHomeMasterDraft.isActive !== false}
                                  onChange={(e) => setEditingHomeMasterDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                                  disabled={isSavingMaster}
                                />
                                <span className="form-check-label">Aktif</span>
                              </label>
                              <div className="barber-home-master-permissions">
                                {MASTER_PERMISSION_META.map((permission) => (
                                  <label key={`edit-master-perm-${permission.key}-${index}`} className="form-check form-switch">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={Boolean(editingHomeMasterDraft.permissions?.[permission.key])}
                                      onChange={(e) => setEditingHomeMasterDraft((prev) => ({
                                        ...prev,
                                        permissions: {
                                          ...(prev.permissions || defaultMasterPermissions()),
                                          [permission.key]: e.target.checked,
                                        },
                                      }))}
                                      disabled={isSavingMaster}
                                    />
                                    <span className="form-check-label">{permission.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="barber-home-master-actions">
                              <button type="button" className="btn btn-success btn-sm" onClick={() => handleUpdateHomeMaster(index)} disabled={isSavingMaster}>Kaydet</button>
                              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelEditHomeMaster} disabled={isSavingMaster}>Vazgeç</button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={`${master._id || master.name || 'master'}-${index}`} className="barber-home-master-item">
                          <div>
                            <strong>{master.name || 'İsimsiz Usta'}</strong>
                            <p>@{String(master.username || '').trim() || '-'}</p>
                            <p>{String(master.specialty || '').trim() || 'Uzmanlık belirtilmedi'}</p>
                          </div>
                          <div className="barber-home-master-actions">
                            <span className={`badge ${master.isActive === false ? 'bg-secondary' : 'bg-success'}`}>
                              {master.isActive === false ? 'Pasif' : 'Aktif'}
                            </span>
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => startEditHomeMaster(master, index)} disabled={isSavingMaster}>Düzenle</button>
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteHomeMaster(index)} disabled={isSavingMaster}>Sil</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="barber-home-empty-state">Henüz usta eklenmedi.</div>
                )}
              </div>
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

              {recentlyDeletedSlot && (
                <div className="barber-calendar-inline-undo" role="status" aria-live="polite">
                  <div className="barber-calendar-inline-undo-copy">
                    <strong>🗑️ Randevu müşteri görünümünden kaldırıldı</strong>
                    <span>
                      {recentlyDeletedSlot.customerName} • {formatDateDayMonthYear(recentlyDeletedSlot.date)} • {recentlyDeletedSlot.time || '--:--'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="barber-calendar-inline-undo-btn"
                    onClick={handleUndoDeleteSlot}
                    title="Silme işlemini geri al"
                    aria-label="Silme işlemini geri al"
                    disabled={pendingSlotActionId === recentlyDeletedSlot._id}
                  >
                    ↩️
                  </button>
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

              {calendarSlotsForView.length > 0 ? (
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
                    {calendarSlotsForView.map(s => {
                      const statusLc = String(s.status || '').toLowerCase();
                      const isRecentlyDeletedSlot = String(recentlyDeletedSlotId || '') === String(s._id || '');
                      const isVirtualSlot = Boolean(s.isVirtualSlot);
                      const hasAppointment = Boolean(s.customerName || s.customer?.name);
                      const assignedMasterName = String(s.assignedMaster?.name || '').trim();
                      const canAssignMaster = false;
                      const showPastOnly = s.isPastSlot && statusLc === 'available' && !hasAppointment;
                      const hideActions = s.isPastSlot && !s.isHistoricalRecord;
                      const canEditManual = Boolean(s.isManualAppointment);
                      const canDeleteManual = Boolean(s.isManualAppointment);
                      const hasEditableAppointment = Boolean(hasAppointment) && ['booked', 'confirmed', 'reschedule_pending_customer', 'reschedule_pending_barber'].includes(statusLc);
                      const canEditAppointment = canEditManual || (!s.isPastSlot && hasEditableAppointment);
                      const canDeleteAppointment = canDeleteManual || hasEditableAppointment;
                      const canManageAvailability = !isVirtualSlot && !s.isPastSlot && ['available', 'blocked'].includes(statusLc);
                      const canCreateManual = !s.isPastSlot && statusLc === 'available';

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
                            {s.isHistoricalRecord && (
                              <span className="badge bg-warning text-dark">Geçmiş Kayıt</span>
                            )}
                            {isRecentlyDeletedSlot && (
                              <span className="badge bg-warning text-dark">↩️ Geri Alınabilir</span>
                            )}
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
                          {assignedMasterName && (
                            <div className="barber-slot-service">
                              👤 Usta: {assignedMasterName}
                            </div>
                          )}
                        </div>
                        {!hideActions && <div className="barber-slot-actions">
                          {isRecentlyDeletedSlot && (
                            <button
                              title="Silme işlemini geri al"
                              className="barber-slot-action-btn"
                              onClick={handleUndoDeleteSlot}
                              disabled={pendingSlotActionId === recentlyDeletedSlot?._id}
                            >
                              ↩️
                            </button>
                          )}
                          {canEditAppointment && (
                            <button title="Düzenle" className="barber-slot-action-btn" onClick={() => {
                              setSelectedSlotForEdit(s);
                              setShowEditSlot(true);
                            }}>
                              ✏️
                            </button>
                          )}
                          {canCreateManual && (
                            <button title="Randevu Ekle" className="barber-slot-action-btn" onClick={() => {
                              if (isVirtualSlot) {
                                setSelectedSlotForManual({ date: s.date, time: s.time });
                              } else {
                                setSelectedSlotForManual(s);
                              }
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
                          {canDeleteAppointment && <button title="Sil" className="barber-slot-action-btn barber-slot-action-delete" onClick={() => {
                            if (canDeleteManual) {
                              setConfirmAction({
                                kind: 'delete-slot',
                                slot: s,
                                title: 'Randevu Silinsin mi?',
                                message: 'Bu randevu müşteri tarafında silinmiş gibi görünecek ve takvimden kaldırılacak. Onaylıyor musunuz?',
                                confirmText: 'Sil',
                                variant: 'danger',
                              });
                              return;
                            }

                            setConfirmAction({
                              kind: 'cancel-slot',
                              slot: s,
                              title: 'Randevu İptal Edilsin mi?',
                              message: 'Bu onaylı randevu iptal edilerek takvimden düşürülecek. Onaylıyor musunuz?',
                              confirmText: 'İptal Et',
                              variant: 'danger',
                              showReason: true,
                              reasonValue: 'İşletme tarafından iptal edildi',
                            });
                          }}>
                            🗑️
                          </button>}
                          {canAssignMaster && (
                            <div className="d-flex align-items-center gap-2 ms-2">
                              <select
                                className="form-select form-select-sm"
                                style={{ minWidth: '170px' }}
                                value={slotMasterDrafts[s._id] ?? String(s.assignedMaster?.masterId || '')}
                                onChange={(e) => setSlotMasterDrafts((prev) => ({ ...prev, [s._id]: e.target.value }))}
                                disabled={pendingSlotActionId === s._id}
                              >
                                <option value="">Usta atanmamış</option>
                                {salonMasters
                                  .filter((master) => master.isActive !== false)
                                  .map((master) => (
                                    <option key={master._id || master.username || master.name} value={master._id || ''}>
                                      {master.name} @{master.username || '-'}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleAssignMasterToSlot(s, slotMasterDrafts[s._id] ?? String(s.assignedMaster?.masterId || ''))}
                                disabled={pendingSlotActionId === s._id}
                              >
                                Ata
                              </button>
                            </div>
                          )}
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
              <p className="page-subtitle">Canlı randevu ve gelir verileriyle işletme performansı</p>

              <div className="stat-grid">
                <div className="stat-card" style={{ borderColor: '#3498db' }}>
                  <div className="stat-card-label">📅 Toplam Takvim Kaydı</div>
                  <div className="stat-card-value">{dashboardAppointmentStats.total}</div>
                </div>
                <div className="stat-card" style={{ borderColor: '#27ae60' }}>
                  <div className="stat-card-label">💰 Bu Ay Gelir</div>
                  <div className="stat-card-value">₺{dashboardRevenueEstimate.toLocaleString('tr-TR')}</div>
                </div>
                <div className="stat-card" style={{ borderColor: '#f39c12' }}>
                  <div className="stat-card-label">✅ Karar Başarı Oranı</div>
                  <div className="stat-card-value">%{actionableDecisionRate}</div>
                </div>
                <div className="stat-card" style={{ borderColor: '#8e44ad' }}>
                  <div className="stat-card-label">🧾 Bu Ay Onaylı/Tamamlanan</div>
                  <div className="stat-card-value">{currentMonthSummarySlots.length}</div>
                </div>
              </div>

              <div className="info-card">
                <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                  <div>
                    <h4 className="mb-1">Aylık Gelir Trendi</h4>
                    <p className="text-muted mb-0">Onaylı ve tamamlanan randevuların aylık toplamı.</p>
                  </div>
                  <span className="badge bg-primary">{currentYear}</span>
                </div>

                {monthlyRevenueTrend.currentMonth ? (
                  <div className="mt-3">
                    <div className="d-flex flex-wrap gap-3 align-items-center mb-2">
                      <strong>{monthlyRevenueTrend.currentMonth.label}</strong>
                      <span>₺{(monthlyRevenueTrend.currentMonth.amount || 0).toLocaleString('tr-TR')}</span>
                      <span>{monthlyRevenueTrend.currentMonth.count} randevu</span>
                    </div>
                    <p className="text-muted mb-0">
                      Geçen ay: ₺{(monthlyRevenueTrend.previousMonth?.amount || 0).toLocaleString('tr-TR')}
                      {' '}•{' '}
                      <strong style={{ color: monthlyRevenueTrend.isIncrease ? '#1f8f4c' : '#c0392b' }}>
                        {monthlyRevenueTrend.isIncrease ? 'Artış' : 'Düşüş'}: ₺{Math.abs(monthlyRevenueTrend.diff).toLocaleString('tr-TR')}
                        {monthlyRevenueTrend.percentChange !== null ? ` (%${Math.abs(monthlyRevenueTrend.percentChange)})` : ''}
                      </strong>
                    </p>
                  </div>
                ) : (
                  <p className="text-muted mb-0 mt-3">Trend verisi oluşturulamadı.</p>
                )}
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-xl-8">
                  <div className="info-card h-100">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                      <div>
                        <h4 className="mb-1">Aylık Gelir Grafiği</h4>
                        <p className="text-muted mb-0">Son 6 ayın onaylı/tamamlanan gelir dağılımı.</p>
                      </div>
                      <span className="badge bg-success">₺{dashboardRevenueEstimate.toLocaleString('tr-TR')}</span>
                    </div>

                    <div className="d-flex align-items-end gap-2 mt-4" style={{ minHeight: '220px' }}>
                      {revenueChartMonths.map((month) => {
                        const barHeight = Math.max(12, Math.round((Number(month.amount || 0) / revenueChartMax) * 180));
                        return (
                          <div key={month.key} className="flex-fill text-center">
                            <div className="d-flex align-items-end justify-content-center" style={{ minHeight: '190px' }}>
                              <div
                                className={`rounded-top ${month.isCurrentMonth ? 'shadow-sm' : ''}`}
                                style={{
                                  width: '100%',
                                  maxWidth: '64px',
                                  height: `${barHeight}px`,
                                  background: month.isCurrentMonth
                                    ? 'linear-gradient(180deg, #2ecc71 0%, #1f8f4c 100%)'
                                    : 'linear-gradient(180deg, #5dade2 0%, #3498db 100%)',
                                  transition: 'height 180ms ease',
                                }}
                                title={`${month.label}: ₺${Number(month.amount || 0).toLocaleString('tr-TR')}`}
                              />
                            </div>
                            <div className="mt-2 fw-semibold">{month.label}</div>
                            <small className="text-muted d-block">₺{Number(month.amount || 0).toLocaleString('tr-TR')}</small>
                            <small className="text-muted d-block">{month.count} işlem</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-xl-4">
                  <div className="info-card h-100">
                    <h4>En Güçlü Hizmetler</h4>
                    {topServices.length > 0 ? (
                      <div className="d-flex flex-column gap-3 mt-3">
                        {topServices.map((service, index) => {
                          const serviceMax = Math.max(...topServices.map((item) => item.revenue), 1);
                          const widthPercent = Math.max(12, Math.round((service.revenue / serviceMax) * 100));

                          return (
                            <div key={service.name}>
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <small className="text-muted">{index + 1}. {service.name}</small>
                                <strong>{service.count}</strong>
                              </div>
                              <div className="progress" style={{ height: '10px' }}>
                                <div
                                  className="progress-bar"
                                  style={{ width: `${widthPercent}%`, backgroundColor: '#8e44ad' }}
                                />
                              </div>
                              <small className="text-muted d-block mt-1">₺{service.revenue.toLocaleString('tr-TR')}</small>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted mb-0 mt-3">Henüz onaylı/tamamlanmış hizmet verisi yok.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-xl-6">
                  <div className="info-card h-100">
                    <h4>Durum Dağılımı</h4>
                    <div className="d-flex flex-column gap-3 mt-3">
                      {statsStatusItems.map((item) => (
                        <div key={item.key}>
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <small className="text-muted">{item.label}</small>
                            <strong>{item.value}</strong>
                          </div>
                          <div className="progress" style={{ height: '8px' }}>
                            <div className="progress-bar" style={{ width: `${item.percent}%`, backgroundColor: '#3498db' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-xl-6">
                  <div className="info-card h-100">
                    <h4>En Çok Satılan Hizmetler</h4>
                    {topServices.length > 0 ? (
                      <div className="d-flex flex-column gap-2 mt-3">
                        {topServices.map((service, index) => (
                          <div key={service.name} className="d-flex justify-content-between align-items-center">
                            <span>{index + 1}. {service.name}</span>
                            <span className="text-muted">{service.count} randevu • ₺{service.revenue.toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0 mt-3">Henüz onaylı/tamamlanmış hizmet verisi yok.</p>
                    )}
                  </div>
                </div>
              </div>

              {!isMasterUser && (
                <div className="info-card mt-3">
                  <h4>Usta Bazlı Performans</h4>
                  {masterPerformanceStats.length > 0 ? (
                    <div className="d-flex flex-column gap-2 mt-3">
                      {masterPerformanceStats.map((master, index) => (
                        <div key={master.id} className="d-flex justify-content-between align-items-center">
                          <span>{index + 1}. {master.name}</span>
                          <span className="text-muted">{master.count} randevu • ₺{master.revenue.toLocaleString('tr-TR')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mb-0 mt-3">Atanmış usta verisi bulunan onaylı/tamamlanmış randevu henüz yok.</p>
                  )}
                </div>
              )}

              {isMasterUser && (
                <div className="info-card mt-3">
                  <h4>Usta Görünümü</h4>
                  <p className="text-muted mb-0">Bu ekran yalnızca size atanan randevulara göre hesaplanır.</p>
                </div>
              )}
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

      {summaryModalData && (
        <div className="modal d-block barber-home-summary-modal" tabIndex="-1" role="dialog" aria-modal="true" onClick={closeSummaryModal}>
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content border-0 rounded-4 shadow-lg">
              <div className="modal-header bg-white border-bottom py-3">
                <div>
                  <h5 className="modal-title fw-bold mb-0" style={{ color: '#2c3e50' }}>{summaryModalData.title}</h5>
                  <small className="text-muted">{summaryModalData.subtitle}</small>
                </div>
                <button type="button" className="btn-close" aria-label="Kapat" onClick={closeSummaryModal} />
              </div>
              <div className="modal-body p-4">
                {summaryModalData.items.length > 0 ? (
                  <div className="barber-home-summary-list">
                    {summaryModalData.items.map((slot) => {
                      const customer = splitCustomerFullName(slot);
                      const serviceName = getSlotServiceName(slot);
                      const statusLabel = getSlotStatusLabel(slot.status);
                      const statusTone = getSlotStatusTone(slot.status);
                      const summaryMasterName = String(slot?.assignedMaster?.name || '').trim();
                      const showSummaryMaster = ['today-approved', 'current-month', 'rejected'].includes(String(summaryModal?.type || ''));
                      return (
                        <div key={slot._id} className="barber-home-summary-item">
                          <div className="barber-home-summary-item-main">
                            <div className="barber-home-summary-name">
                              <strong>{customer.firstName}</strong>
                              <span>{customer.lastName}</span>
                              {showSummaryMaster && summaryMasterName && (
                                <span className="barber-home-summary-master">🧑‍🔧 {summaryMasterName}</span>
                              )}
                            </div>
                            <div className="barber-home-summary-meta">
                              <span>{formatDateDayMonthYear(slot.date)} • {slot.time || '--:--'}</span>
                              <span>{serviceName}</span>
                            </div>
                          </div>
                          <div className="barber-home-summary-side">
                            <span className={`badge bg-${statusTone}`}>{statusLabel}</span>
                            <strong>₺{toSlotRevenueAmount(slot).toLocaleString('tr-TR')}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="barber-home-empty-state">Gösterilecek kayıt yok.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {completionNoticeModal.show && (
        <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={() => setCompletionNoticeModal({ show: false, text: '' })}>
          <div className="modal-dialog modal-dialog-centered" role="document" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">Randevu Tamamlandı</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Kapat"
                  onClick={() => setCompletionNoticeModal({ show: false, text: '' })}
                />
              </div>
              <div className="modal-body">
                <p className="mb-0">{completionNoticeModal.text || 'Randevu tamamlandı.'}</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCompletionNoticeModal({ show: false, text: '' })}
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
