import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const defaultHost = isAndroid ? '10.0.2.2' : 'localhost';
const host = process.env.EXPO_PUBLIC_API_HOST || defaultHost;
const port = process.env.EXPO_PUBLIC_API_PORT || '5001';

const PRODUCTION_URL = 'https://berbergo-servis-91248109536.europe-west3.run.app';

// Öncelik: EXPO_PUBLIC_API_URL > host+port > production fallback
const localUrl = `http://${host}:${port}`;
const hasLocalConfig = process.env.EXPO_PUBLIC_API_HOST || process.env.EXPO_PUBLIC_API_PORT;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (hasLocalConfig ? localUrl : PRODUCTION_URL);
export const API_URL = `${API_BASE_URL}/api`;
