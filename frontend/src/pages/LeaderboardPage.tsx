import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import Avatar from '../components/common/Avatar';

type Tab = 'fat-loss' | 'streaks' | 'combined';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { currentGroupId, user } = useAuth();
  const [tab, setTab] = useState<Tab>('fat-loss');
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, { title: string; comment: string }>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

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

  // 自动加载评语缓存
  useEffect(() => {
    if (!currentGroupId) return;
    api.getLeaderboardComments(currentGroupId).then((d) => {
      const map: Record<string, { title: string; comment: string }> = {};
      for (const c of d.comments) {
        map[c.user_id] = { title: c.title, comment: c.comment };
      }
      setComments(map);
    }).catch(() => {});
  }, [currentGroupId]);

  const generateComments = async (refresh = false) => {
    if (!currentGroupId) return;
    setCommentsLoading(true);
    try {
      const d = await api.getLeaderboardComments(currentGroupId, refresh);
      const map: Record<string, { title: string; comment: string }> = {};
      for (const c of d.comments) {
        map[c.user_id] = { title: c.title, comment: c.comment };
      }
      setComments(map);
    } catch {}
    setCommentsLoading(false);
  };

  const hasComments = Object.keys(comments).length > 0;

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">排行榜</h1>
        <button
          onClick={() => generateComments(!hasComments ? false : true)}
          disabled={commentsLoading}
          className="text-xs px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg font-medium disabled:opacity-50"
        >
          {commentsLoading ? '生成中...' : hasComments ? '刷新评语' : '生成评语 ✨'}
        </button>
      </div>

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
              <Avatar nickname={r.nickname} avatar={r.avatar} />

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{r.nickname}</p>
                {comments[r.userId] ? (
                  <>
                    <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full">
                      {comments[r.userId].title}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{comments[r.userId].comment}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">
                    {tab === 'fat-loss' && `${r.initialWeight} → ${r.currentWeight} kg`}
                    {tab === 'streaks' && `累计 ${r.totalDays} 天`}
                    {tab === 'combined' && `减脂 ${r.lossPercent}% · 连续 ${r.streak} 天`}
                  </p>
                )}
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
