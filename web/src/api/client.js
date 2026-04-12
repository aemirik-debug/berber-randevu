import axios from 'axios';

// API base URL - Backend API endpoint
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (code) => api.post('/auth/verify-email', { code }),
  resendVerification: () => api.post('/auth/resend-verification'),
};

// Posts endpoints
export const postsAPI = {
  list: (params) => api.get('/posts', { params }),
  get: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post('/posts', data),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  uploadMedia: (postId, formData) => 
    api.post(`/posts/${postId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Boost endpoints
export const boostsAPI = {
  list: () => api.get('/boosts'),
  get: (id) => api.get(`/boosts/${id}`),
  create: (data) => api.post('/boosts', data),
  cancel: (id) => api.post(`/boosts/${id}/cancel`),
  extend: (id, data) => api.post(`/boosts/${id}/extend`, data),
  metrics: (id) => api.get(`/boosts/${id}/metrics`),
};

// Lead tracking endpoints
export const leadsAPI = {
  list: () => api.get('/leads'),
  trackWhatsApp: (id) => api.post(`/leads/${id}/track-whatsapp`),
  trackPhoneView: (id) => api.post(`/leads/${id}/track-phone-view`),
  markConverted: (id) => api.post(`/leads/${id}/mark-converted`),
  funnel: (id) => api.get(`/leads/${id}/funnel`),
  statistics: () => api.get('/leads/statistics'),
};

// Offer endpoints
export const offersAPI = {
  list: () => api.get('/offers'),
  create: (data) => api.post('/offers', data),
  update: (id, data) => api.put(`/offers/${id}`, data),
  trackView: (id) => api.post(`/offers/${id}/track-view`),
  metrics: (id) => api.get(`/offers/${id}/metrics`),
  statistics: () => api.get('/offers/statistics'),
  trends: () => api.get('/offers/trends/views'),
};

// Payment endpoints
export const paymentsAPI = {
  history: () => api.get('/payments'),
  get: (id) => api.get(`/payments/${id}`),
  subscribe: (data) => api.post('/payments/subscribe', data),
  confirmPayment: (id) => api.post(`/payments/${id}/confirm`),
  plans: () => api.get('/payments/plans'),
  boostPayment: (data) => api.post('/payments/boost', data),
  boostPricing: () => api.get('/payments/boost-pricing'),
};

// Subscriptions endpoints
export const subscriptionsAPI = {
  list: () => api.get('/subscriptions'),
  purchase: (data) => api.post('/subscriptions/purchase', data),
};

// Admin analytics endpoints
export const analyticsAPI = {
  dashboard: () => api.get('/admin/analytics/dashboard'),
  topProfessionals: () => api.get('/admin/analytics/top-professionals'),
  topPosts: () => api.get('/admin/analytics/top-posts'),
  revenue: () => api.get('/admin/analytics/revenue'),
};

export default api;
