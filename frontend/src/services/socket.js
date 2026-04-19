import io from 'socket.io-client';
import { API_BASE_URL } from './runtimeConfig';

let socket = null;

export const connectSocket = () => {
  if (!socket) {
    socket = io(API_BASE_URL, {
      reconnectionAttempts: 5,
      timeout: 5000,
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