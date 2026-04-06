import React, { useState } from 'react';
import './SlotDetailsModal.css';

const SlotDetailsModal = ({ show, onClose, slot, onCancel, onComplete, onEdit }) => {
  const [cancelReason, setCancelReason] = useState('');
  if (!show || !slot) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>👤 Randevu Detayı</h3>
        <p><strong>Müşteri:</strong> {slot.customer?.name || slot.customerName || 'Bilinmiyor'}</p>
        <p><strong>Telefon:</strong> {slot.customer?.phone || slot.customerPhone || '-'}</p>
        <p><strong>Hizmet:</strong> {slot.service?.name || slot.customer?.service || 'Belirtilmemiş'}</p>
        <p><strong>Tarih:</strong> {slot.date}</p>
        <p><strong>Saat:</strong> {slot.time}</p>
        <p><strong>Durum:</strong> <span className={`badge ${
          slot.status === 'available' ? 'bg-secondary' :
          slot.status === 'blocked' ? 'bg-warning' :
          slot.status === 'confirmed' ? 'bg-success' :
          slot.status === 'cancelled' ? 'bg-danger' :
          slot.status === 'booked' ? 'bg-info' :
          'bg-secondary'
        }`}>{
          slot.status === 'available' ? 'Müsait' :
          slot.status === 'blocked' ? 'Bloklu' :
          slot.status === 'confirmed' ? 'Onaylandı' :
          slot.status === 'cancelled' ? 'İptal Edildi' :
          slot.status === 'booked' ? 'Beklemede' :
          slot.status
        }</span></p>
        {slot.manualPrice !== null && slot.manualPrice !== undefined && (
          <p><strong>Fiyat:</strong> {slot.manualPrice} TL</p>
        )}
        {slot.service?.price && !slot.manualPrice && (
          <p><strong>Fiyat:</strong> {slot.service.price} TL</p>
        )}
        <p><strong>Ödeme Alındı mı:</strong> {slot.payment?.isPaid ? 'Evet ✅' : 'Hayır ❌'}</p>
        {slot.customer?.notes && <p><strong>Not:</strong> {slot.customer.notes}</p>}
        {slot.status === 'cancelled' && slot.cancelReason && (
          <p className="text-danger"><strong>İptal Sebebi:</strong> {slot.cancelReason}</p>
        )}

        {(slot.status === 'booked' || slot.status === 'confirmed') && (
          <div className="modal-actions">
            {slot.status === 'confirmed' && slot.isManualAppointment && onEdit && (
              <button 
                onClick={() => onEdit(slot)}
                className="complete-btn"
                style={{backgroundColor: '#f39c12'}}
              >
                ✏️ Düzenle
              </button>
            )}
            
            {slot.status === 'booked' && (
              <button 
                onClick={() => onComplete(slot._id)}
                className="complete-btn"
              >
                ✅ Onayla
              </button>
            )}

            <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
              <option value="">İptal sebebi seçin</option>
              <option value="Müşteri gelmedi">Müşteri gelmedi</option>
              <option value="Berber müsait değil">Berber müsait değil</option>
              <option value="Müşteri iptal etti">Müşteri iptal etti</option>
              <option value="Diğer">Diğer</option>
            </select>

            <button 
              onClick={() => {
                if (!cancelReason) {
                  alert("Lütfen iptal sebebi seçin.");
                  return;
                }
                onCancel(slot._id, cancelReason);
              }}
              className="cancel-btn"
            >
              ❌ İptal Et
            </button>

            <button onClick={onClose} className="close-btn">Kapat</button>
          </div>
        )}
        {slot.status !== 'booked' && slot.status !== 'confirmed' && (
          <div className="modal-actions">
            <button onClick={onClose} className="close-btn">Kapat</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlotDetailsModal;
