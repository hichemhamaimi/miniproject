import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simple token check on mount
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const userId = localStorage.getItem('userId');
        
        if (token && role && userId) {
            setUser({ token, role, userId });
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        localStorage.setItem('token', userData.accessToken);
        localStorage.setItem('role', userData.role);
        localStorage.setItem('userId', userData.userId);
        setUser({ token: userData.accessToken, role: userData.role, userId: userData.userId });
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('userId');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
