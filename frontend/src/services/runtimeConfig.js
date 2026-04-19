const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || browserOrigin || 'http://localhost:5001';
export const API_URL = `${API_BASE_URL}/api`;
