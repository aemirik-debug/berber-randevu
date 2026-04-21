// Tarayıcı adresine bakarak hangi ortamda olduğumuzu anlıyoruz
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

// Yereldeysek localhost, canlıdaysak Cloud Run linkini kullan
export const API_BASE_URL = isLocalhost 
  ? 'http://localhost:5001' // Kendi bilgisayarındaki backend portu (8080 veya 5001 neyse)
  : 'https://berbergo-servis-91248109536.europe-west3.run.app';

export const API_URL = `${API_BASE_URL}/api`;