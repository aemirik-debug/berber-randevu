import React, { useState } from 'react';

const SlotDetailsModal = ({ show, onClose, slot, onCancel, onComplete, onEdit }) => {
  const [cancelReason, setCancelReason] = useState('');
  if (!show || !slot) return null;
  
  return (
    <>
      <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content border-0 shadow rounded-4">
            <div className="modal-header bg-white border-bottom">
              <h5 className="modal-title fw-bold">👤 Randevu Detayı</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <dl className="row mb-0">
                <dt className="col-4">Müşteri</dt>
                <dd className="col-8">{slot.customer?.name || slot.customerName || 'Bilinmiyor'}</dd>
                <dt className="col-4">Telefon</dt>
                <dd className="col-8">{slot.customer?.phone || slot.customerPhone || '-'}</dd>
                <dt className="col-4">Hizmet</dt>
                <dd className="col-8">{slot.service?.name || slot.customer?.service || 'Belirtilmemiş'}</dd>
                <dt className="col-4">Tarih</dt>
                <dd className="col-8">{slot.date}</dd>
                <dt className="col-4">Saat</dt>
                <dd className="col-8">{slot.time}</dd>
                <dt className="col-4">Durum</dt>
                <dd className="col-8">
                  <span className={`badge ${
                    slot.status === 'available' ? 'bg-secondary' :
                    slot.status === 'blocked' ? 'bg-warning text-dark' :
                    slot.status === 'confirmed' ? 'bg-success' :
                    slot.status === 'cancelled' ? 'bg-danger' :
                    slot.status === 'booked' ? 'bg-info text-dark' :
                    'bg-secondary'
                  }`}>
                    {slot.status === 'available' ? 'Müsait' :
                      slot.status === 'blocked' ? 'Bloklu' :
                      slot.status === 'confirmed' ? 'Onaylandı' :
                      slot.status === 'cancelled' ? 'İptal Edildi' :
                      slot.status === 'booked' ? 'Beklemede' :
                      slot.status}
                  </span>
                </dd>
                {slot.manualPrice !== null && slot.manualPrice !== undefined && (
                  <>
                    <dt className="col-4">Fiyat</dt>
                    <dd className="col-8">{slot.manualPrice} TL</dd>
                  </>
                )}
                {slot.service?.price && !slot.manualPrice && (
                  <>
                    <dt className="col-4">Fiyat</dt>
                    <dd className="col-8">{slot.service.price} TL</dd>
                  </>
                )}
                <dt className="col-4">Ödeme</dt>
                <dd className="col-8">{slot.payment?.isPaid ? 'Evet' : 'Hayır'}</dd>
                {slot.customer?.notes && (
                  <>
                    <dt className="col-4">Not</dt>
                    <dd className="col-8">{slot.customer.notes}</dd>
                  </>
                )}
                {slot.status === 'cancelled' && slot.cancelReason && (
                  <>
                    <dt className="col-4 text-danger">İptal Sebebi</dt>
                    <dd className="col-8 text-danger">{slot.cancelReason}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className="modal-footer d-flex flex-column gap-2 align-items-stretch">
              {(slot.status === 'booked' || slot.status === 'confirmed') ? (
                <>
                  {slot.status === 'confirmed' && slot.isManualAppointment && onEdit && (
                    <button type="button" onClick={() => onEdit(slot)} className="btn btn-warning w-100">
                      ✏️ Düzenle
                    </button>
                  )}
                  {slot.status === 'booked' && (
                    <button type="button" onClick={() => onComplete(slot._id)} className="btn btn-success w-100">
                      ✅ Onayla
                    </button>
                  )}
                  <select className="form-select" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                    <option value="">İptal sebebi seçin</option>
                    <option value="Müşteri gelmedi">Müşteri gelmedi</option>
                    <option value="Berber müsait değil">Berber müsait değil</option>
                    <option value="Müşteri iptal etti">Müşteri iptal etti</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!cancelReason) {
                        alert('Lütfen iptal sebebi seçin.');
                        return;
                      }
                      onCancel(slot._id, cancelReason);
                    }}
                    className="btn btn-danger w-100"
                  >
                    ❌ İptal Et
                  </button>
                </>
              ) : null}
              <button type="button" onClick={onClose} className="btn btn-outline-secondary w-100">Kapat</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SlotDetailsModal;
