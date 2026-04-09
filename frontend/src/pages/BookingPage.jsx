import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './BookingPage.css';
import barberLogoSample from '../assets/barber-logo-sample.svg';

const toLocalDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function BookingPage({ embedded = false, onBack, onSuccess }) {
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [barbersFetched, setBarbersFetched] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);

  const navigate = useNavigate();
  const today = toLocalDateInput(new Date());
  
useEffect(() => {
  const loadCities = async () => {
    const res = await api.get('/locations/cities');
    setCities(res.data);
  };
  loadCities();
}, []);

useEffect(() => {
  const mediaQuery = window.matchMedia('(max-width: 991.98px)');
  const updateMobile = () => setIsMobile(mediaQuery.matches);
  updateMobile();
  mediaQuery.addEventListener('change', updateMobile);
  return () => mediaQuery.removeEventListener('change', updateMobile);
}, []);

const loadDistricts = async (city) => {
  const res = await api.get(`/locations/districts/${city}`);
  setDistricts(res.data);
};
const loadBarbers = async () => {
    if (!city || !district) return;
    setLoadingBarbers(true);
    setBarbersFetched(true);
    setSelectedBarber(null);
    try {
      const res = await api.get('/barbers/byDistrict', { params: { city, district } });
      setBarbers(res.data || []);
      if (isMobile) {
        setMobileStep(2);
      }
    } catch (err) {
      console.error('Berber listeleme hatası', err);
      setBarbers([]);
    } finally {
      setLoadingBarbers(false);
    }
};

  const renderStars = (value) => {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  };

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (!city || !district) {
      setMobileStep(1);
      return;
    }

    if (!selectedBarber && mobileStep > 2) {
      setMobileStep(2);
      return;
    }

    if ((!selectedService || !selectedDate || !selectedSlot) && mobileStep > 3) {
      setMobileStep(3);
      return;
    }
  }, [isMobile, city, district, selectedBarber, selectedService, selectedDate, selectedSlot]);
  const processPayment = async () => {
    setPaymentStatus('processing');
    setTimeout(async () => {
      try {
        const customerInfo = JSON.parse(localStorage.getItem('customerInfo'));
        // Slot rezervasyonu - bu zaten customer appointment'ını ekliyor
        const slotRes = await api.patch(`/slots/${selectedSlot._id}/book`, {
          customerId: customerInfo._id,
          customerPhone: customerInfo.phone,
          customerName: `${customerInfo.name || ''} ${customerInfo.surname || ''}`.trim(),
          service: selectedService?.name,
          price: selectedPrice
        });

        setPaymentStatus('success');
        setTimeout(() => {
          setShowPayment(false);
          setPaymentStatus(null);
          if (typeof onSuccess === 'function') {
            onSuccess();
          } else {
            navigate('/customer/home');
          }
        }, 2000);
      } catch (err) {
        console.error('Ödeme/randevu hatası', err);
        setPaymentStatus('error');
      }
    }, 3000);
  };

  const selectedPrice = Number(selectedService?.price || 0);
  const recommendedSlotId = availableSlots?.[0]?._id || '';
  const serviceList = selectedBarber?.services || [];
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

  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${selectedDate}T00:00:00`))
    : '';

  const handleDateSelect = async (dateValue) => {
    setSelectedDate(dateValue);
    setSelectedSlot(null);

    if (dateValue) {
      try {
        const res = await api.get('/slots/available', { params: { barberId: selectedBarber._id, date: dateValue } });
        setAvailableSlots(res.data.data);
      } catch (err) {
        console.error('Slot yükleme hatası', err);
        if (err.response?.data?.instantOnly) {
          alert('Bu berber takvim randevusu almıyor, doğrudan yer ayırtabilirsiniz.');
          setAvailableSlots([]);
        }
      }
    } else {
      setAvailableSlots([]);
    }
  };

  const currentStep = (() => {
    if (!city || !district) return 1;
    if (!selectedBarber) return 2;
    if (!selectedService || !selectedDate || !selectedSlot) return 3;
    return 4;
  })();

  const flowSteps = [
    { id: 1, label: 'Konum' },
    { id: 2, label: 'Berber' },
    { id: 3, label: 'Hizmet & Saat' },
    { id: 4, label: 'Onay' },
  ];

  const canProceedFromStep = (step) => {
    if (step === 1) return Boolean(city && district);
    if (step === 2) return Boolean(selectedBarber);
    if (step === 3) return Boolean(selectedService && selectedDate && selectedSlot);
    return true;
  };

  const canEnterStep = (step) => {
    if (step <= 1) return true;
    if (step === 2) return Boolean(city && district);
    if (step === 3) return Boolean(city && district && selectedBarber);
    if (step === 4) return Boolean(city && district && selectedBarber && selectedService && selectedDate && selectedSlot);
    return false;
  };

  const visibleStep = isMobile ? mobileStep : null;

  return (
    <div className={`${embedded ? 'booking-inline-panel position-relative' : 'container mt-4 position-relative'} booking-page-shell`}>
      <div className="booking-header mb-3">
        <h2 className="mb-1">💈 Randevu Oluştur</h2>
        <p className="booking-header-sub mb-0">2 dakikada randevunu planla, tüm adımları tek akışta tamamla.</p>
      </div>

      <div className="booking-stepper mb-4">
        {flowSteps.map((step) => {
          const isDone = currentStep > step.id;
          const isActive = currentStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              className={`booking-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (!isMobile) return;
                const canGoBack = step.id <= mobileStep;
                if (canGoBack || canEnterStep(step.id)) {
                  setMobileStep(step.id);
                }
              }}
              disabled={isMobile ? !(step.id <= mobileStep || canEnterStep(step.id)) : true}
            >
              <span className="booking-step-index">{step.id}</span>
              <span className="booking-step-label">{step.label}</span>
            </button>
          );
        })}
      </div>

      <div className="booking-layout">
        <div className="booking-main">

      <div className={`booking-section-card mb-3 ${isMobile && visibleStep !== 1 ? 'booking-mobile-step-hidden' : ''}`}>
        <div className="booking-section-title">1. Konumunu Seç</div>

      {/* İl seçimi */}
      <div className="mb-3">
        <label className="form-label">İl Seçin</label>
        <select className="form-select" value={city} 
  onChange={e => {
    setCity(e.target.value);
    setDistrict('');
    setBarbers([]);
    setBarbersFetched(false);
    setSelectedBarber(null);
    loadDistricts(e.target.value);
  }}>
  <option value="">İl seçin...</option>
  {cities.map(c => <option key={c} value={c}>{c}</option>)}
