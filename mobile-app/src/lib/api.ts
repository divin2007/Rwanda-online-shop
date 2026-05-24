import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ApiEnvelope } from '../types';
import { tokenStore } from './tokenStore';

type ServiceName =
  | 'user'
  | 'market'
  | 'product'
  | 'seller'
  | 'rider'
  | 'order'
  | 'wallet'
  | 'delivery'
  | 'notification'
  | 'review'
  | 'admin';

type RequestOptions = RequestInit & {
  auth?: boolean;
  retries?: number;
  formData?: boolean;
};

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

// Dynamically resolve the host machine IP in development (crucial for physical devices & emulators in Expo Go)
const getPackagerHost = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const ip = hostUri.split(':')[0];
  if (!ip) return null;

  // Ignore virtual network adapter subnets (WSL2/Hyper-V/Docker commonly use 172.x.x.x) and link-local (169.254.x.x)
  if (
    ip.startsWith('172.') ||
    ip.startsWith('169.254.') ||
    ip === '127.0.0.1' ||
    ip === 'localhost'
  ) {
    return null;
  }

  return `http://${ip}`;
};

const getPlatformFallbackHost = () => {
  const packager = getPackagerHost();
  if (packager) return packager;

  if (Platform.OS === 'android') {
    // Android emulator loopback to host machine
    return 'http://10.0.2.2';
  }
  // iOS simulator or Web
  return 'http://localhost';
};

const defaultHost = getPlatformFallbackHost();
const host = process.env.EXPO_PUBLIC_RMF_API_HOST || extra.rmfApiHost || defaultHost;

console.log('[RMF API Client] Resolved backend API host:', host);

const servicePorts: Record<ServiceName, number> = {
  user: 3001,
  market: 3002,
  product: 3003,
  seller: 3004,
  rider: 3005,
  order: 3006,
  wallet: 3007,
  delivery: 3008,
  notification: 3009,
  review: 3010,
  admin: 3011,
};

const serviceUrl = (service: ServiceName) => {
  const envKey = `EXPO_PUBLIC_${service.toUpperCase()}_SERVICE_URL`;
  const configured = process.env[envKey] || extra[`${service}ServiceUrl`];
  return `${configured || `${host}:${servicePorts[service]}`}/api/v1`;
};

export const socketUrl = () => process.env.EXPO_PUBLIC_DELIVERY_SOCKET_URL || extra.deliverySocketUrl || `${host}:3008`;
export const orderSocketUrl = () => process.env.EXPO_PUBLIC_ORDER_SOCKET_URL || extra.orderSocketUrl || `${host}:3006`;

class ApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const headersFrom = async (options: RequestOptions) => {
  const headers = new Headers(options.headers || {});
  if (!options.formData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.auth !== false) {
    const token = await tokenStore.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(body?.message || body?.error || `Request failed with ${response.status}`, response.status, body);
  }
  const envelope = body as ApiEnvelope<T>;
  return (envelope && Object.prototype.hasOwnProperty.call(envelope, 'data') ? envelope.data : body) as T;
};

const refreshToken = async () => {
  const refreshTokenValue = await tokenStore.getRefreshToken();
  if (!refreshTokenValue) return null;
  const response = await fetch(`${serviceUrl('user')}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
  const data = await parseResponse<{ accessToken?: string; refreshToken?: string }>(response);
  if (data.accessToken) {
    await tokenStore.setTokens(data);
    return data.accessToken;
  }
  return null;
};

export const request = async <T>(
  service: ServiceName,
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const headers = await headersFrom(options);
      const response = await fetch(`${serviceUrl(service)}${path}`, { ...options, headers });

      if (response.status === 401 && options.auth !== false) {
        const refreshed = await refreshToken();
        if (refreshed) {
          const retryHeaders = await headersFrom(options);
          const retryResponse = await fetch(`${serviceUrl(service)}${path}`, { ...options, headers: retryHeaders });
          return parseResponse<T>(retryResponse);
        }
        await tokenStore.clear();
      }

      return await parseResponse<T>(response);
    } catch (error) {
      lastError = error;
      const status = error instanceof ApiError ? error.status : undefined;
      if (status && status < 500) throw error;
      if (attempt < retries) await sleep(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed');
};

export const api = {
  get: <T>(service: ServiceName, path: string, options?: RequestOptions) =>
    request<T>(service, path, { ...options, method: 'GET' }),
  post: <T>(service: ServiceName, path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(service, path, {
      ...options,
      method: 'POST',
      body: options?.formData ? body as BodyInit : JSON.stringify(body || {}),
    }),
  put: <T>(service: ServiceName, path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(service, path, {
      ...options,
      method: 'PUT',
      body: options?.formData ? body as BodyInit : JSON.stringify(body || {}),
    }),
  patch: <T>(service: ServiceName, path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(service, path, {
      ...options,
      method: 'PATCH',
      body: options?.formData ? body as BodyInit : JSON.stringify(body || {}),
    }),
  delete: <T>(service: ServiceName, path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(service, path, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export { ApiError, serviceUrl, host };
