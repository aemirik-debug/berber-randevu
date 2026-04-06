import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

function BookingPage() {
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  
useEffect(() => {
  const loadCities = async () => {
    const res = await api.get('/locations/cities');
    setCities(res.data);
  };
  loadCities();
}, []);

const loadDistricts = async (city) => {
  const res = await api.get(`/locations/districts/${city}`);
  setDistricts(res.data);
};
const loadBarbers = async () => {
    if (!city || !district) return;
    const res = await api.get('/barbers/byDistrict', { params: { city, district } });
    setBarbers(res.data);
};
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
          service: selectedService?.name
        });

        setPaymentStatus('success');
        setTimeout(() => {
          setShowPayment(false);
          setPaymentStatus(null);
          navigate('/customer/home');
        }, 2000);
      } catch (err) {
        console.error('Ödeme/randevu hatası', err);
        setPaymentStatus('error');
      }
    }, 3000);
  };

  return (
    <div className="container mt-4 position-relative">
      {/* Geri butonu sağ üstte mavi */}
      <button onClick={() => navigate('/customer/home')} className="btn btn-primary position-absolute top-0 end-0 m-3">
        ⬅️ Geri
      </button>

      <h2 className="mb-4">💈 Berber Seçimi</h2>

      {/* İl seçimi */}
      <div className="mb-3">
        <label className="form-label">İl Seçin</label>
        <select className="form-select" value={city} 
  onChange={e => { setCity(e.target.value); loadDistricts(e.target.value); }}>
  <option value="">İl seçin...</option>
  {cities.map(c => <option key={c} value={c}>{c}</option>)}
</select>

      </div>

      {/* İlçe seçimi */}
      {city && (
        <div className="mb-3">
          <label className="form-label">İlçe Seçin</label>
          <select className="form-select" value={district} onChange={e => setDistrict(e.target.value)}>
    <option value="">İlçe seçin...</option>
    {districts.map(d => <option key={d} value={d}>{d}</option>)}
  </select>

        </div>
      )}

      {/* Berberleri listele */}
      {district && (
        <button onClick={loadBarbers} className="btn btn-success mb-3">Berberleri Listele</button>
      )}

      <div className="row">
  {barbers.map(barber => (
    <div key={barber._id} className="col-md-4 mb-3">
      <div 
        className={`card ${selectedBarber?._id === barber._id ? 'border-primary' : ''}`} 
        onClick={() => setSelectedBarber(barber)}
      >
        <div className="card-body">
          <h5 className="card-title">{barber.name}</h5>
          <p className="card-text">{barber.address}</p>
        </div>
      </div>
    </div>
  ))}
</div>


      {/* Randevu tarihi ve slot seçimi */}
      {selectedBarber && (
        <div className="mt-4">
          <h3>{selectedBarber.name} için randevu al</h3>
          {/* hizmet seçimi */}
          <div className="mb-3">
            <label className="form-label">Hizmet Seçin</label>
            <select className="form-select" value={selectedService?._id || ''} onChange={e => {
                const svc = selectedBarber.services.find(s => s._id === e.target.value);
                setSelectedService(svc || null);
              }}>
              <option value="">Hizmet seçin...</option>
              {selectedBarber.services?.map(svc => (
                <option key={svc._id} value={svc._id}>{svc.name} - ₺{svc.price}</option>
              ))}
            </select>
          </div>

          <input type="date" min={today} value={selectedDate} onChange={async e => {
              setSelectedDate(e.target.value);
              setSelectedSlot(null);
              if (e.target.value) {
                try {
                  const res = await api.get('/slots/available', { params: { barberId: selectedBarber._id, date: e.target.value } });
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
            }} className="form-control w-25 my-3" />

          {/* Saat seçim */}
          {availableSlots.length > 0 && (
            <div className="mb-3">
              <label className="form-label">Saat Seçin</label>
              <div className="d-flex flex-wrap gap-2">
                {availableSlots.map(slot => (
                  <button
                    key={slot._id}
                    className={`btn btn-sm ${selectedSlot === slot ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-outline-primary" onClick={() => setShowPayment(true)} disabled={!selectedService || !selectedSlot}>
            Randevu Al
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