import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SESSION_KEY = 'berbergo.mobile.auth.session';
const LOCATION_PREF_KEY = 'berbergo.mobile.location.preference';

// --- Auth Session ---
export async function saveAuthSession(session) {
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function getAuthSession() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}

// --- Location Preference ---
export async function saveLocationPreference(city, district) {
  await AsyncStorage.setItem(LOCATION_PREF_KEY, JSON.stringify({ city, district }));
}

export async function getLocationPreference() {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_PREF_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
