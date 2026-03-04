import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setToken, clearToken, getGroupId, setGroupId } from '../api/client';

interface AuthState {
  user: { id: string; nickname: string } | null;
  currentGroupId: string | null;
  loading: boolean;
  login: (nickname: string, password: string) => Promise<void>;
  register: (nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchGroup: (groupId: string) => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; nickname: string } | null>(null);
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

  return (
    <AuthContext.Provider value={{ user, currentGroupId, loading, login, register, logout, switchGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
