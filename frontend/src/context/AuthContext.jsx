import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/runtimeConfig';
import { clearAuthSession, expireAuthSession, getStoredUser, persistAuthSession } from '../utils/authStorage';

const AuthContext = createContext(null);
const AUTH_REQUEST_TIMEOUT_MS = 8000;

const authApi = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
    timeout: AUTH_REQUEST_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(getStoredUser());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentUrl = new URL(window.location.href);
        const isSebLaunchFlow = currentUrl.pathname.startsWith('/student/exams/')
            && currentUrl.searchParams.has('authTransfer')
            && currentUrl.searchParams.has('sebToken');

        const syncFromStorage = () => {
            setUser(getStoredUser());
        };

        const restoreSession = async () => {
            if (isSebLaunchFlow) {
                syncFromStorage();
                setLoading(false);
                return;
            }

            try {
                const response = await authApi.post('/auth/refresh');
                persistAuthSession(response.data);
            } catch (error) {
                console.warn('Session restore failed:', error.code || error.message);
                if (getStoredUser()) {
                    expireAuthSession();
                    return;
                }
                clearAuthSession();
            } finally {
                syncFromStorage();
                setLoading(false);
            }
        };

        restoreSession();
        window.addEventListener('auth-change', syncFromStorage);
        window.addEventListener('storage', syncFromStorage);

        return () => {
            window.removeEventListener('auth-change', syncFromStorage);
            window.removeEventListener('storage', syncFromStorage);
        };
    }, []);

    const login = (userData) => {
        persistAuthSession(userData);
        setUser(getStoredUser());
    };

    const logout = async () => {
        try {
            await authApi.post('/auth/logout');
        } catch (error) {
            // Clear local auth state even if the backend session is already gone.
        } finally {
            clearAuthSession();
            setUser(null);
        }
    };

    const value = useMemo(() => ({
        user,
        login,
        logout,
        loading,
    }), [user, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
