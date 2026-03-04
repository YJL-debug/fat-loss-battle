import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setToken, clearToken, getGroupId, setGroupId } from '../api/client';

interface User {
  id: string;
  nickname: string;
  avatar?: string | null;
}

interface AuthState {
  user: User | null;
  currentGroupId: string | null;
  loading: boolean;
  login: (nickname: string, password: string) => Promise<void>;
  register: (nickname: string, password: string) => Promise<void>;
  registerWithInvite: (nickname: string, password: string, inviteCode: string) => Promise<void>;
  logout: () => Promise<void>;
  switchGroup: (groupId: string) => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(getGroupId());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (nickname: string, password: string) => {
    const data = await api.login(nickname, password);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (nickname: string, password: string) => {
    const data = await api.register(nickname, password);
    setToken(data.token);
    setUser(data.user);
  };

  const registerWithInvite = async (nickname: string, password: string, inviteCode: string) => {
    const data = await api.registerWithInvite(nickname, password, inviteCode);
    setToken(data.token);
    setUser(data.user);
    setGroupId(data.groupId);
    setCurrentGroupId(data.groupId);
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    clearToken();
    setUser(null);
    setCurrentGroupId(null);
  };

  const switchGroup = (groupId: string) => {
    setGroupId(groupId);
    setCurrentGroupId(groupId);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, currentGroupId, loading, login, register, registerWithInvite, logout, switchGroup, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
