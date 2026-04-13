import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

let socket = null;

export const connectSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
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