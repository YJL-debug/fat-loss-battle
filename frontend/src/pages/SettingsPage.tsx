import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import Avatar from '../components/common/Avatar';
import AvatarPicker from '../components/common/AvatarPicker';

export default function SettingsPage() {
  const { user, currentGroupId, logout, switchGroup, updateUser } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    api.getGroups().then((d) => setGroups(d.groups));
  }, []);

  const handleGenerateInvite = async () => {
    if (!currentGroupId) return;
    setGenerating(true);
    try {
      const data = await api.generateInvite(currentGroupId);
      setInviteCode(data.code);
    } catch {}
    setGenerating(false);
  };

  const handleAvatarSelect = async (emoji: string) => {
    try {
      await api.updateProfile({ avatar: emoji });
      updateUser({ avatar: emoji });
      setShowAvatarPicker(false);
    } catch {}
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-800 mb-6">设置</h1>

      {/* 个人信息 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowAvatarPicker(true)} className="relative group">
            <Avatar nickname={user?.nickname || ''} avatar={user?.avatar} size="lg" />
            <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <span className="text-white text-xs">换</span>
            </div>
          </button>
          <div>
            <p className="text-lg font-semibold text-gray-800">{user?.nickname}</p>
            <p className="text-sm text-gray-400">点击头像更换</p>
          </div>
        </div>
      </div>

      {/* 群组管理 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">我的群组</h3>
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => switchGroup(g.id)}
              className={`w-full p-3 rounded-xl text-left flex items-center justify-between ${
                currentGroupId === g.id
                  ? 'bg-primary-50 border border-primary-200'
                  : 'bg-gray-50'
              }`}
            >
              <div>
                <p className="font-medium text-gray-800">{g.name}</p>
                <p className="text-xs text-gray-400">{g.member_count} 人 · {g.role === 'admin' ? '管理员' : '成员'}</p>
              </div>
              {currentGroupId === g.id && (
                <span className="text-xs text-primary-600 font-medium">当前</span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/setup')}
          className="w-full mt-3 py-2 text-sm text-primary-600 border border-primary-200 rounded-xl"
        >
          创建/加入新群组
        </button>
      </div>

      {/* 邀请码 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">邀请小伙伴</h3>
        {inviteCode ? (
          <div className="text-center">
            <p className="text-3xl font-mono font-bold text-primary-600 tracking-widest mb-2">
              {inviteCode}
            </p>
            <p className="text-xs text-gray-400">分享此邀请码给小伙伴</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode);
              }}
              className="mt-2 text-sm text-primary-600"
            >
              复制邀请码
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateInvite}
            disabled={generating || !currentGroupId}
            className="w-full py-2 bg-primary-50 text-primary-600 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成邀请码'}
          </button>
        )}
      </div>

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-red-50 text-red-500 rounded-xl font-medium"
      >
        退出登录
      </button>

      {showAvatarPicker && (
        <AvatarPicker
          currentAvatar={user?.avatar}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </div>
  );
}
