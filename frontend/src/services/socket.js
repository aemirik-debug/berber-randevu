import io from 'socket.io-client';
import { API_BASE_URL } from './runtimeConfig';

let socket = null;

export const connectSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      // KRİTİK AYARLAR:
      transports: ['websocket', 'polling'], // Önce websocket dene, olmazsa polling yap
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10, // Deneme sayısını biraz artıralım
      reconnectionDelay: 2000,
      timeout: 10000, // Sunucusuz sistemlerde biraz daha süre tanımak iyidir
    });

    socket.on('connect_error', (err) => {
      console.error('Socket Bağlantı Hatası:', err.message);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;