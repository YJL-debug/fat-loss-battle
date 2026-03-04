const API_BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function getGroupId(): string | null {
  return localStorage.getItem('groupId');
}

export function setGroupId(id: string) {
  localStorage.setItem('groupId', id);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('未登录');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as any).error || '请求失败');
  }
  return data as T;
}

// Auth
export const api = {
  register: (nickname: string, password: string) =>
    request<{ token: string; user: { id: string; nickname: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nickname, password }),
    }),

  registerWithInvite: (nickname: string, password: string, inviteCode: string) =>
    request<{ token: string; user: { id: string; nickname: string }; groupId: string }>('/auth/register-with-invite', {
      method: 'POST',
      body: JSON.stringify({ nickname, password, inviteCode }),
    }),

  login: (nickname: string, password: string) =>
    request<{ token: string; user: { id: string; nickname: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nickname, password }),
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  getMe: () => request<{ user: any }>('/auth/me'),

  updateProfile: (data: { avatar?: string }) =>
    request('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  // Groups
  createGroup: (name: string) =>
    request<{ group: { id: string; name: string } }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getGroups: () => request<{ groups: any[] }>('/groups'),

  getGroup: (groupId: string) =>
    request<{ group: any; members: any[]; myRole: string }>(`/groups/${groupId}`),

  generateInvite: (groupId: string) =>
    request<{ code: string }>(`/groups/${groupId}/invite`, { method: 'POST' }),

  joinGroup: (code: string) =>
    request<{ group: { id: string; name: string } }>('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Weights
  logWeight: (groupId: string, weight: number, date?: string, note?: string) =>
    request(`/groups/${groupId}/weights`, {
      method: 'POST',
      body: JSON.stringify({ weight, date, note }),
    }),

  getMyWeights: (groupId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request<{ records: any[] }>(`/groups/${groupId}/weights/mine${qs ? '?' + qs : ''}`);
  },

  getLatestWeight: (groupId: string) =>
    request<{ record: any }>(`/groups/${groupId}/weights/mine/latest`),

  getAllWeights: (groupId: string, from?: string) => {
    const qs = from ? `?from=${from}` : '';
    return request<{ members: any[] }>(`/groups/${groupId}/weights/all${qs}`);
  },

  // Leaderboard
  getFatLossRanking: (groupId: string) =>
    request<{ rankings: any[] }>(`/groups/${groupId}/leaderboard/fat-loss`),

  getStreakRanking: (groupId: string) =>
    request<{ rankings: any[] }>(`/groups/${groupId}/leaderboard/streaks`),

  getCombinedRanking: (groupId: string) =>
    request<{ rankings: any[] }>(`/groups/${groupId}/leaderboard/combined`),

  getLeaderboardComments: (groupId: string, refresh = false) =>
    request<{ comments: Array<{ user_id: string; title: string; comment: string }>; cached?: boolean }>(
      `/groups/${groupId}/leaderboard/comments${refresh ? '?refresh=true' : ''}`,
      { method: 'POST' }
    ),

  // AI
  analyzeMe: (groupId: string, refresh = false) =>
    request<{ content: string; cached?: boolean }>(`/groups/${groupId}/ai/analyze/me${refresh ? '?refresh=true' : ''}`, {
      method: 'POST',
    }),

  analyzeGroup: (groupId: string, refresh = false) =>
    request<{ content: string; cached?: boolean }>(`/groups/${groupId}/ai/analyze/group${refresh ? '?refresh=true' : ''}`, {
      method: 'POST',
    }),

  analyzeRoast: (groupId: string, refresh = false) =>
    request<{ content: string; cached?: boolean }>(`/groups/${groupId}/ai/analyze/roast${refresh ? '?refresh=true' : ''}`, {
      method: 'POST',
    }),
};
