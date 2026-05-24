'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

interface UseApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
}

export function useApi<T = any>(
  apiInstance: AxiosInstance,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  options?: AxiosRequestConfig & { refreshInterval?: number }
): UseApiResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<T | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const execute = useCallback(
    async (dynamicData?: any, dynamicConfig?: AxiosRequestConfig) => {
      // Only set loading to true on first load to prevent flickering during polling
      if (!dataRef.current) setLoading(true);
      setError(null);
      try {
        const config = { ...options, ...dynamicConfig };
        let response: AxiosResponse;

        if (method === 'get' || method === 'delete') {
          response = await apiInstance[method](url, config);
        } else {
          response = await apiInstance[method](url, dynamicData, config);
        }

        if (response.data && response.data.success) {
          setData(response.data.data);
          return response.data.data;
        } else if (response.data) {
          setError(response.data.error || 'An unknown error occurred');
          return null;
        } else {
          setData(response.data as any);
          return response.data as any;
        }
      } catch (err) {
        let errorMessage = 'An error occurred while fetching data';
        if (err instanceof AxiosError && err.response) {
            errorMessage = err.response.data?.error || err.response.data?.message || err.message;
        } else if (err instanceof Error) {
            errorMessage = err.message;
        }
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiInstance, method, url] // Removed options and data to prevent infinite loops
  );

  useEffect(() => {
    if (url && options?.refreshInterval && method === 'get') {
      const interval = setInterval(() => {
        execute();
      }, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [execute, options?.refreshInterval, method, url]);

  // Auto-execute on mount for GET requests
  useEffect(() => {
    if (method === 'get' && url) {
      execute();
    }
  }, [execute, method, url]);

  return { data, loading, error, execute };
}
