const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const inferApiBaseUrl = () => {
    const envValue = import.meta.env.VITE_API_URL;
    if (envValue) {
        return trimTrailingSlash(envValue);
    }

    if (typeof window === 'undefined') {
        return 'http://localhost:3500';
    }

    const apiPort = import.meta.env.VITE_API_PORT || '3500';
    return `${window.location.protocol}//${window.location.hostname}:${apiPort}`;
};

export const getApiBaseUrl = () => inferApiBaseUrl();

export const buildApiUrl = (path = '') => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
};

export const getSocketUrl = () => getApiBaseUrl();
