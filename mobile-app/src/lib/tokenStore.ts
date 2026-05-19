import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type TokenPair = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

const ACCESS_KEY = 'rmf.accessToken';
const REFRESH_KEY = 'rmf.refreshToken';
const memoryStore: Record<string, string | null> = {};

const canUseSecureStore = Platform.OS !== 'web';

const setItem = async (key: string, value?: string | null) => {
  if (!value) {
    if (canUseSecureStore) await SecureStore.deleteItemAsync(key);
    memoryStore[key] = null;
    return;
  }

  if (canUseSecureStore) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  memoryStore[key] = value;
};

const getItem = async (key: string) => {
  if (canUseSecureStore) {
    const value = await SecureStore.getItemAsync(key);
    memoryStore[key] = value;
    return value;
  }
  return memoryStore[key] || null;
};

export const tokenStore = {
  async getAccessToken() {
    return getItem(ACCESS_KEY);
  },
  async getRefreshToken() {
    return getItem(REFRESH_KEY);
  },
  async setTokens(tokens: TokenPair) {
    await setItem(ACCESS_KEY, tokens.accessToken);
    await setItem(REFRESH_KEY, tokens.refreshToken);
  },
  async clear() {
    await setItem(ACCESS_KEY, null);
    await setItem(REFRESH_KEY, null);
  },
};

