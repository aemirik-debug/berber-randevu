import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { connectSocket } from '../services/socket';
import BookingPage from './BookingPage';
import './CustomerHomeTheme.css';

function CustomerHome() {
  const [activeSection, setActiveSection] = useState('home');
  const [sectionHistory, setSectionHistory] = useState([]);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileDistrict, setProfileDistrict] = useState('');
  const [profileDistricts, setProfileDistricts] = useState([]);
  const [phone, setPhone] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [cities, setCities] = useState([]);
  const [filterDistricts, setFilterDistricts] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [suggestedBarbers, setSuggestedBarbers] = useState([]);
  const [loadingSuggestedBarbers, setLoadingSuggestedBarbers] = useState(false);
  const [suggestionDistrictLabel, setSuggestionDistrictLabel] = useState('');
  const [openReviewBarberId, setOpenReviewBarberId] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [submittingReviewBarberId, setSubmittingReviewBarberId] = useState('');
  const [sendingReminderAppointmentId, setSendingReminderAppointmentId] = useState('');
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState('');
  const [editingAppointmentId, setEditingAppointmentId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSlots, setEditSlots] = useState([]);
  const [selectedEditSlotId, setSelectedEditSlotId] = useState('');
  const [loadingEditSlots, setLoadingEditSlots] = useState(false);
  const [savingEditAppointmentId, setSavingEditAppointmentId] = useState('');
  const [activeBarberSlideIndex, setActiveBarberSlideIndex] = useState(0);
  const [activePastSlideIndex, setActivePastSlideIndex] = useState(0);
  const headerMenuRef = useRef(null);
  const barberScrollRef = useRef(null);
  const barberCardRefs = useRef([]);
  const pastScrollRef = useRef(null);
  const pastCardRefs = useRef([]);
  const navigate = useNavigate();

  const navigationItems = [
    { key: 'home', label: 'Ana Sayfa', icon: '🏠' },
    { key: 'appointments', label: 'Randevular', icon: '📅', count: appointments.length, tone: 'primary' },
    { key: 'invoices', label: 'Faturalar', icon: '🧾', count: invoices.length, tone: 'warning' },
    { key: 'favorites', label: 'Favoriler', icon: '❤', count: favorites.length, tone: 'danger' },
  ];

  const customerInitials = `${(name?.[0] || 'B')}${(surname?.[0] || 'R')}`.toUpperCase();

  const footerYearText = (() => {
    const baseYear = 2026;
    const currentYear = new Date().getFullYear();
    return currentYear > baseYear ? `${baseYear}-${currentYear}` : `${baseYear}`;
  })();

  const homeSummaryCards = [
    { label: 'Randevu', value: appointments.length, tone: 'primary' },
    { label: 'Favori', value: favorites.length, tone: 'danger' },
    { label: 'Fatura', value: invoices.length, tone: 'warning' },
  ];

  const footerContent = (
    <footer className="customer-footer px-3 px-lg-4 py-3 border-top mt-auto text-center">
      <small className="text-muted">© {footerYearText} Berber Randevu. Tüm hakları saklıdır.</small>
    </footer>
  );

  const goToSection = (nextSection, closeMobileMenu = true) => {
    setActiveSection((current) => {
      if (current !== nextSection) {
        setSectionHistory((history) => [...history, current].slice(-10));
      }
      return nextSection;
    });

    if (closeMobileMenu) {
      setShowMobileMenu(false);
    }
  };

  const goBackSection = () => {
    setSectionHistory((history) => {
      if (history.length === 0) {
        return history;
      }

      const previousSection = history[history.length - 1];
      setActiveSection(previousSection);
      return history.slice(0, -1);
    });
  };

  const renderNavButton = (item, isMobile = false) => (
    <button
      key={item.key}
      type="button"
      className={`list-group-item list-group-item-action customer-nav-item ${activeSection === item.key ? 'active' : ''} ${isMobile ? 'customer-nav-item-mobile' : ''}`}
      onClick={() => {
        goToSection(item.key);
      }}
    >
      <span className="customer-nav-icon" aria-hidden="true">{item.icon}</span>
      <span className="flex-grow-1 text-start">{item.label}</span>
      {typeof item.count === 'number' && (
        <span className={`badge rounded-pill text-bg-${item.tone || 'secondary'} customer-nav-badge`}>
          {item.count}
        </span>
      )}
    </button>
  );

  const getAuthHeaders = () => {
    const token = localStorage.getItem('customerToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getCustomerInfo = () => {
    const raw = localStorage.getItem('customerInfo');
    return raw ? JSON.parse(raw) : null;
  };

  const customerInfoSnapshot = getCustomerInfo();
  const currentCustomerId = customerInfoSnapshot?._id ? String(customerInfoSnapshot._id) : '';

  const inferCityFromAddress = (cityList) => {
    const address = String(customerInfoSnapshot?.address || '').toLowerCase();
    if (!address || !Array.isArray(cityList)) {
      return '';
    }

    return cityList.find((cityItem) => address.includes(String(cityItem).toLowerCase())) || '';
  };

  const canSendBarberReminder = (appointment) => {
    if (!appointment) {
      return false;
    }

    const statusLc = String(appointment.status || '').toLowerCase();
    if (!['pending', 'booked', 'randevu alındı'].includes(statusLc)) {
      return false;
    }

    if (appointment.reminderSentAt) {
      return false;
    }

    const createdAt = appointment.createdAt ? new Date(appointment.createdAt).getTime() : 0;
    if (!createdAt) {
      return false;
    }

    return createdAt <= Date.now() - 5 * 60 * 1000;
  };

  const isPendingLikeStatus = (status) => {
    const statusLc = String(status || '').toLowerCase();
    return statusLc === 'pending' || statusLc === 'booked' || statusLc === 'randevu alındı';
  };

  const getQuickStatusMeta = (status, appointment) => {
    const statusLc = String(status || '').toLowerCase();
    if (statusLc === 'confirmed') {
      return { tone: 'approved', icon: '✅', label: 'Onaylandı' };
    }
    if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
      const reasonLc = String(appointment?.cancelReason || '').toLowerCase();
      const label = reasonLc.includes('müşteri')
        ? 'İptal Ettin'
        : reasonLc.includes('berber')
          ? 'Berber İptal Etti'
          : 'İptal';
      return { tone: 'cancelled', icon: '⛔', label };
    }
    if (isPendingLikeStatus(statusLc)) {
      return { tone: 'pending', icon: '🕒', label: 'Onay Bekleniyor' };
    }
    return { tone: 'idle', icon: 'ℹ️', label: status || 'Bilgi' };
  };

  const canCancelAppointment = (appointment) => {
    if (!appointment) {
      return false;
    }

    const appointmentDate = appointment?.date
      ? new Date(`${appointment.date}T${appointment.time || '00:00'}`)
      : null;
    if (!(appointmentDate instanceof Date) || Number.isNaN(appointmentDate.getTime()) || appointmentDate.getTime() < Date.now()) {
      return false;
    }

    const statusLc = String(appointment.status || '').toLowerCase();
    return statusLc !== 'cancelled' && statusLc !== 'reddedildi';
  };

  const canEditAppointment = (appointment) => {
    if (!appointment?.slotId || !appointment?.barberId) {
      return false;
    }

    const appointmentDate = appointment?.date
      ? new Date(`${appointment.date}T${appointment.time || '00:00'}`)
      : null;
    if (!(appointmentDate instanceof Date) || Number.isNaN(appointmentDate.getTime()) || appointmentDate.getTime() < Date.now()) {
      return false;
    }

    return isPendingLikeStatus(appointment.status);
  };

  const loadRescheduleSlots = async (barberId, nextDate) => {
    if (!barberId || !nextDate) {
      setEditSlots([]);
      return [];
    }

    setLoadingEditSlots(true);
    try {
      const res = await axios.get('http://localhost:5001/api/slots/available', {
        params: { barberId, date: nextDate }
      });
      const slots = res.data?.data || [];
      setEditSlots(slots);
      return slots;
    } catch (err) {
      setEditSlots([]);
      setAlertMessage(err.response?.data?.error || 'Müsait saatler alınamadı.');
      setAlertType('danger');
      return [];
    } finally {
      setLoadingEditSlots(false);
    }
  };

  const findNearestSlotId = (referenceTime, slots) => {
    if (!Array.isArray(slots) || slots.length === 0) {
      return '';
    }

    const toMinutes = (value) => {
      const [hour, minute] = String(value || '').split(':').map((part) => Number(part));
      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return null;
      }
      return hour * 60 + minute;
    };

    const refMinutes = toMinutes(referenceTime);
    if (refMinutes === null) {
      return slots[0]?._id || '';
    }

    let nearest = slots[0];
    let nearestDiff = Number.POSITIVE_INFINITY;
    slots.forEach((slot) => {
      const slotMinutes = toMinutes(slot.time);
      if (slotMinutes === null) {
        return;
      }
      const diff = Math.abs(slotMinutes - refMinutes);
      if (diff < nearestDiff) {
        nearest = slot;
        nearestDiff = diff;
      }
    });

    return nearest?._id || '';
  };

  const handleStartEditAppointment = async (appointment) => {
    if (!canEditAppointment(appointment)) {
      return;
    }

    const defaultDate = appointment.date || new Date().toISOString().split('T')[0];
    setEditingAppointmentId(appointment._id);
    setEditDate(defaultDate);
    setSelectedEditSlotId('');
    const slots = await loadRescheduleSlots(appointment.barberId, defaultDate);
    setSelectedEditSlotId(findNearestSlotId(appointment.time, slots));
  };

  const handleCancelAppointment = async (appointment) => {
    if (!canCancelAppointment(appointment)) {
      return;
    }

    try {
      setCancellingAppointmentId(appointment._id);
      const res = await axios.patch(
        `http://localhost:5001/api/customers/appointments/${currentCustomerId}/${appointment._id}/cancel`,
        {},
        { headers: getAuthHeaders() }
      );

      const nextAppointment = res.data?.appointment;
      setAppointments((prev) => prev.map((item) => (
        item._id === appointment._id
          ? { ...item, ...nextAppointment }
          : item
      )));
      setAlertMessage('Randevu iptal edildi.');
      setAlertType('success');
    } catch (err) {
      setAlertMessage(err.response?.data?.message || 'Randevu iptal edilemedi.');
      setAlertType('danger');
    } finally {
      setCancellingAppointmentId('');
    }
  };

  const handleSubmitEditAppointment = async (appointment) => {
    if (!appointment || !selectedEditSlotId) {
      setAlertMessage('Lütfen yeni bir saat seçin.');
      setAlertType('danger');
      return;
    }

    try {
      setSavingEditAppointmentId(appointment._id);
      const res = await axios.patch(
        `http://localhost:5001/api/customers/appointments/${currentCustomerId}/${appointment._id}/reschedule`,
        { targetSlotId: selectedEditSlotId },
        { headers: getAuthHeaders() }
      );

      const nextAppointment = res.data?.appointment;
      setAppointments((prev) => prev.map((item) => (
        item._id === appointment._id
          ? { ...item, ...nextAppointment }
          : item
      )));
      setEditingAppointmentId('');
      setSelectedEditSlotId('');
      setEditSlots([]);
      setAlertMessage('Randevu güncellendi.');
      setAlertType('success');
    } catch (err) {
      setAlertMessage(err.response?.data?.message || 'Randevu güncellenemedi.');
      setAlertType('danger');
    } finally {
      setSavingEditAppointmentId('');
    }
  };

  const handleSendBarberReminder = async (appointment) => {
    if (!appointment?.slotId || !canSendBarberReminder(appointment)) {
      return;
    }

    try {
      setSendingReminderAppointmentId(appointment._id);
      await axios.post(
        `http://localhost:5001/api/slots/${appointment.slotId}/remind-barber`,
        {
          customerId: currentCustomerId,
          customerName: `${name || ''} ${surname || ''}`.trim()
        },
        { headers: getAuthHeaders() }
      );
      setAlertMessage('Berbere hatırlatma gönderildi.');
      setAlertType('success');
      setAppointments((prev) => prev.map((item) => (
        item._id === appointment._id
          ? { ...item, reminderSentAt: new Date().toISOString() }
          : item
      )));
    } catch (err) {
      setAlertMessage(err.response?.data?.error || 'Hatırlatma gönderilemedi.');
      setAlertType('danger');
    } finally {
      setSendingReminderAppointmentId('');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('customerToken');
    const customerInfo = getCustomerInfo();
    if (!token || !customerInfo?._id) {
      navigate('/customer/auth', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!headerMenuRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Müşteri bilgilerini localStorage'dan çek ve state'e ata
  useEffect(() => {
    const customerInfo = getCustomerInfo();
  if (customerInfo) {
    setName(customerInfo.name || '');
    setSurname(customerInfo.surname || '');
    setEmail(customerInfo.email || '');
    setAddress(customerInfo.address || '');
    setProfileCity(customerInfo.city || '');
    setProfileDistrict(customerInfo.district || '');
    setPhone(customerInfo.phone || '');
  }
}, []);
// Alert mesajını 3 saniye sonra temizle
useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => {
        setAlertMessage('');
        setAlertType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

// Randevuları çek
useEffect(() => {
  const customerInfo = getCustomerInfo();
  if (!customerInfo?._id) {
    setLoadingAppointments(false);
    return;
  }

  setLoadingAppointments(true);
  axios
    .get(`http://localhost:5001/api/customers/appointments/${customerInfo._id}`, { headers: getAuthHeaders() })
    .then(res => setAppointments(res.data))
    .catch(err => console.error("Randevular yüklenemedi:", err))
    .finally(() => setLoadingAppointments(false));

  // socket bağlan ve müşteri kimliğini bildir
  const sock = connectSocket();
  sock.emit('customer_login', customerInfo._id);

  const handleAppointmentUpdate = (data) => {
    // status güncellemesi alındı
    console.log('🔔 Socket appointment_update alındı:', data);
    setAppointments(prev => prev.map(a => {
      const sameSlot = String(a.slotId || '') && String(a.slotId || '') === String(data.slotId || '');
      const sameOldDateTime = a.date === data.oldDate && a.time === data.oldTime;
      const sameCurrentDateTime = a.date === data.date && a.time === data.time;

      if (sameSlot || sameOldDateTime || sameCurrentDateTime) {
        console.log(`   ✅ Güncellenio: ${a.date} ${a.time} - Status: ${a.status} → ${data.status}`);
        return {
          ...a,
          status: data.status || a.status,
          date: data.date || a.date,
          time: data.time || a.time,
        };
      }
      return a;
    }));
  };

  sock.on('appointment_update', handleAppointmentUpdate);

  // Cleanup: component unmount olduğunda listener'ı kaldır
  return () => {
    sock.off('appointment_update', handleAppointmentUpdate);
  };
}, []);

// Faturaları çek
useEffect(() => {
  const customerInfo = getCustomerInfo();
  if (customerInfo) {
    axios.get(`http://localhost:5001/api/customers/invoices/${customerInfo._id}`, { headers: getAuthHeaders() })
      .then(res => setInvoices(res.data))
      .catch(err => console.error(err));
  }
}, []);

useEffect(() => {
  let isCancelled = false;

  const loadCities = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/locations/cities');
      const cityList = Array.isArray(res.data) ? res.data : [];
      if (isCancelled) {
        return;
      }

      setCities(cityList);

      const rawPreference = localStorage.getItem('customerLocationPreference');
      let parsedPreference = null;
      try {
        parsedPreference = rawPreference ? JSON.parse(rawPreference) : null;
      } catch (e) {
        parsedPreference = null;
      }

      if (parsedPreference?.city && cityList.includes(parsedPreference.city)) {
        setSelectedCity(parsedPreference.city);
        setSelectedDistrict(parsedPreference.district || '');
        return;
      }

      if (customerInfoSnapshot?.city && cityList.includes(customerInfoSnapshot.city)) {
        setSelectedCity(customerInfoSnapshot.city);
        setSelectedDistrict(customerInfoSnapshot?.district || '');
        return;
      }

      const guessedCity = inferCityFromAddress(cityList);
      if (guessedCity) {
        setSelectedCity(guessedCity);
      }
    } catch (err) {
      console.error('Şehir listesi yüklenemedi:', err);
    }
  };

  loadCities();

  return () => {
    isCancelled = true;
  };
}, []);

useEffect(() => {
  let isCancelled = false;

  const loadDistricts = async () => {
    if (!selectedCity) {
      setFilterDistricts([]);
      setSelectedDistrict('');
      return;
    }

    try {
      const res = await axios.get(`http://localhost:5001/api/locations/districts/${selectedCity}`);
      if (isCancelled) {
        return;
      }

      const districtList = Array.isArray(res.data) ? res.data : [];
      setFilterDistricts(districtList);
      if (selectedDistrict && !districtList.includes(selectedDistrict)) {
        setSelectedDistrict('');
      }
    } catch (err) {
      if (!isCancelled) {
        setFilterDistricts([]);
      }
      console.error('İlçe listesi yüklenemedi:', err);
    }
  };

  loadDistricts();

  return () => {
    isCancelled = true;
  };
}, [selectedCity]);

useEffect(() => {
  let isCancelled = false;

  const loadProfileDistricts = async () => {
    if (!profileCity) {
      setProfileDistricts([]);
      setProfileDistrict('');
      return;
    }

    try {
      const res = await axios.get(`http://localhost:5001/api/locations/districts/${profileCity}`);
      if (isCancelled) {
        return;
      }

      const districtList = Array.isArray(res.data) ? res.data : [];
      setProfileDistricts(districtList);
      if (profileDistrict && !districtList.includes(profileDistrict)) {
        setProfileDistrict('');
      }
    } catch (err) {
      if (!isCancelled) {
        setProfileDistricts([]);
      }
      console.error('Profil ilçe listesi yüklenemedi:', err);
    }
  };

  loadProfileDistricts();

  return () => {
    isCancelled = true;
  };
}, [profileCity]);

useEffect(() => {
  if (!selectedCity && !selectedDistrict) {
    return;
  }

  localStorage.setItem('customerLocationPreference', JSON.stringify({
    city: selectedCity,
    district: selectedDistrict,
  }));
}, [selectedCity, selectedDistrict]);

useEffect(() => {
  let isCancelled = false;

  const loadSuggestedBarbers = async () => {
    setLoadingSuggestedBarbers(true);

    try {
      const hasLocationFilter = selectedCity && selectedDistrict;
      const res = hasLocationFilter
        ? await axios.get('http://localhost:5001/api/barbers/byDistrict', { params: { city: selectedCity, district: selectedDistrict } })
        : await axios.get('http://localhost:5001/api/barbers');

      if (!isCancelled) {
        const list = Array.isArray(res.data) ? res.data : [];
        setSuggestedBarbers(list.slice(0, 6));
        setSuggestionDistrictLabel(hasLocationFilter ? `${selectedCity} / ${selectedDistrict}` : '');
      }
    } catch (err) {
      if (!isCancelled) {
        setSuggestedBarbers([]);
        setSuggestionDistrictLabel('');
      }
      console.error('Berber önerileri yüklenemedi:', err);
    } finally {
      if (!isCancelled) {
        setLoadingSuggestedBarbers(false);
      }
    }
  };

  loadSuggestedBarbers();

  return () => {
    isCancelled = true;
  };
}, [selectedCity, selectedDistrict]);

// Favorileri çek
useEffect(() => {
  const customerInfo = getCustomerInfo();
  if (customerInfo) {
    axios.get(`http://localhost:5001/api/customers/favorites/${customerInfo._id}`, { headers: getAuthHeaders() })
      .then(res => setFavorites(res.data))
      .catch(err => console.error(err));
  }
}, []);
  // Profil güncelleme
  const handleUpdateProfile = async () => {
    try {
      const customerInfo = getCustomerInfo();
      const res = await axios.put(`http://localhost:5001/api/customers/update/${customerInfo._id}`, {
        name, surname, email, address, city: profileCity, district: profileDistrict
      }, { headers: getAuthHeaders() });
      setAlertMessage("Profil bilgileri güncellendi!");
      setAlertType("success");
      localStorage.setItem('customerInfo', JSON.stringify(res.data));
      setSelectedCity(res.data.city || '');
      setSelectedDistrict(res.data.district || '');
      localStorage.setItem('customerLocationPreference', JSON.stringify({
        city: res.data.city || '',
        district: res.data.district || '',
      }));
    } catch (err) {
      setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
      setAlertType("danger");
    }
  };
  // Çıkış yap
  const handleLogout = () => {
  localStorage.removeItem('customerInfo');
  localStorage.removeItem('customerToken');
  window.location.href = '/';
};
  // Şifre güncelleme
  const handleChangePassword = async () => {
  try {
    const customerInfo = getCustomerInfo();
    const res = await axios.put(`http://localhost:5001/api/customers/update-password/${customerInfo._id}`, {
      oldPassword, newPassword
    }, { headers: getAuthHeaders() });
    setAlertMessage(res.data.message || "Şifre başarıyla güncellendi!");
    setAlertType("success");
    setOldPassword('');
    setNewPassword('');
  } catch (err) {
    setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
    setAlertType("danger");
  }
};
// Favori silme
const handleRemoveFavorite = async (barberId) => {
  try {
    const customerInfo = getCustomerInfo();
    await axios.delete(`http://localhost:5001/api/customers/favorites/${customerInfo._id}/${barberId}`, { headers: getAuthHeaders() });
    setFavorites(favorites.filter(f => f.barberId !== barberId));
    setAlertMessage("Favori başarıyla silindi!");
    setAlertType("success");
  } catch (err) {
    setAlertMessage("Hata: " + (err.response?.data?.message || err.message));
    setAlertType("danger");
  }
};
  const pendingAppointments = useMemo(
    () => appointments.filter((a) => {
      const statusLc = String(a.status || '').toLowerCase();
      return statusLc === 'pending' || statusLc === 'booked' || statusLc === 'randevu alındı';
    }).length,
    [appointments]
  );

    const sortedAppointments = useMemo(
      () => [...appointments].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      }),
      [appointments]
    );

  const recentNotifications = useMemo(
    () => [...sortedAppointments].reverse().slice(0, 5),
    [sortedAppointments]
  );

  const parseAppointmentDateTime = (appointment) => {
    if (!appointment?.date) {
      return null;
    }

    const parsed = new Date(`${appointment.date}T${appointment.time || '00:00'}`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

  const getAppointmentCreatedTime = (appointment) => {
    if (appointment?.createdAt) {
      const created = new Date(appointment.createdAt).getTime();
      if (!Number.isNaN(created)) {
        return created;
      }
    }

    // Mongo ObjectId fallback for old records without createdAt.
    const rawId = String(appointment?._id || '');
    if (rawId.length >= 8) {
      const unixHex = rawId.slice(0, 8);
      const unixMs = parseInt(unixHex, 16) * 1000;
      if (!Number.isNaN(unixMs)) {
        return unixMs;
      }
    }

    const appointmentDate = parseAppointmentDateTime(appointment);
    return appointmentDate ? appointmentDate.getTime() : 0;
  };

  const activeAppointments = useMemo(
    () => sortedAppointments.filter((app) => {
      const appointmentDate = parseAppointmentDateTime(app);
      if (!appointmentDate) {
        return false;
      }

      const statusLc = String(app.status || '').toLowerCase();
      if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
        return false;
      }

      return appointmentDate.getTime() >= Date.now();
    }),
    [sortedAppointments]
  );

  const pendingActiveAppointments = useMemo(
    () => activeAppointments.filter((app) => {
      const statusLc = String(app.status || '').toLowerCase();
      return statusLc === 'pending' || statusLc === 'booked' || statusLc === 'randevu alındı';
    }),
    [activeAppointments]
  );

  const highlightedAppointment = useMemo(
    () => pendingActiveAppointments[0] || activeAppointments[0] || null,
    [pendingActiveAppointments, activeAppointments]
  );

  const quickNoteStatus = useMemo(() => {
    const listItems = activeAppointments.slice(0, 6).map((appointment) => {
      const statusMeta = getQuickStatusMeta(appointment.status, appointment);
      return {
        id: appointment._id,
        slotId: appointment.slotId,
        barberId: appointment.barberId,
        barberName: appointment.barberName || 'Berber',
        dateLabel: new Date(appointment.date).toLocaleDateString(),
        timeLabel: appointment.time || '--:--',
        statusTone: statusMeta.tone,
        statusIcon: statusMeta.icon,
        statusLabel: statusMeta.label,
        canRemind: canSendBarberReminder(appointment),
        reminderSentAt: appointment.reminderSentAt || null,
        canCancel: canCancelAppointment(appointment),
        canEdit: canEditAppointment(appointment),
      };
    });

    if (!highlightedAppointment) {
      return {
        text: 'Aktif randevun bulunmuyor. Yeni bir randevu oluşturabilirsin.',
        tone: 'idle',
        icon: 'ℹ️',
        label: 'Bilgi',
        items: listItems,
      };
    }

    const labelDate = new Date(highlightedAppointment.date).toLocaleDateString();
    const labelTime = highlightedAppointment.time || '--:--';
    const barberLabel = highlightedAppointment.barberName || 'Berber';
    const statusLc = String(highlightedAppointment.status || '').toLowerCase();
    const pendingCount = pendingActiveAppointments.length;

    if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
      return {
        text: `${barberLabel} için ${labelDate} ${labelTime} randevun iptal edildi.`,
        tone: 'cancelled',
        icon: '⛔',
        label: 'İptal',
        items: listItems,
      };
    }

    if (statusLc === 'confirmed') {
      return {
        text: `${barberLabel} ${labelDate} ${labelTime} randevunu onayladı.`,
        tone: 'approved',
        icon: '✅',
        label: 'Onaylandı',
        items: listItems,
      };
    }

    return {
      text: pendingCount > 1
        ? `${pendingCount} randevun alındı, berber onayı bekleniyor.`
        : `${barberLabel} için ${labelDate} ${labelTime} randevun alındı, berber onayı bekleniyor.`,
      tone: 'pending',
      icon: '🕒',
      label: pendingCount > 1 ? `${pendingCount} Onay Bekleniyor` : 'Onay Bekleniyor',
      items: listItems,
    };
  }, [highlightedAppointment, pendingActiveAppointments, activeAppointments]);

  const pastAppointments = useMemo(
    () => [...sortedAppointments]
      .filter((app) => {
        const statusLc = String(app.status || '').toLowerCase();
        if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
          return true;
        }

        const appointmentDate = parseAppointmentDateTime(app);
        return appointmentDate ? appointmentDate.getTime() < Date.now() : false;
      })
      .sort((a, b) => {
        return getAppointmentCreatedTime(b) - getAppointmentCreatedTime(a);
      })
      .slice(0, 6),
    [sortedAppointments]
  );

  useEffect(() => {
    const createObserver = (rootElement, items, setActiveIndex) => {
      if (!rootElement || !items.some(Boolean)) {
        return null;
      }

      return new IntersectionObserver(
        (entries) => {
          const visibleEntries = entries.filter((entry) => entry.isIntersecting);
          if (visibleEntries.length === 0) {
            return;
          }

          const mostVisible = visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          const nextIndex = Number(mostVisible.target.dataset.slideIndex || 0);
          if (!Number.isNaN(nextIndex)) {
            setActiveIndex(nextIndex);
          }
        },
        {
          root: rootElement,
          threshold: [0.6],
        }
      );
    };

    const barberObserver = createObserver(barberScrollRef.current, barberCardRefs.current, setActiveBarberSlideIndex);
    const pastObserver = createObserver(pastScrollRef.current, pastCardRefs.current, setActivePastSlideIndex);

    barberCardRefs.current.forEach((item) => item && barberObserver && barberObserver.observe(item));
    pastCardRefs.current.forEach((item) => item && pastObserver && pastObserver.observe(item));

    return () => {
      barberObserver?.disconnect();
      pastObserver?.disconnect();
    };
  }, [suggestedBarbers.length, pastAppointments.length]);

  const getSectionTitle = () => {
    if (activeSection === 'booking') return 'Randevu Oluştur';
    if (activeSection === 'appointments') return 'Randevularım';
    if (activeSection === 'invoices') return 'Faturalarım';
    if (activeSection === 'favorites') return 'Favori Berberlerim';
    if (activeSection === 'account') return 'Hesap Ayarları';
    return 'Ana Sayfa';
  };

  const getStatusLabel = (status, appointment) => {
    if (status === 'pending' || status === 'booked') return 'Onay Bekleyen';
    if (status === 'confirmed') return 'Onaylandı';
    if (status === 'cancelled') {
      const reasonLc = String(appointment?.cancelReason || '').toLowerCase();
      if (reasonLc.includes('müşteri')) return 'İptal Ettin';
      if (reasonLc.includes('berber')) return 'Berber İptal Etti';
      return 'İptal';
    }
    if (status === 'Randevu Alındı') return 'Randevu Alındı';
    return status;
  };

  const getStatusColor = (status) => {
    if (status === 'confirmed') return 'success';
    if (status === 'pending' || status === 'booked') return 'info';
    if (status === 'Randevu Alındı') return 'info';
    if (status === 'cancelled') return 'danger';
    return 'secondary';
  };

  const renderStars = (value) => {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  };

  const hadPastServiceWithBarber = (barber) => {
    const barberNameLc = (barber?.name || '').toLowerCase();
    const salonNameLc = (barber?.salonName || '').toLowerCase();
    const now = new Date();

    return appointments.some((app) => {
      const statusLc = (app?.status || '').toLowerCase();
      if (statusLc === 'cancelled' || statusLc === 'reddedildi') {
        return false;
      }

      const appDate = app?.date ? new Date(`${app.date}T${app.time || '00:00'}`) : null;
      const isPastAppointment = appDate instanceof Date && !Number.isNaN(appDate.getTime())
        ? appDate < now
        : true;
      if (!isPastAppointment) {
        return false;
      }

      const appBarberNameLc = (app?.barberName || '').toLowerCase();
      return (barberNameLc && appBarberNameLc.includes(barberNameLc))
        || (salonNameLc && appBarberNameLc.includes(salonNameLc));
    });
  };

  const getOwnReviewForBarber = (barber) => {
    if (!currentCustomerId) {
      return null;
    }

    const reviews = Array.isArray(barber?.reviews) ? barber.reviews : [];
    return reviews.find((item) => String(item.customerId) === currentCustomerId) || null;
  };

  const canDeleteOwnReview = (review) => {
    if (!review?.createdAt) {
      return false;
    }

    const createdAtMs = new Date(review.createdAt).getTime();
    if (Number.isNaN(createdAtMs)) {
      return false;
    }

    return Date.now() - createdAtMs <= 24 * 60 * 60 * 1000;
  };

  const handleReviewDraftChange = (barberId, field, value) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [barberId]: {
        rating: prev[barberId]?.rating || 5,
        comment: prev[barberId]?.comment || '',
        [field]: value,
      },
    }));
  };

  const handleSubmitReview = async (barberId) => {
    const draft = reviewDrafts[barberId] || { rating: 5, comment: '' };
    const rating = Number(draft.rating) || 0;
    if (rating < 1 || rating > 5) {
      setAlertMessage('Yorum puanı 1 ile 5 arasında olmalıdır.');
      setAlertType('warning');
      return;
    }

    setSubmittingReviewBarberId(barberId);
    try {
      const res = await axios.post(
        `http://localhost:5001/api/barbers/${barberId}/reviews`,
        {
          rating,
          comment: String(draft.comment || '').trim(),
        },
        { headers: getAuthHeaders() }
      );

      setSuggestedBarbers((prev) => prev.map((item) => {
        if (item._id !== barberId) {
          return item;
        }

        const existing = Array.isArray(item.reviews) ? item.reviews : [];
        const updatedReview = res.data.updatedReview;
        const nextReviews = updatedReview
          ? [
              ...existing.filter((review) => String(review.customerId) !== currentCustomerId),
              updatedReview,
            ]
          : existing;

        return {
          ...item,
          avgRating: res.data.avgRating,
          reviewCount: res.data.reviewCount,
          latestReview: res.data.latestReview || item.latestReview,
          reviews: nextReviews,
        };
      }));

      setAlertMessage('Yorumunuz başarıyla kaydedildi.');
      setAlertType('success');
      setOpenReviewBarberId('');
    } catch (err) {
      setAlertMessage(err.response?.data?.message || 'Yorum gönderilirken bir hata oluştu.');
      setAlertType('danger');
    } finally {
      setSubmittingReviewBarberId('');
    }
  };

  const handleDeleteReview = async (barberId) => {
    setSubmittingReviewBarberId(barberId);
    try {
      const res = await axios.delete(`http://localhost:5001/api/barbers/${barberId}/reviews/me`, {
        headers: getAuthHeaders(),
      });

      setSuggestedBarbers((prev) => prev.map((item) => {
        if (item._id !== barberId) {
          return item;
        }

        const existing = Array.isArray(item.reviews) ? item.reviews : [];
        return {
          ...item,
          reviews: existing.filter((review) => String(review.customerId) !== currentCustomerId),
          avgRating: res.data.avgRating,
          reviewCount: res.data.reviewCount,
          latestReview: res.data.latestReview || null,
        };
      }));

      setAlertMessage('Yorumunuz silindi.');
      setAlertType('success');
      setOpenReviewBarberId('');
    } catch (err) {
      setAlertMessage(err.response?.data?.message || 'Yorum silinirken bir hata oluştu.');
      setAlertType('danger');
    } finally {
      setSubmittingReviewBarberId('');
    }
  };

  const renderHomePanel = () => (
    <div className="home-hero-panel mb-4">
      <div className="home-hero-card">
        <div className="home-hero-left">
          <div className="home-hero-avatar">{customerInitials}</div>
          <div>
            <div className="home-hero-kicker">Müşteri Paneli</div>
            <h2 className="home-hero-title mb-1">Hoş geldiniz</h2>
            <div className="home-hero-subtitle text-muted">Randevularını, faturalarını ve favorilerini tek yerden takip et.</div>
          </div>
        </div>

        <div className="home-hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => goToSection('booking', false)}>
            📅 Yeni Randevu
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={() => goToSection('appointments', false)}>
            Randevulara Git
          </button>
        </div>
      </div>

      <div className="home-summary-grid mt-3">
        {homeSummaryCards.map((card) => (
          <div key={card.label} className="home-summary-card">
            <span className={`home-summary-value home-summary-value-${card.tone}`}>{card.value}</span>
            <span className="home-summary-label">{card.label}</span>
          </div>
        ))}
      </div>

      <div className="home-quick-note mt-3">
        <div className="home-quick-note-title">Hızlı bakış</div>
        <div className="home-quick-note-text">
          <span className={`home-quick-note-status-pill home-quick-note-status-pill-${quickNoteStatus.tone}`}>
            <span>{quickNoteStatus.icon}</span>
            <span>{quickNoteStatus.label}</span>
          </span>
        </div>
        {quickNoteStatus.items.length > 0 ? (
          <div className="home-quick-note-list mt-2">
            {quickNoteStatus.items.map((item) => (
              <div key={item.id} className="home-quick-note-item">
                <div className="home-quick-note-item-head">
                  <div>
                    <div className="fw-semibold">{item.barberName}</div>
                    <div className="small text-muted">{item.dateLabel} · {item.timeLabel}</div>
                  </div>
                  <div className="home-quick-note-right">
                    <span className={`home-quick-note-status-pill home-quick-note-status-pill-${item.statusTone}`}>
                      <span>{item.statusIcon}</span>
                      <span>{item.statusLabel}</span>
                    </span>
                    {item.canEdit && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleStartEditAppointment(activeAppointments.find((appointment) => appointment._id === item.id))}
                      >
                        Düzenle
                      </button>
                    )}
                    {item.canCancel && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={cancellingAppointmentId === item.id}
                        onClick={() => handleCancelAppointment(activeAppointments.find((appointment) => appointment._id === item.id))}
                      >
                        {cancellingAppointmentId === item.id ? 'İptal...' : 'İptal'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="home-quick-note-actions mt-2">
                  {item.canRemind ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={sendingReminderAppointmentId === item.id}
                      onClick={() => handleSendBarberReminder(activeAppointments.find((appointment) => appointment._id === item.id))}
                    >
                      {sendingReminderAppointmentId === item.id ? 'Gönderiliyor...' : 'Berbere bildir'}
                    </button>
                  ) : item.reminderSentAt ? (
                    <span className="small text-muted">Hatırlatma gönderildi.</span>
                  ) : null}
                </div>

                {editingAppointmentId === item.id && (
                  <div className="home-quick-edit-box mt-2">
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-md-5">
                        <label className="form-label form-label-sm mb-1">Yeni tarih</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          min={new Date().toISOString().split('T')[0]}
                          value={editDate}
                          onChange={async (e) => {
                            const nextDate = e.target.value;
                            setEditDate(nextDate);
                            setSelectedEditSlotId('');
                            const source = activeAppointments.find((appointment) => appointment._id === item.id);
                            const slots = await loadRescheduleSlots(source?.barberId, nextDate);
                            setSelectedEditSlotId(findNearestSlotId(source?.time, slots));
                          }}
                        />
                      </div>
                      <div className="col-12 col-md-7">
                        <label className="form-label form-label-sm mb-1">Müsait saat</label>
                        <select
                          className="form-select form-select-sm"
                          value={selectedEditSlotId}
                          onChange={(e) => setSelectedEditSlotId(e.target.value)}
                          disabled={loadingEditSlots || editSlots.length === 0}
                        >
                          <option value="">Saat seçin</option>
                          {editSlots.map((slot) => (
                            <option key={slot._id} value={slot._id}>{slot.time}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="d-flex gap-2 mt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={savingEditAppointmentId === item.id || !selectedEditSlotId}
                        onClick={() => handleSubmitEditAppointment(activeAppointments.find((appointment) => appointment._id === item.id))}
                      >
                        {savingEditAppointmentId === item.id ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setEditingAppointmentId('');
                          setSelectedEditSlotId('');
                          setEditSlots([]);
                        }}
                      >
                        Vazgeç
                      </button>
                    </div>
                    {loadingEditSlots && <div className="small text-muted mt-2">Müsait saatler yükleniyor...</div>}
                    {!loadingEditSlots && editSlots.length === 0 && (
                      <div className="small text-muted mt-2">Bu tarihte müsait saat bulunamadı.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="home-quick-note-body mt-1">{quickNoteStatus.text}</div>
        )}
      </div>

      <div className="home-live-grid mt-3">
        <div className="home-live-card">
          <div className="home-live-head d-flex justify-content-between align-items-center mb-2">
            <h3 className="home-live-title mb-0">Önerilen Berberler</h3>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => goToSection('booking', false)}>
              Tümü
            </button>
          </div>

          <div className="home-location-filter mb-3">
            <div>
              <label className="form-label form-label-sm mb-1">İl</label>
              <select
                className="form-select form-select-sm"
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedDistrict('');
                }}
              >
                <option value="">İl seçin</option>
                {cities.map((cityItem) => (
                  <option key={cityItem} value={cityItem}>{cityItem}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label form-label-sm mb-1">İlçe</label>
              <select
                className="form-select form-select-sm"
                value={selectedDistrict}
                disabled={!selectedCity}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                <option value="">İlçe seçin</option>
                {filterDistricts.map((districtItem) => (
                  <option key={districtItem} value={districtItem}>{districtItem}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingSuggestedBarbers ? (
            <div className="text-muted small">Berber önerileri yükleniyor...</div>
          ) : suggestedBarbers.length > 0 ? (
            <>
            <div className="home-barber-grid home-swipe-track" ref={barberScrollRef}>
              {suggestedBarbers.map((barber, index) => {
                const ownReview = getOwnReviewForBarber(barber);
                const canDeleteOwn = canDeleteOwnReview(ownReview);
                const hasService = hadPastServiceWithBarber(barber);

                return (
                  <div
                    key={barber._id}
                    className="home-barber-card home-swipe-card"
                    ref={(el) => {
                      barberCardRefs.current[index] = el;
                    }}
                    data-slide-index={index}
                  >
                    <div className="home-barber-name">{barber.salonName || barber.name}</div>
                      <div className="home-barber-meta text-muted">{barber.name} · {barber.city || 'Şehir yok'} / {barber.district || 'İlçe yok'}</div>
                    <div className="home-barber-meta text-muted">{barber.services?.length || 0} hizmet · {barber.address || 'Adres bilgisi yok'}</div>

                    <div className="home-barber-rating mt-1">
                      <span className="home-barber-stars">{renderStars(barber.avgRating)}</span>
                      <span className="home-barber-rating-text">{Number(barber.avgRating || 0).toFixed(1)} ({barber.reviewCount || 0} yorum)</span>
                    </div>

                    {barber.latestReview?.comment ? (
                      <div className="home-barber-comment">“{barber.latestReview.comment}”</div>
                    ) : (
                      <div className="home-barber-comment text-muted">Henüz yorum yok.</div>
                    )}

                    <div className="d-flex gap-2 flex-wrap mt-2">
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => goToSection('booking', false)}>
                        Randevu Al
                      </button>
                      {hasService ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setOpenReviewBarberId((prev) => (prev === barber._id ? '' : barber._id));
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [barber._id]: {
                                rating: prev[barber._id]?.rating || ownReview?.rating || 5,
                                comment: prev[barber._id]?.comment || ownReview?.comment || '',
                              },
                            }));
                          }}
                        >
                          {ownReview ? 'Yorumu Düzenle' : 'Yorum Yap'}
                        </button>
                      ) : (
                        <span className="home-review-lock text-muted">Yorum için önce hizmet almalısınız</span>
                      )}
                    </div>

                    {openReviewBarberId === barber._id && hasService && (
                      <div className="home-review-form mt-2">
                        <div className="mb-2">
                          <label className="form-label small mb-1">Puan</label>
                          <select
                            className="form-select form-select-sm"
                            value={reviewDrafts[barber._id]?.rating || ownReview?.rating || 5}
                            onChange={(e) => handleReviewDraftChange(barber._id, 'rating', Number(e.target.value))}
                          >
                            <option value={5}>5 - Mükemmel</option>
                            <option value={4}>4 - Çok iyi</option>
                            <option value={3}>3 - İyi</option>
                            <option value={2}>2 - Orta</option>
                            <option value={1}>1 - Zayıf</option>
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="form-label small mb-1">Yorumunuz</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            maxLength={500}
                            value={reviewDrafts[barber._id]?.comment || ownReview?.comment || ''}
                            onChange={(e) => handleReviewDraftChange(barber._id, 'comment', e.target.value)}
                            placeholder="Deneyiminizi kısa bir şekilde paylaşın"
                          />
                        </div>
                        <div className="d-flex gap-2 align-items-center flex-wrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            disabled={submittingReviewBarberId === barber._id}
                            onClick={() => handleSubmitReview(barber._id)}
                          >
                            {submittingReviewBarberId === barber._id ? 'Gönderiliyor...' : ownReview ? 'Yorumu Güncelle' : 'Yorumu Gönder'}
                          </button>
                          {ownReview && canDeleteOwn && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={submittingReviewBarberId === barber._id}
                              onClick={() => handleDeleteReview(barber._id)}
                            >
                              Yorumu Sil
                            </button>
                          )}
                          {ownReview && !canDeleteOwn && (
                            <span className="home-review-expired text-muted">Yorum silme süresi (24 saat) doldu.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="home-swipe-dots d-lg-none">
              {suggestedBarbers.map((barber, index) => (
                <span
                  key={barber._id}
                  className={`home-swipe-dot ${activeBarberSlideIndex === index ? 'active' : ''}`}
                />
              ))}
            </div>
            </>
          ) : (
            <div className="home-empty-state-wrap">
              <div className="home-empty-state-card">
                <div className="home-empty-state-title">Yakınında önerilen berber bulunamadı</div>
                <div className="home-empty-state-text text-muted">
                  {suggestionDistrictLabel
                    ? `${suggestionDistrictLabel} bölgesinde şu an listelenecek berber yok.`
                    : 'Sana en yakın seçenekleri göstermek için veri oluştukça burada listelenecek.'}
                </div>
                <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={() => goToSection('booking', false)}>
                  Tüm berberleri gör
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="home-live-card">
          <h3 className="home-live-title mb-2">Geçmiş Randevularım</h3>
          {pastAppointments.length > 0 ? (
            <>
            <div className="d-grid gap-2 home-past-list home-swipe-track" ref={pastScrollRef}>
              {pastAppointments.map((app, index) => (
                <div
                  key={app._id}
                  className="home-agenda-item home-swipe-card"
                  ref={(el) => {
                    pastCardRefs.current[index] = el;
                  }}
                  data-slide-index={index}
                >
                  <div className="home-past-topline">
                    <div className="fw-semibold">{app.barberName || 'Berber'}</div>
                    <span className={`badge text-bg-${getStatusColor(app.status)}`}>{getStatusLabel(app.status, app)}</span>
                  </div>
                  <div className="small text-muted">{new Date(app.date).toLocaleDateString()} · {app.time}</div>
                  <div className="home-past-detail mt-2">
                    <div><span className="text-muted">Hizmet:</span> {app.service?.name || 'Belirtilmemiş'}</div>
                    <div><span className="text-muted">Ücret:</span> {app.service?.price ? `₺${app.service.price}` : 'Bilgi yok'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="home-swipe-dots d-lg-none">
              {pastAppointments.map((app, index) => (
                <span
                  key={app._id}
                  className={`home-swipe-dot ${activePastSlideIndex === index ? 'active' : ''}`}
                />
              ))}
            </div>
            </>
          ) : (
            <div className="home-empty-state-card">
              <div className="home-empty-state-title">Geçmiş randevu bulunamadı</div>
              <div className="home-empty-state-text text-muted">Hizmet saati tamamlanan randevular burada listelenecek.</div>
              <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={() => goToSection('booking', false)}>
                Randevu Oluştur
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

    const renderContent = () => {
      if (activeSection === 'home') {
        return (
          <>
            {renderHomePanel()}
            <div className="home-welcome-panel">
              <div>
                <div className="home-welcome-title">Bugün için kısa not</div>
                <div className="home-welcome-text text-muted">
                  {email ? `${email} hesabıyla oturum açtın.` : 'Hesabın hazır, işlemlere devam edebilirsin.'}
                </div>
              </div>
              <div className="home-welcome-actions">
                <button type="button" className="btn btn-outline-secondary" onClick={() => goToSection('favorites', false)}>
                  Favorileri Aç
                </button>
                <button type="button" className="btn btn-outline-warning" onClick={() => goToSection('account', false)}>
                  Hesap Ayarları
                </button>
              </div>
            </div>
          </>
        );
      }

      if (activeSection === 'booking') {
        return (
          <div className="home-booking-shell">
            <BookingPage
              embedded
              onBack={() => goToSection('home', false)}
              onSuccess={() => {
                goToSection('home', false);
                window.location.reload();
              }}
            />
          </div>
        );
      }

      if (activeSection === 'appointments') {
        return (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              {loadingAppointments ? (
                <div className="text-muted">Randevular yükleniyor...</div>
              ) : sortedAppointments.length > 0 ? (
                <>
                  <div className="d-none d-md-block table-responsive">
                    <table className="table table-striped mb-0">
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Saat</th>
                          <th>Berber</th>
                          <th>Hizmet</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAppointments.map((app) => (
                          <tr key={app._id}>
                            <td>{new Date(app.date).toLocaleDateString()}</td>
                            <td>{app.time}</td>
                            <td>{app.barberName}</td>
                            <td>{app.service?.name || '-'}{app.service?.price ? ` (₺${app.service.price})` : ''}</td>
                            <td><span className={`badge text-bg-${getStatusColor(app.status)}`}>{getStatusLabel(app.status, app)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-md-none d-grid gap-2">
                    {sortedAppointments.map((app) => (
                      <div key={app._id} className="appointment-mobile-card p-3 rounded-3 border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong>{app.barberName || 'Berber'}</strong>
                          <span className={`badge text-bg-${getStatusColor(app.status)}`}>{getStatusLabel(app.status, app)}</span>
                        </div>
                        <div className="small text-muted mb-1">{new Date(app.date).toLocaleDateString()} - {app.time}</div>
                        <div className="small">
                          <span className="fw-semibold">Hizmet: </span>
                          {app.service?.name || '-'}{app.service?.price ? ` (₺${app.service.price})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="alert alert-info mb-0">Henüz randevu oluşturmadınız.</div>
              )}
            </div>
          </div>
        );
      }

      if (activeSection === 'invoices') {
        return (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              {invoices.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-bordered mb-0">
                    <thead>
                      <tr>
                        <th>Fatura No</th>
                        <th>Tarih</th>
                        <th>Tutar</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv._id}>
                          <td>{inv.invoiceNumber}</td>
                          <td>{new Date(inv.date).toLocaleDateString()}</td>
                          <td>{inv.amount} ₺</td>
                          <td>{inv.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-info mb-0">Henüz fatura bulunmamaktadır.</div>
              )}
            </div>
          </div>
        );
      }

      if (activeSection === 'favorites') {
        return (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              {favorites.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Berber Adı</th>
                        <th>İlçe</th>
                        <th>Telefon</th>
                        <th>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {favorites.map((fav) => (
                        <tr key={fav._id}>
                          <td>{fav.barberName}</td>
                          <td>{fav.district}</td>
                          <td>{fav.phone}</td>
                          <td>
                            <button className="btn btn-sm btn-danger" onClick={() => handleRemoveFavorite(fav.barberId)}>
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-info mb-0">Henüz favori berber eklemediniz.</div>
              )}
            </div>
          </div>
        );
      }

      if (activeSection === 'account') {
        return (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <form>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Ad</label>
                    <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Soyad</label>
                    <input type="text" className="form-control" value={surname} onChange={e => setSurname(e.target.value)} autoComplete="family-name" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">E-posta</label>
                    <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Telefon</label>
                    <input type="tel" className="form-control" value={phone} readOnly autoComplete="tel" />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Adres</label>
                    <input type="text" className="form-control" value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">İl</label>
                    <select className="form-select" value={profileCity} onChange={e => {
                      setProfileCity(e.target.value);
                      setProfileDistrict('');
                    }}>
                      <option value="">İl seçin</option>
                      {cities.map((cityItem) => (
                        <option key={cityItem} value={cityItem}>{cityItem}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">İlçe</label>
                    <select className="form-select" value={profileDistrict} disabled={!profileCity} onChange={e => setProfileDistrict(e.target.value)}>
                      <option value="">İlçe seçin</option>
                      {profileDistricts.map((districtItem) => (
                        <option key={districtItem} value={districtItem}>{districtItem}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <button type="button" className="btn btn-primary" onClick={handleUpdateProfile}>Bilgileri Güncelle</button>
                </div>

                <hr className="my-4" />

                <h6 className="mb-3">Şifre Değiştir</h6>
                <div className="row g-3 align-items-end">
                  <div className="col-md-5">
                    <label className="form-label">Eski Şifre</label>
                    <input type="password" className="form-control" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoComplete="current-password" />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label">Yeni Şifre</label>
                    <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                  <div className="col-md-2">
                    <button type="button" className="btn btn-warning w-100" onClick={handleChangePassword}>Güncelle</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      }

      return null;
    };


    return (
      <div className="customer-shell container-fluid p-0">
        <div className="row g-0">
          <aside className="col-12 col-lg-3 col-xl-2 sidebar border-end d-none d-lg-flex flex-column">
            <div className="p-3 p-lg-4 d-flex flex-column h-100">
              <button
                type="button"
                className="btn btn-link logo-button text-decoration-none p-0 mb-4 sidebar-brand-title"
                onClick={() => {
                  goToSection('home', false);
                  navigate('/customer/home');
                }}
              >
                Berber Randevu
              </button>

              <div className="list-group mt-4">
                {navigationItems.map((item) => renderNavButton(item))}
              </div>
            </div>

            {footerContent}
          </aside>

          <main className="col-12 col-lg-9 col-xl-10">
            <div className="topbar px-3 px-lg-4 py-3 d-flex justify-content-between align-items-center border-bottom">
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary d-lg-none"
                  onClick={() => setShowMobileMenu(true)}
                  aria-label="Menüyü aç"
                >
                  ☰
                </button>
                <button
                  type="button"
                  className="btn btn-link logo-button text-decoration-none p-0 d-lg-none"
                  onClick={() => {
                    goToSection('home', false);
                    navigate('/customer/home');
                  }}
                >
                  Logo
                </button>
                <h1 className="page-title mb-0 d-none d-lg-block">{getSectionTitle()}</h1>
              </div>

              <div className="d-flex align-items-center gap-2 position-relative" ref={headerMenuRef}>
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-circle position-relative icon-btn"
                  onClick={() => {
                    setShowNotifications((prev) => !prev);
                    setShowProfileMenu(false);
                  }}
                  aria-label="Bildirimler"
                >
                  🔔
                  {pendingAppointments > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                      {pendingAppointments}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-primary rounded-circle icon-btn"
                  onClick={() => {
                    setShowProfileMenu((prev) => !prev);
                    setShowNotifications(false);
                  }}
                  aria-label="Profil"
                >
                  👤
                </button>

                {showNotifications && (
                  <div className="card shadow-sm position-absolute end-0 mt-2 menu-pop" style={{ width: '320px', zIndex: 1050 }}>
                    <div className="card-header bg-light fw-semibold">Bildirimler</div>
                    <div className="list-group list-group-flush">
                      {recentNotifications.length > 0 ? (
                        recentNotifications.map((app) => (
                          <div key={app._id} className="list-group-item">
                            <div className="fw-semibold">{app.barberName || 'Berber'}</div>
                            <small className="text-muted d-block">{new Date(app.date).toLocaleDateString()} {app.time}</small>
                            <small className="text-muted">Durum: {app.status}</small>
                          </div>
                        ))
                      ) : (
                        <div className="list-group-item text-muted">Yeni bildirimin yok.</div>
                      )}
                    </div>
                  </div>
                )}

                {showProfileMenu && (
                  <div className="card shadow-sm position-absolute end-0 mt-2 menu-pop" style={{ width: '320px', zIndex: 1050 }}>
                    <div className="card-body">
                      <h6 className="card-title mb-3">Hesap Bilgileri</h6>
                      <p className="mb-1"><strong>Ad Soyad:</strong> {(name || '-')} {(surname || '')}</p>
                      <p className="mb-1"><strong>Telefon:</strong> {phone || '-'}</p>
                      <p className="mb-3"><strong>E-posta:</strong> {email || '-'}</p>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            goToSection('account', false);
                            setShowProfileMenu(false);
                          }}
                        >
                          Hesap Ayarları
                        </button>
                        <button type="button" className="btn btn-danger btn-sm ms-auto" onClick={handleLogout}>
                          🚪 Çıkış
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="content-area p-3 p-lg-4">
              {activeSection !== 'home' && sectionHistory.length > 0 && (
                <div className="d-lg-none mobile-back-row mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm mobile-back-btn"
                    onClick={goBackSection}
                  >
                    ← Önceki bölüme dön
                  </button>
                </div>
              )}

              {alertMessage && (
                <div className={`alert alert-${alertType}`} role="alert">
                  {alertMessage}
                </div>
              )}

              <div className="section-stage">
                {renderContent()}
              </div>
            </div>

          </main>
        </div>

        {showMobileMenu && <div className="mobile-offcanvas-backdrop d-lg-none" onClick={() => setShowMobileMenu(false)} />}

        <div className={`mobile-offcanvas d-lg-none ${showMobileMenu ? 'show' : ''}`}>
          <div className="p-3 d-flex flex-column h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <button
                type="button"
                className="btn btn-link logo-button text-decoration-none p-0"
                onClick={() => {
                  goToSection('home');
                  setShowMobileMenu(false);
                  navigate('/customer/home');
                }}
              >
                Berber Randevu
              </button>
              <button type="button" className="btn-close" onClick={() => setShowMobileMenu(false)} aria-label="Menüyü kapat" />
            </div>

            <div className="list-group">
              {navigationItems.map((item) => renderNavButton(item, true))}
            </div>

            {footerContent}
          </div>
        </div>
      </div>
    );
  }

export default CustomerHome;
