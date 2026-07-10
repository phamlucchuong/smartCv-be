import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

declare const __SMART_CV_API_BASE_URL__: string | undefined;

let ACCESS_COOKIE = 'smart_cv_token';
let REFRESH_COOKIE = 'smart_cv_refresh';

export function configureCookieNames(access: string, refresh: string) {
  ACCESS_COOKIE = access;
  REFRESH_COOKIE = refresh;
}
const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const ACCESS_COOKIE_DAYS = 1;
const REFRESH_COOKIE_DAYS = 1;

function getApiBaseUrl(): string {
  if (typeof __SMART_CV_API_BASE_URL__ === 'string' && __SMART_CV_API_BASE_URL__.length > 0) {
    return __SMART_CV_API_BASE_URL__;
  }

  return DEFAULT_API_BASE_URL;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=') : null;
}

function setCookieRaw(name: string, value: string, days: number) {
  document.cookie = `${name}=${value}; Max-Age=${days * 86400}; path=/; SameSite=Lax`;
}

function removeCookieRaw(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

type SignOutHandler = () => void;
let _signOutHandler: SignOutHandler | null = null;
export function registerSignOutHandler(fn: SignOutHandler) {
  _signOutHandler = fn;
}

export const AXIOS_INSTANCE = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export function getPrefixedUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (
    url.startsWith('/user/') ||
    url.startsWith('/job/') ||
    url.startsWith('/application/') ||
    url.startsWith('/notification/') ||
    url.startsWith('/ai/')
  ) {
    return url;
  }

  if (url.startsWith('/api/jobs') || url.startsWith('/api/home')) {
    return `/job${url}`;
  }
  if (
    url.startsWith('/api/users') ||
    url.startsWith('/api/auth') ||
    url.startsWith('/api/recruiters') ||
    url.startsWith('/api/candidates') ||
    url.startsWith('/api/companies') ||
    url.startsWith('/api/wishlists') ||
    url.startsWith('/api/packages')
  ) {
    return `/user${url}`;
  }
  if (url.startsWith('/api/applications') || url.startsWith('/api/assessments') || url.startsWith('/api/attempts')) {
    return `/application${url}`;
  }
  if (url.startsWith('/api/ai') || url.startsWith('/api/recommend')) {
    return `/ai${url}`;
  }
  if (url.startsWith('/api/otp')) {
    return `/notification${url}`;
  }

  return url;
}

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getCookie(ACCESS_COOKIE);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.url) {
    config.url = getPrefixedUrl(config.url);
  }
  // Flatten request query parameters for Spring Boot compatibility
  if (config.params && typeof config.params === 'object') {
    let flattened = { ...config.params };
    if ('request' in flattened && typeof flattened.request === 'object' && flattened.request !== null) {
      const req = flattened.request;
      delete flattened.request;
      flattened = { ...flattened, ...req };
    }
    config.params = flattened;
  }
  // FormData requests need a boundary in Content-Type — let Axios set it automatically
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

AXIOS_INSTANCE.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getCookie(REFRESH_COOKIE);
    if (!refreshToken) {
      _signOutHandler?.();
      if (typeof window !== 'undefined') {
        const isRecruiter = window.location.pathname.startsWith('/employer') || window.location.port === '3001';
        window.location.href = isRecruiter ? '/login' : '/signin';
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            resolve(AXIOS_INSTANCE(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const res = await AXIOS_INSTANCE.post('/user/api/auth/refresh', { refreshToken });
      const newToken: string = res.data?.data?.token ?? res.data?.data?.accessToken;
      const newRefreshToken: string = res.data?.data?.refreshToken ?? refreshToken;
      if (!newToken) throw new Error('No token in refresh response');
      setCookieRaw(ACCESS_COOKIE, newToken, ACCESS_COOKIE_DAYS);
      if (newRefreshToken) {
        setCookieRaw(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_DAYS);
      }
      processQueue(null, newToken);
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return AXIOS_INSTANCE(original);
    } catch (err) {
      processQueue(err, null);
      removeCookieRaw(ACCESS_COOKIE);
      removeCookieRaw(REFRESH_COOKIE);
      _signOutHandler?.();
      if (typeof window !== 'undefined') {
        const isRecruiter = window.location.pathname.startsWith('/employer') || window.location.port === '3001';
        window.location.href = isRecruiter ? '/login' : '/signin';
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);
  // @ts-ignore
  promise.cancel = () => source.cancel('Query was cancelled');
  return promise;
};

export default AXIOS_INSTANCE;
