import { api } from './apiClient';

// --- Müsait Slotlar ---
export async function fetchAvailableSlots(barberId, date, masterId) {
  const payload = await api.get('/slots/available', {
    barberId,
    date,
    masterId: masterId === '__owner__' ? 'owner' : masterId,
  });
  return Array.isArray(payload?.data) ? payload.data : [];
}

// --- Slot Rezerve Et ---
export async function bookSlot(slotId, data) {
  return api.patch(`/slots/${slotId}/book`, data);
}

// --- Randevularımı Getir ---
export async function fetchMyAppointments(customerId) {
  const data = await api.get(`/customers/appointments/${customerId}`);
  return Array.isArray(data) ? data : [];
}

// --- Randevu İptal ---
export async function cancelAppointment(customerId, appointmentId) {
  return api.patch(`/customers/appointments/${customerId}/${appointmentId}/cancel`, {});
}

// --- Randevu Yeniden Planlama ---
export async function rescheduleAppointment(customerId, appointmentId, targetSlotId) {
  return api.patch(`/customers/appointments/${customerId}/${appointmentId}/reschedule`, {
    targetSlotId,
  });
}

// --- Saat Değişikliği Yanıtı (accept / reject) ---
export async function rescheduleResponse(customerId, appointmentId, decision) {
  return api.patch(`/customers/appointments/${customerId}/${appointmentId}/reschedule-response`, {
    decision,
  });
}

// --- Berbere Hatırlatma Gönder ---
export async function sendBarberReminder(slotId, { customerId, customerName }) {
  return api.post(`/slots/${slotId}/remind-barber`, { customerId, customerName });
}

// --- Faturalar ---
export async function fetchInvoices(customerId) {
  const data = await api.get(`/customers/invoices/${customerId}`);
  return Array.isArray(data) ? data : [];
}
