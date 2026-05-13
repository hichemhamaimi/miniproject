const KEYS = {
    token: 'token',
    role: 'role',
    userId: 'userId',
    username: 'username',
};

const notifyAuthChange = () => {
    window.dispatchEvent(new Event('auth-change'));
};

export const redirectToLogin = () => {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.location.pathname !== '/login') {
        window.location.replace('/login');
    }
};

export const getStoredAccessToken = () => localStorage.getItem(KEYS.token) || '';

export const getStoredUser = () => {
    const token = localStorage.getItem(KEYS.token);
    const role = localStorage.getItem(KEYS.role);
    const userId = localStorage.getItem(KEYS.userId);
    const username = localStorage.getItem(KEYS.username);

    if (!token || !role || !userId) {
        return null;
    }

    return {
        token,
        role,
        userId,
        username: username || '',
    };
};

export const persistAuthSession = (userData) => {
    localStorage.setItem(KEYS.token, userData.accessToken);
    localStorage.setItem(KEYS.role, userData.role);
    localStorage.setItem(KEYS.userId, String(userData.userId));
    localStorage.setItem(KEYS.username, userData.username || '');
    notifyAuthChange();
};

export const clearAuthSession = () => {
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.role);
    localStorage.removeItem(KEYS.userId);
    localStorage.removeItem(KEYS.username);
    notifyAuthChange();
};

export const expireAuthSession = () => {
    clearAuthSession();
    redirectToLogin();
};
