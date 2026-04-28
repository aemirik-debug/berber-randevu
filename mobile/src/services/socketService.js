import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

let socket = null;

export function connectSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('📱 Socket bağlandı:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('📱 Socket bağlantı hatası:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('📱 Socket koptu:', reason);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function emitCustomerLogin(customerId) {
  const s = connectSocket();
  s.emit('customer_login', customerId);
}

export function onAppointmentUpdate(callback) {
  const s = connectSocket();
  s.on('appointment_update', callback);
  return () => s.off('appointment_update', callback);
}
