import AsyncStorage from '@react-native-async-storage/async-storage';

export async function load(key, fallback) {
  try {
    const v = await AsyncStorage.getItem('adhdo.' + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  AsyncStorage.setItem('adhdo.' + key, JSON.stringify(value)).catch(() => {});
}