</select>

      </div>

      {/* İlçe seçimi */}
      {city && (
        <div className="mb-3">
          <label className="form-label">İlçe Seçin</label>
          <select className="form-select" value={district} onChange={e => {
    setDistrict(e.target.value);
    setBarbers([]);
    setBarbersFetched(false);
    setSelectedBarber(null);
  }}>
    <option value="">İlçe seçin...</option>
    {districts.map(d => <option key={d} value={d}>{d}</option>)}
  </select>

        </div>
      )}

      </div>

      {/* Berberleri listele */}
      {district && (
        <button onClick={loadBarbers} className={`btn btn-primary booking-list-btn mb-3 ${isMobile && visibleStep !== 1 ? 'booking-mobile-step-hidden' : ''}`}>Berberleri Listele</button>
      )}

      {loadingBarbers && (!isMobile || visibleStep === 2) && (
        <div className="booking-info-note mb-3">Berberler yükleniyor...</div>
      )}

      {barbersFetched && !loadingBarbers && barbers.length === 0 && (!isMobile || visibleStep === 2) && (
        <div className="booking-empty-state mb-3">
          <div className="booking-empty-title">Bu ilçede berber bulunamadı</div>
          <div className="booking-empty-text">
            {district ? `${district} için şu anda listelenebilir bir berber yok.` : 'Seçtiğiniz kriterlerde berber bulunamadı.'}
          </div>
        </div>
      )}

      {barbers.length > 0 && (
        <div className={`booking-section-card mb-3 ${isMobile && visibleStep !== 2 ? 'booking-mobile-step-hidden' : ''}`}>
          <div className="booking-section-title">2. Berberini Seç</div>
        <div className="booking-barber-grid mb-1">
          {barbers.map((barber) => (
            <button
              key={barber._id}
              type="button"
              className={`booking-barber-card ${selectedBarber?._id === barber._id ? 'active' : ''}`}
              onClick={() => {
                setSelectedBarber(barber);
                setSelectedService(null);
                setServiceDropdownOpen(false);
                setSelectedDate('');
                setSelectedSlot(null);
                setAvailableSlots([]);
                if (isMobile) {
                  setMobileStep(3);
                }
              }}
            >
              <div className="booking-barber-logo-wrap">
                <img
                  src={barber.logoUrl || barberLogoSample}
                  alt="Berber logosu"
                  className="booking-barber-logo"
                  onError={(event) => {
                    event.currentTarget.src = barberLogoSample;
                  }}
                />
              </div>
              <div className="booking-barber-name">{barber.salonName || barber.name}</div>
              <div className="booking-barber-meta text-muted">{barber.name} · {barber.city || 'Şehir yok'} / {barber.district || 'İlçe yok'}</div>
              <div className="booking-barber-meta text-muted">{barber.services?.length || 0} hizmet · {barber.address || 'Adres bilgisi yok'}</div>
              <div className="booking-barber-rating mt-1">
                <span className="booking-barber-stars">{renderStars(barber.avgRating)}</span>
                <span className="booking-barber-rating-text">{Number(barber.avgRating || 0).toFixed(1)} ({barber.reviewCount || 0} yorum)</span>
              </div>
              {barber.latestReview?.comment ? (
                <div className="booking-barber-comment">“{barber.latestReview.comment}”</div>
              ) : (
                <div className="booking-barber-comment text-muted">Henüz yorum yok.</div>
              )}
            </button>
          ))}
        </div>
        </div>
      )}


      {/* Randevu tarihi ve slot seçimi */}
      {selectedBarber && (
        <div className={`booking-section-card mt-3 ${isMobile && visibleStep !== 3 ? 'booking-mobile-step-hidden' : ''}`}>
          <div className="booking-section-title">3. Hizmet ve Saat Seçimi</div>
          <h3 className="booking-inline-title">{selectedBarber.name} için randevu al</h3>
          <div className={`booking-section-note mb-3 ${isMobile ? 'd-none' : ''}`}>
            Hizmeti seçtikten sonra tarih ve saat önerileri otomatik daralır. En uygun seçenekleri üstte, detayları altında görebilirsin.
          </div>
          {/* hizmet seçimi */}
          <div className="booking-service-picker mb-3">
            <label className="form-label mb-2">Hizmet Seçin</label>
            {serviceList.length > 0 ? (
              <>
                <div className="booking-service-dropdown">
                  <button
                    type="button"
                    className={`booking-service-trigger ${serviceDropdownOpen ? 'open' : ''}`}
                    onClick={() => setServiceDropdownOpen((value) => !value)}
                  >
                    <span className="booking-service-trigger-icon">✂️</span>
                    <span className="booking-service-trigger-text">
                      {selectedService ? selectedService.name : 'Hizmet seçin...'}
                    </span>
                    <span className="booking-service-trigger-chevron">▾</span>
                  </button>

                  {serviceDropdownOpen && (
                    <div className="booking-service-menu">
                      {serviceList.map((svc, index) => {
                        const accentColor = ['#8B4513', '#B87333', '#D18A1F', '#4A7C59'][index % 4];
                        const isActive = selectedService?._id === svc._id;

                        return (
                          <button
                            key={svc._id}
                            type="button"
                            className={`booking-service-option ${isActive ? 'active' : ''}`}
                            style={{ '--service-accent': accentColor }}
                            onClick={() => {
                              setSelectedService(svc || null);
                              setServiceDropdownOpen(false);
                            }}
                          >
                            <span className="booking-service-option-icon">✂️</span>
                            <span className="booking-service-option-body">
                              <span className="booking-service-option-name">{svc.name}</span>
                              <span className="booking-service-option-meta">
                                {Number(svc.duration || 0) > 0 ? `${svc.duration} dk` : 'Süre bilgisi yok'} · ₺{Number(svc.price || 0)}
                              </span>
                            </span>
                            <span className="booking-service-option-pill">Seç</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedService && (
                  <div className="booking-service-summary mt-2">
                    <span>{selectedService.name}</span>
                    <strong>
                      ₺{selectedPrice} · {selectedService.duration || 0} dk
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <div className="booking-info-note">
                Bu salonda henüz tanımlı hizmet bulunmuyor.
              </div>
            )}
          </div>

          <div className="booking-date-block my-3">
            <div className="booking-date-topline mb-2">
              <div className="booking-date-icon">📅</div>
              <div className="booking-date-copy">
                <label className="form-label mb-1">Tarih Seçin</label>
                <div className="booking-section-note mb-0 d-none d-lg-block">Önce günü seç, ardından saat seçenekleri otomatik güncellensin.</div>
              </div>
            </div>

            <div className="booking-calendar-shell">
              <div className="booking-calendar-head">
                <div>
                  <div className="booking-calendar-title">Yaklaşan Günler</div>
                  <div className="booking-calendar-subtitle">En yakın 5 gün içinden seçebilirsin.</div>
                </div>
                <div className="booking-calendar-pill">5 gün</div>
              </div>

              <div className="booking-calendar-weekdays">
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="booking-calendar-grid">
                {calendarDays.map((day) => {
                  const isSelected = selectedDate === day.value;
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`booking-calendar-day ${isSelected ? 'active' : ''}`}
                      onClick={() => handleDateSelect(day.value)}
                    >
                      <span className="booking-calendar-day-name">{day.dayName}</span>
                      <strong className="booking-calendar-day-number">{day.dayNumber}</strong>
                      <span className="booking-calendar-day-month">{day.monthName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isMobile && selectedDate ? (
              <div className="booking-date-summary mt-2">
                <span>Seçilen gün</span>
                <strong>{selectedDateLabel}</strong>
              </div>
            ) : !isMobile ? (
              <div className="booking-date-summary mt-2 booking-date-summary-empty">
                <span>Henüz gün seçilmedi</span>
                <strong>Takvimden uygun tarihi işaretleyebilirsin</strong>
              </div>
            ) : null}
          </div>

          {/* Saat seçim */}
          {selectedDate && availableSlots.length > 0 && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <label className="form-label mb-0">Saat Seçin</label>
                <span className="booking-time-note">En hızlı uygun saatler üstte listelenir.</span>
              </div>
              <div className="booking-time-grid">
                {availableSlots.map(slot => (
                  <button
                    key={slot._id}
                    type="button"
                    className={`booking-time-chip ${selectedSlot === slot ? 'active' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot._id === recommendedSlotId && (
                      <span className="booking-time-chip-badge">Önerilen</span>
                    )}
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDate && availableSlots.length === 0 && (
            <div className="booking-empty-state mb-3">
              <div className="booking-empty-title">Bu gün için boş saat kalmadı</div>
              <div className="booking-empty-text">Lütfen farklı bir tarih seçin.</div>
            </div>
          )}

          {selectedService && selectedDate && selectedSlot && (
            <div className="booking-step4-card mt-3">
              <div className="booking-section-title mb-2">4. Onay</div>
              <div className="small text-muted mb-2">Seçimlerin hazır. Ödemeye geçerek randevunu tamamlayabilirsin.</div>
              <div className="booking-comparison-mini mb-2">
                <span>Seçili hizmet</span>
                <strong>{selectedService?.name} · ₺{selectedPrice} · {selectedService?.duration || 0} dk</strong>
              </div>
              <button className="btn btn-outline-primary" onClick={() => setShowPayment(true)}>
                Ödemeye Geç
              </button>
            </div>
          )}
        </div>
      )}

      {selectedBarber && selectedService && selectedDate && selectedSlot && isMobile && visibleStep === 4 && (
        <div className="booking-section-card mt-3">
          <div className="booking-section-title">4. Onay</div>
          <div className="small text-muted mb-2">Randevu özetini kontrol et ve işlemi tamamla.</div>
          <div className="booking-step4-card">
            <div className="booking-summary-item"><span>Salon</span><strong>{selectedBarber?.salonName || selectedBarber?.name || '-'}</strong></div>
            <div className="booking-summary-item"><span>Hizmet</span><strong>{selectedService?.name || '-'}</strong></div>
            <div className="booking-summary-item"><span>Tarih / Saat</span><strong>{selectedDate} {selectedSlot?.time}</strong></div>
            <div className="booking-summary-item booking-summary-total"><span>Tutar</span><strong>{selectedPrice > 0 ? `₺${selectedPrice}` : 'Seçilmedi'}</strong></div>
          </div>
          <button className="btn btn-primary w-100 mt-3" onClick={() => setShowPayment(true)}>
            Randevuyu Tamamla
          </button>
        </div>
      )}

        </div>

        <aside className="booking-summary">
          <div className="booking-summary-card">
            <div className="booking-summary-title">Randevu Özeti</div>
            <div className="booking-summary-item">
              <span>Adım</span>
              <strong>{currentStep}/4</strong>
            </div>
            <div className="booking-summary-item">
              <span>İl / İlçe</span>
              <strong>{city || '-'} {district ? `/ ${district}` : ''}</strong>
            </div>
            <div className="booking-summary-item">
              <span>Salon</span>
              <strong>{selectedBarber?.salonName || selectedBarber?.name || '-'}</strong>
            </div>
            <div className="booking-summary-item">
              <span>Hizmet</span>
              <strong>{selectedService?.name || '-'}</strong>
            </div>
            <div className="booking-summary-item">
              <span>Tarih / Saat</span>
              <strong>{selectedDate ? `${selectedDate} ${selectedSlot?.time || ''}` : '-'}</strong>
            </div>
            <div className="booking-summary-item booking-summary-total">
              <span>Tutar</span>
              <strong>{selectedPrice > 0 ? `₺${selectedPrice}` : 'Seçilmedi'}</strong>
            </div>

            <button
              className="btn btn-primary w-100 mt-2"
              disabled={!selectedService || !selectedSlot}
              onClick={() => setShowPayment(true)}
            >
              Randevuyu Tamamla
            </button>

            <div className="booking-policy-note mt-2">Randevu sonrası onay süreci berber tarafından tamamlanır.</div>
          </div>
        </aside>
      </div>

      {isMobile && (
        <div className="booking-mobile-nav">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={mobileStep <= 1}
            onClick={() => setMobileStep((prev) => Math.max(1, prev - 1))}
          >
            Önceki Adım
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={mobileStep >= 4 || !canProceedFromStep(mobileStep)}
            onClick={() => setMobileStep((prev) => Math.min(4, prev + 1))}
          >
            İleri
          </button>
        </div>
      )}

      {/* Ödeme Modalı */}
      {showPayment && (
        <div className="modal d-block" tabIndex="-1" onClick={() => setShowPayment(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">💳 Ödeme</h5>
                <button type="button" className="btn-close" onClick={() => setShowPayment(false)}></button>
              </div>
              <div className="modal-body">
                <p>Randevu: {selectedDate} {selectedSlot?.time}</p>
                <p>Berber: {selectedBarber?.name}</p>
                <p>Kapora: <strong>100 TL</strong></p>
                {paymentStatus === null && (
                  <>
                    <input type="text" className="form-control mb-2" placeholder="Kart Numarası" />
                    <div className="d-flex gap-2">
                      <input type="text" className="form-control" placeholder="AA/YY" />
                      <input type="text" className="form-control" placeholder="CVV" />
                    </div>
                  </>
                )}
                {paymentStatus === 'processing' && <div className="text-warning">⏳ İşleniyor...</div>}
                {paymentStatus === 'success' && <div className="text-success">✅ Ödeme Başarılı! Randevunuz oluşturuldu.</div>}
                {paymentStatus === 'error' && <div className="text-danger">❌ Hata oluştu. Tekrar deneyin.</div>}
              </div>
              <div className="modal-footer">
                {paymentStatus === null && (
                  <>
                    <button onClick={processPayment} className="btn btn-primary">100 TL Öde</button>
                    <button onClick={() => setShowPayment(false)} className="btn btn-secondary">İptal</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingPage;