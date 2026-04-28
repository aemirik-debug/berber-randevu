import { API_BASE_URL } from '../config/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isUnauthorized = status === 401;
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Istek basarisiz: ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload;
}

function buildAuthHeaders(token, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

export async function loginCustomer({ phone, password }) {
  return requestJson('/api/customers/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone, password }),
  });
}

export async function fetchMyProfile(token) {
  const payload = await requestJson('/api/customers/me', {
    headers: buildAuthHeaders(token),
  });

  return payload?.customer || null;
}

export async function fetchMyAppointments({ token, customerId }) {
  const payload = await requestJson(`/api/customers/appointments/${customerId}`, {
    headers: buildAuthHeaders(token),
  });

  return Array.isArray(payload) ? payload : [];
}

export async function fetchLiveDashboard(token) {
  const [health, barbers] = await Promise.all([
    requestJson('/', {
      headers: buildAuthHeaders(token),
    }),
    requestJson('/api/barbers', {
      headers: buildAuthHeaders(token),
    }),
  ]);

  const barberList = Array.isArray(barbers) ? barbers : [];
  const onlineBarbers = barberList.filter((barber) => {
    const status = String(barber?.status || '').toLowerCase();
    return status === 'online' || status === 'busy';
  }).length;

  return {
    apiMessage: health?.message || 'API ayakta',
    totalBarbers: barberList.length,
    onlineBarbers,
  };
}
