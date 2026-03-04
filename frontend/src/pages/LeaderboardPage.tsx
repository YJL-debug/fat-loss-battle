import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

type Tab = 'fat-loss' | 'streaks' | 'combined';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { currentGroupId, user } = useAuth();
  const [tab, setTab] = useState<Tab>('fat-loss');
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentGroupId) return;
    setLoading(true);
    const fetch = tab === 'fat-loss'
      ? api.getFatLossRanking(currentGroupId)
      : tab === 'streaks'
      ? api.getStreakRanking(currentGroupId)
      : api.getCombinedRanking(currentGroupId);

    fetch.then((d) => setRankings(d.rankings)).finally(() => setLoading(false));
  }, [currentGroupId, tab]);

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">排行榜</h1>

      {/* Tab */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {[
          { key: 'fat-loss' as Tab, label: '减脂率' },
          { key: 'streaks' as Tab, label: '连续打卡' },
          { key: 'combined' as Tab, label: '综合积分' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rankings */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">加载中...</div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-10 text-gray-400">暂无数据，大家快去打卡</div>
      ) : (
        <div className="space-y-3">
          {rankings.map((r, i) => (
            <div
              key={r.userId || r.nickname}
              className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 ${
                r.userId === user?.id ? 'ring-2 ring-primary-200' : ''
              }`}
            >
              {/* 排名 */}
              <div className="text-2xl w-10 text-center">
                {i < 3 ? MEDALS[i] : <span className="text-lg text-gray-400">{i + 1}</span>}
              </div>

              {/* 头像 */}
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0">
                {r.nickname?.charAt(0)}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{r.nickname}</p>
                <p className="text-xs text-gray-400">
                  {tab === 'fat-loss' && `${r.initialWeight} → ${r.currentWeight} kg`}
                  {tab === 'streaks' && `累计 ${r.totalDays} 天`}
                  {tab === 'combined' && `减脂 ${r.lossPercent}% · 连续 ${r.streak} 天`}
                </p>
              </div>

              {/* 核心数值 */}
              <div className="text-right">
                <p className="text-lg font-bold text-primary-600">
                  {tab === 'fat-loss' && `${r.lossPercent}%`}
                  {tab === 'streaks' && `${r.streak} 天`}
                  {tab === 'combined' && `${r.score} 分`}
                </p>
                {tab === 'fat-loss' && (
                  <p className="text-xs text-gray-400">减了 {r.lossKg} kg</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
