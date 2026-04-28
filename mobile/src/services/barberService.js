import { api } from './apiClient';

// --- Tüm Berberler ---
export async function fetchBarbers() {
  const data = await api.get('/barbers');
  return Array.isArray(data) ? data : [];
}

// --- İlçeye Göre Berberler ---
export async function fetchBarbersByDistrict(city, district) {
  const data = await api.get('/barbers/byDistrict', { city, district });
  return Array.isArray(data) ? data : [];
}

// --- Şehir Listesi ---
export async function fetchCities() {
  const data = await api.get('/locations/cities');
  return Array.isArray(data) ? data : [];
}

// --- İlçe Listesi ---
export async function fetchDistricts(city) {
  const data = await api.get(`/locations/districts/${city}`);
  return Array.isArray(data) ? data : [];
}

// --- Berber Profili ---
export async function fetchBarberProfile(barberId) {
  return api.get(`/barbers/${barberId}`);
}

// --- Berber Yorum Gönder ---
export async function submitBarberReview(barberId, { customerId, customerName, rating, comment }) {
  return api.post(`/barbers/${barberId}/review`, { customerId, customerName, rating, comment });
}
