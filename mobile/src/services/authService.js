import { api } from './apiClient';

// --- Müşteri Giriş ---
export async function loginCustomer({ phone, password }) {
  return api.post('/customers/login', { phone, password });
}

// --- Müşteri Kayıt ---
export async function registerCustomer({ phone, password }) {
  return api.post('/customers/register', { phone, password });
}

// --- Profil Getir ---
export async function fetchMyProfile() {
  const payload = await api.get('/customers/me');
  return payload?.customer || null;
}

// --- Profil Güncelle ---
export async function updateProfile(customerId, data) {
  return api.put(`/customers/update/${customerId}`, data);
}

// --- Şifre Güncelle ---
export async function updatePassword(customerId, { oldPassword, newPassword }) {
  return api.put(`/customers/update-password/${customerId}`, { oldPassword, newPassword });
}
