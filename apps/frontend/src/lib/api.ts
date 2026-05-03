import axios from 'axios';

// Ensure this runs client-side mostly, or provide server-side token access if needed
const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
};

const refreshAccessToken = async () => {
  // In a real app, this should call the refresh token endpoint and store the new token
  // Since refresh tokens are typically HTTP-only cookies, the browser sends them automatically.
  // Example: await axios.post(`${process.env.NEXT_PUBLIC_USER_SERVICE_URL}/auth/refresh`, {}, { withCredentials: true });
  // and then extract the new access token.
  return null;
};

const createClient = (baseURL: string) => {
  const client = axios.create({ baseURL });
  
  // Request interceptor: attach JWT
  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  
  // Response interceptor: handle 401, refresh token, retry
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${process.env.NEXT_PUBLIC_USER_SERVICE_URL}/auth/refresh`, {}, { withCredentials: true });
          if (res.data?.data?.accessToken) {
            localStorage.setItem('accessToken', res.data.data.accessToken);
            error.config.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
            return client(error.config);
          }
        } catch (refreshError) {
          // Refresh failed, clear token and logout
          localStorage.removeItem('accessToken');
          if (typeof window !== 'undefined') {
             window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
  
  return client;
};

export const userApi = createClient(process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:3001');
export const marketApi = createClient(process.env.NEXT_PUBLIC_MARKET_SERVICE_URL || 'http://localhost:3002');
export const productApi = createClient(process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL || 'http://localhost:3003');
export const sellerApi = createClient(process.env.NEXT_PUBLIC_SELLER_SERVICE_URL || 'http://localhost:3004');
export const riderApi = createClient(process.env.NEXT_PUBLIC_RIDER_SERVICE_URL || 'http://localhost:3005');
export const orderApi = createClient(process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || 'http://localhost:3006');
export const walletApi = createClient(process.env.NEXT_PUBLIC_WALLET_SERVICE_URL || 'http://localhost:3007');
export const deliveryApi = createClient(process.env.NEXT_PUBLIC_DELIVERY_SERVICE_URL || 'http://localhost:3008');
export const notificationApi = createClient(process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || 'http://localhost:3009');
export const reviewApi = createClient(process.env.NEXT_PUBLIC_REVIEW_SERVICE_URL || 'http://localhost:3010');
export const adminApi = createClient(process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL || 'http://localhost:3011');
