import React, { useState, useEffect } from 'react';
import api from '../services/api';

function EditSlotModal({ show, slot, services, onClose, onSuccess }) {
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && slot) {
      setCustomerName(slot.customer?.name || slot.customerName || '');
      setServiceId(slot.service?._id || '');
      setPrice(slot.manualPrice !== null && slot.manualPrice !== undefined ? slot.manualPrice : '');
    }
  }, [show, slot]);

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
      const res = await api.patch(`/slots/${slot._id}/edit`, {
        customerName: customerName.trim(),
        serviceId,
        price: price ? parseFloat(price) : null
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('barberToken')}` }
      });

      // Success callback
      if (onSuccess) {
        onSuccess(res.data.slot);
      }

      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Randevu güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!show) return null;

  const selectedService = services.find(s => s._id === serviceId);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }} onClick={handleClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 rounded-4 shadow-lg">
          {/* Header */}
          <div className="modal-header bg-white border-bottom py-3">
            <div>
              <h5 className="modal-title fw-bold" style={{color: '#2c3e50'}}>
                <span className="me-2">✏️</span>Randevu Düzenle
              </h5>
              <small className="text-muted d-block mt-1">
                {slot?.date && slot?.time ? `${slot.date} - ${slot.time}` : 'Seçili randevu'}
              </small>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={handleClose}
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
              <div className="alert alert-warning border rounded-3 mb-4" style={{backgroundColor: '#fff3cd', borderColor: '#ffc107'}}>
                <small style={{color: '#856404'}}>
                  <span className="me-2">⚠️</span>
                  <strong>Dikkat:</strong> Randevu bilgilerini güncelledikten sonra müşteriyi bilgilendirmeyi unutmayın.
                </small>
              </div>

              {/* Footer */}
              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-fill py-2 fw-semibold"
                  disabled={loading}
                  style={{backgroundColor: '#3498db', border: 'none'}}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Güncelleniyor...
                    </>
                  ) : (
                    <>
                      <span className="me-2">💾</span>Güncelle
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary px-4 py-2 fw-semibold"
                  onClick={handleClose}
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

export default EditSlotModal;
