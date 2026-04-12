import { create } from 'zustand';
import { authAPI } from '../api/client';

export const useAuthStore = create((set) => ({
  // State
  user: localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')) : null,
  token: localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),

  // Actions
  register: async (email, username, fullName, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({
        email,
        username,
        full_name: fullName,
        password,
        password_confirmation: password,
      });
      // Login step 1: registration successful, wait for email verification
      set({ isLoading: false });
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { data } = response;

      // Store token and user info
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authAPI.logout();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return { success: true };
    } catch (error) {
      // Even if logout fails, clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return { success: true };
    }
  },

  verifyEmail: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.verifyEmail(code);
      const { data } = response;

      // User is now verified, can login
      set({ isLoading: false });
      return { success: true, data };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  resendVerification: async () => {
    set({ isLoading: true, error: null });
    try {
      await authAPI.resendVerification();
      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  getMe: async () => {
    try {
      const response = await authAPI.me();
      const { data } = response;
      localStorage.setItem('auth_user', JSON.stringify(data));
      set({ user: data });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
