import React, { useState, useEffect } from 'react';
import api from '../services/api';

function CreateManualSlotModal({ show, slot, services, onClose, onSuccess }) {
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && services.length > 0) {
      setServiceId(services[0]._id);
    }
  }, [show, services]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Müşteri adı gereklidir');
      return;
    }

    if (!serviceId) {
      setError('Hizmet seçiniz');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/slots/create-manual', {
        date: slot.date,
        time: slot.time,
        customerName: customerName.trim(),
        serviceId,
        price: price ? parseFloat(price) : null
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
      });

      // Form sıfırla
      setCustomerName('');
      setServiceId(services.length > 0 ? services[0]._id : '');
      setPrice('');

      // Success callback
      if (onSuccess) {
        onSuccess(res.data.data);
      }

      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Randevu oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const selectedService = services.find(s => s._id === serviceId);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 rounded-4 shadow-lg">
          {/* Header */}
          <div className="modal-header bg-white border-bottom py-3">
            <div>
              <h5 className="modal-title fw-bold" style={{color: '#2c3e50'}}>
                <span className="me-2">➕</span>Randevu Oluştur
              </h5>
              <small className="text-muted d-block mt-1">
                {slot?.date && slot?.time ? `${slot.date} - ${slot.time}` : 'Seçili saat'}
              </small>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
                <span className="me-2">❌</span>{error}
                <button type="button" className="btn-close" onClick={() => setError('')}></button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Müşteri Adı */}
              <div className="mb-4">
                <label className="form-label fw-semibold small text-uppercase text-muted">
                  <span className="text-danger">*</span> Müşteri Adı
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <span style={{color: '#3498db'}}>👤</span>
                  </span>
                  <input 
                    type="text" 
                    className="form-control border-start-0 ps-0" 
                    placeholder="Müşteri adını giriniz"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <small className="text-muted">Müşteri kimliği bilmiyorsanız bu alana adını yazabilirsiniz</small>
              </div>

              {/* Hizmet Seçimi */}
              <div className="mb-4">
                <label className="form-label fw-semibold small text-uppercase text-muted">
                  <span className="text-danger">*</span> Hizmet
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <span style={{color: '#3498db'}}>✂️</span>
                  </span>
                  <select 
                    className="form-select border-start-0 ps-0"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    disabled={loading || services.length === 0}
                  >
                    <option value="">Hizmet Seçiniz</option>
                    {services.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.name} - ₺{s.price} ({s.duration}dk)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fiyat (Opsiyonel) */}
              <div className="mb-4">
                <label className="form-label fw-semibold small text-uppercase text-muted">
                  Fiyat (Opsiyonel)
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <span style={{color: '#27ae60'}}>💰</span>
                  </span>
                  <input 
                    type="number" 
                    className="form-control border-start-0 ps-0" 
                    placeholder={selectedService ? selectedService.price : '0'}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={loading}
                    step="0.01"
                    min="0"
                  />
                  <span className="input-group-text bg-light border-start-0">₺</span>
                </div>
                <small className="text-muted d-block mt-2">
                  {price ? (
                    <>Girilmiş fiyat: <strong>₺{parseFloat(price).toFixed(2)}</strong></>
                  ) : (
                    <>Seçili hizmetin fiyatı: <strong>₺{selectedService?.price || 0}</strong></>
                  )}
                </small>
              </div>

              {/* Bilgilendirme */}
              <div className="alert alert-info border rounded-3 mb-4" style={{backgroundColor: '#d1ecf1', borderColor: '#bee5eb'}}>
                <small style={{color: '#0c5460'}}>
                  <span className="me-2">💡</span>
                  <strong>İpucu:</strong> Fiyat alanını yazmazsanız, seçili hizmetin varsayılan fiyatı kullanılır. 
                  Randevu oluşturduktan sonra fiyatı istediğiniz zaman değiştirebilirsiniz.
                </small>
              </div>

              {/* Buttons */}
              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-grow-1 rounded-3 fw-semibold"
                  disabled={loading || !customerName.trim() || !serviceId}
                  style={{backgroundColor: '#3498db', borderColor: '#3498db'}}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <span className="me-2">✓</span>
                      Randevuyu Oluştur
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary rounded-3 fw-semibold px-4"
                  onClick={onClose}
                  disabled={loading}
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateManualSlotModal;
