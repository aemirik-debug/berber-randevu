import { API_BASE_URL } from '../config/api';

// Debug: log which API we're connecting to
console.log('📡 API_BASE_URL:', API_BASE_URL);

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isUnauthorized = status === 401;
  }
}

let _getToken = () => null;
let _onUnauthorized = () => {};

export function configureApiClient({ getToken, onUnauthorized }) {
  if (typeof getToken === 'function') _getToken = getToken;
  if (typeof onUnauthorized === 'function') _onUnauthorized = onUnauthorized;
}

export async function requestJson(path, options = {}) {
  const token = _getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  // Timeout: 8 saniye
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (networkError) {
    if (networkError.name === 'AbortError') {
      throw new ApiError('Bağlantı zaman aşımına uğradı.', 0, null);
    }
    throw new ApiError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.', 0, null);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = {};
  try {
    const text = await response.text();
    if (text) {
      payload = JSON.parse(text);
    }
  } catch {
    // JSON parse başarısız — boş payload ile devam et
  }

  if (!response.ok) {
    if (response.status === 401) {
      _onUnauthorized();
    }
    const message =
      payload?.message || payload?.error || `İstek başarısız: ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

// Shortcut methods
export const api = {
  get: (path, params) => {
    let url = path;
    if (params && typeof params === 'object') {
      const query = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (query) url += `?${query}`;
    }
    return requestJson(`/api${url}`, { method: 'GET' });
  },
  post: (path, body) =>
    requestJson(`/api${path}`, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) =>
    requestJson(`/api${path}`, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) =>
    requestJson(`/api${path}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) =>
    requestJson(`/api${path}`, { method: 'DELETE' }),
};
