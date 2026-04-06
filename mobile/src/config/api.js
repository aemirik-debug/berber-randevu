import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const host = isAndroid ? '10.0.2.2' : 'localhost';

export const API_BASE_URL = `http://${host}:5001`;
