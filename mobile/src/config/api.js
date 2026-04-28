import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const defaultHost = isAndroid ? '10.0.2.2' : 'localhost';
const host = process.env.EXPO_PUBLIC_API_HOST || defaultHost;
const port = process.env.EXPO_PUBLIC_API_PORT || '5001';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${host}:${port}`;
