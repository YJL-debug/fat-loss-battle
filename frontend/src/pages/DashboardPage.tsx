import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { user, currentGroupId, switchGroup } = useAuth();
  const navigate = useNavigate();
  const [weight, setWeight] = useState('');
  const [latestRecord, setLatestRecord] = useState<any>(null);
  const [recentData, setRecentData] = useState<any[]>([]);
  const [group, setGroup] = useState<any>(null);
  const [streak, setStreakInfo] = useState<any>(null);
  const [logging, setLogging] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!currentGroupId) {
      // 检查是否有群组
      api.getGroups().then((data) => {
        if (data.groups.length > 0) {
          switchGroup(data.groups[0].id);
        } else {
          navigate('/setup');
        }
      });
      return;
    }
    loadData();
  }, [currentGroupId]);

  const loadData = async () => {
    if (!currentGroupId) return;
    try {
      const [groupData, latestData, weightsData, streakData] = await Promise.all([
        api.getGroup(currentGroupId),
        api.getLatestWeight(currentGroupId),
        api.getMyWeights(currentGroupId, getDateDaysAgo(7)),
        api.getStreakRanking(currentGroupId),
      ]);
      setGroup(groupData.group);
      setLatestRecord(latestData.record);
      setRecentData(weightsData.records.map((r: any) => ({
        date: r.recorded_date.slice(5),
        weight: r.weight,
      })));
      // 找到当前用户的streak
      const myStreak = streakData.rankings.find((r: any) => r.userId === user?.id);
      setStreakInfo(myStreak);
    } catch {}
  };

  const handleLog = async () => {
    if (!weight || !currentGroupId) return;
    setLogging(true);
    setMessage('');
    try {
      await api.logWeight(currentGroupId, parseFloat(weight));
      setMessage('打卡成功！');
      setWeight('');
      loadData();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLogging(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = latestRecord?.recorded_date === today;
  const weightDelta = latestRecord && recentData.length >= 2
    ? (latestRecord.weight - recentData[recentData.length - 2]?.weight).toFixed(1)
    : null;

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {group?.name || '减脂大作战'}
          </h1>
          <p className="text-sm text-gray-500">
            你好，{user?.nickname}
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* 当前体重展示 */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">当前体重</p>
          <div className="text-4xl font-bold text-gray-800">
            {latestRecord ? `${latestRecord.weight}` : '--'}
            <span className="text-lg text-gray-400 ml-1">kg</span>
          </div>
          {weightDelta && (
            <p className={`text-sm mt-1 ${parseFloat(weightDelta) <= 0 ? 'text-green-500' : 'text-red-400'}`}>
              {parseFloat(weightDelta) <= 0 ? '↓' : '↑'} {Math.abs(parseFloat(weightDelta))} kg 较昨日
            </p>
          )}
        </div>

        {/* 连续打卡 */}
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-gray-50">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{streak?.streak || 0}</p>
            <p className="text-xs text-gray-400">连续打卡</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{streak?.totalDays || 0}</p>
            <p className="text-xs text-gray-400">总打卡天数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-500">{loggedToday ? '✓' : '○'}</p>
            <p className="text-xs text-gray-400">今日打卡</p>
          </div>
        </div>
      </div>

      {/* 快速记录 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {loggedToday ? '更新今日体重' : '记录今日体重'}
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition text-lg"
            placeholder="输入体重 (kg)"
          />
          <button
            onClick={handleLog}
            disabled={logging || !weight}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {logging ? '...' : '打卡'}
          </button>
        </div>
        {message && (
          <p className={`text-sm mt-2 ${message.includes('成功') ? 'text-green-500' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </div>

      {/* 迷你趋势图 */}
      {recentData.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">近7天趋势</h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={recentData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
              <Tooltip
                formatter={(value: number) => [`${value} kg`, '体重']}
                contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 3, fill: '#16a34a' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
