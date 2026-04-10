import React from 'react';

function ActionConfirmModal({
  show,
  title,
  message,
  confirmText = 'Onayla',
  cancelText = 'Kapat',
  variant = 'danger',
  confirmDisabled = false,
  showReason = false,
  reasonLabel = 'Sebep',
  reasonValue = '',
  onReasonChange,
  onConfirm,
  onClose,
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 9999 }}>
      <div className="modal-dialog modal-dialog-centered" role="document" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content border-0 rounded-4 shadow-lg">
          <div className="modal-header bg-white border-bottom py-3">
            <div>
              <h5 className="modal-title fw-bold mb-0" style={{ color: '#2c3e50' }}>{title}</h5>
              <small className="text-muted d-block mt-1">İşlemi onaylamak için devam edin veya kapatarak vazgeçin.</small>
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body p-4">
            <p className="mb-3" style={{ color: '#2c3e50' }}>{message}</p>
            {showReason && (
              <div className="mb-2">
                <label className="form-label fw-semibold small text-uppercase text-muted">{reasonLabel}</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={reasonValue}
                  onChange={(event) => onReasonChange?.(event.target.value)}
                  placeholder="Kısa bir açıklama yazın"
                />
              </div>
            )}
          </div>
          <div className="modal-footer bg-white border-top py-3">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>{cancelText}</button>
            <button type="button" className={`btn btn-${variant}`} onClick={onConfirm} disabled={confirmDisabled}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActionConfirmModal;
