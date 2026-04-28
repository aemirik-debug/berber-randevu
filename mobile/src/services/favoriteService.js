import { api } from './apiClient';

// --- Favorileri Getir ---
export async function fetchFavorites(customerId) {
  const data = await api.get(`/customers/favorites/${customerId}`);
  return Array.isArray(data) ? data : [];
}

// --- Favori Ekle ---
export async function addFavorite(customerId, { barberId, barberName, city, district, phone }) {
  return api.post(`/customers/favorites/${customerId}`, {
    barberId,
    barberName,
    city,
    district,
    phone,
  });
}

// --- Favori Sil ---
export async function removeFavorite(customerId, barberId) {
  return api.delete(`/customers/favorites/${customerId}/${barberId}`);
}
