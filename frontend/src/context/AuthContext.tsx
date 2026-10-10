import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api';
import type { UserProfile, WarehouseInfo } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  activeWarehouse: string;
  activeWarehouseInfo?: WarehouseInfo;
  currentWarehouse?: WarehouseInfo;
  loading: boolean;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => void;
  setActiveWarehouse: (whId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeWarehouse, setActiveWarehouse] = useState<string>('WH-CONT-HE');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
      if (profile.warehouses.length > 0) {
        // default to first warehouse or keep if in list
        const exists = profile.warehouses.some((w) => w.id === activeWarehouse);
        if (!exists) {
          setActiveWarehouse(profile.warehouses[0].id);
        }
      }
    } catch (err) {
      localStorage.removeItem('logisticqu_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('logisticqu_token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string = 'password123') => {
    setLoading(true);
    try {
      const data = await authApi.login(username, password);
      localStorage.setItem('logisticqu_token', data.token);
      setUser(data.user);
      if (data.user.warehouses.length > 0) {
        setActiveWarehouse(data.user.warehouses[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('logisticqu_token');
    setUser(null);
  };

  const activeWarehouseInfo = user?.warehouses.find((w) => w.id === activeWarehouse);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeWarehouse,
        activeWarehouseInfo,
        currentWarehouse: activeWarehouseInfo,
        loading,
        login,
        logout,
        setActiveWarehouse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
