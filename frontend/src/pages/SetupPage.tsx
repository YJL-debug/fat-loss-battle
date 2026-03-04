import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

export default function SetupPage() {
  const { switchGroup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.createGroup(groupName);
      switchGroup(data.group.id);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.joinGroup(inviteCode);
      switchGroup(data.group.id);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-100 p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="text-2xl font-bold text-gray-800">注册成功！</h1>
            <p className="text-gray-500 mt-1">选择你的开始方式</p>
          </div>

          <button
            onClick={() => setMode('create')}
            className="w-full p-5 bg-white rounded-2xl shadow-md text-left hover:shadow-lg transition"
          >
            <div className="text-lg font-semibold text-gray-800">创建群组</div>
            <div className="text-sm text-gray-500 mt-1">创建一个新群组，邀请小伙伴加入</div>
          </button>

          <button
            onClick={() => setMode('join')}
            className="w-full p-5 bg-white rounded-2xl shadow-md text-left hover:shadow-lg transition"
          >
            <div className="text-lg font-semibold text-gray-800">加入群组</div>
            <div className="text-sm text-gray-500 mt-1">输入邀请码加入已有的群组</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-100 p-4">
      <div className="w-full max-w-sm">
        <button onClick={() => setMode('choose')} className="text-primary-600 mb-4 text-sm">
          ← 返回
        </button>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">创建群组</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">群组名称</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                placeholder="例如：减脂冲鸭战队"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {loading ? '创建中...' : '创建群组'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">加入群组</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邀请码</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition text-center text-lg tracking-widest"
                placeholder="输入8位邀请码"
                maxLength={8}
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {loading ? '加入中...' : '加入群组'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
