import axios from 'axios';
import { getApiBaseUrl } from './runtimeConfig';
import { expireAuthSession, getStoredAccessToken, persistAuthSession } from './authStorage';

const baseURL = getApiBaseUrl();
const API_REQUEST_TIMEOUT_MS = 15000;
const AUTH_REFRESH_TIMEOUT_MS = 8000;

const axiosInstance = axios.create({
    baseURL,
    withCredentials: true,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
    },
});

const refreshClient = axios.create({
    baseURL,
    withCredentials: true,
    timeout: AUTH_REFRESH_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshPromise = null;

const shouldSkipRefresh = (config = {}) => {
    const url = config.url || '';
    return url.includes('/auth/login')
        || url.includes('/auth/refresh')
        || url.includes('/auth/logout')
        || url.includes('/auth/seb-exchange');
};

const requestRefresh = async () => {
    if (!refreshPromise) {
        refreshPromise = refreshClient.post('/auth/refresh')
            .then((response) => {
                persistAuthSession(response.data);
                return response.data;
            })
            .catch((error) => {
                expireAuthSession();
                throw error;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

axiosInstance.interceptors.request.use(
    (config) => {
        const token = getStoredAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};
        const status = error.response?.status;

        if (status === 401 && !originalRequest._retry && !shouldSkipRefresh(originalRequest)) {
            originalRequest._retry = true;
            try {
                const refreshed = await requestRefresh();
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
