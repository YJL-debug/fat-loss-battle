import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

type Period = '7' | '30' | '90';

export default function ChartsPage() {
  const { currentGroupId } = useAuth();
  const [tab, setTab] = useState<'mine' | 'group'>('mine');
  const [period, setPeriod] = useState<Period>('30');
  const [myData, setMyData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [showPercent, setShowPercent] = useState(true);

  useEffect(() => {
    if (!currentGroupId) return;
    const from = getDateDaysAgo(parseInt(period));
    if (tab === 'mine') {
      api.getMyWeights(currentGroupId, from).then((d) => {
        setMyData(d.records.map((r: any) => ({
          date: r.recorded_date.slice(5),
          weight: r.weight,
        })));
      });
    } else {
      api.getAllWeights(currentGroupId, from).then((d) => {
        setGroupData(d.members);
      });
    }
  }, [currentGroupId, tab, period]);

  // 为群组对比图构造数据
  const groupChartData = (() => {
    if (!groupData.length) return [];
    const allDates = new Set<string>();
    groupData.forEach((m) => m.data.forEach((d: any) => allDates.add(d.date)));
    const dates = Array.from(allDates).sort();

    return dates.map((date) => {
      const point: any = { date: date.slice(5) };
      groupData.forEach((m) => {
        const record = m.data.find((d: any) => d.date === date);
        if (record) {
          if (showPercent && m.data.length > 0) {
            const first = m.data[0].weight;
            point[m.nickname] = +(((record.weight - first) / first) * 100).toFixed(2);
          } else {
            point[m.nickname] = record.weight;
          }
        }
      });
      return point;
    });
  })();

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">数据图表</h1>

      {/* Tab 切换 */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {[
          { key: 'mine' as const, label: '我的趋势' },
          { key: 'group' as const, label: '全员对比' },
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

      {/* 时间范围 */}
      <div className="flex gap-2 mb-4">
        {(['7', '30', '90'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm ${
              period === p ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {p}天
          </button>
        ))}
      </div>

      {/* 图表 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        {tab === 'mine' ? (
          myData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={myData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${value} kg`, '体重']}
                  contentStyle={{ borderRadius: '12px' }}
                />
                <Line type="monotone" dataKey="weight" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 py-10">暂无数据，快去打卡吧</p>
          )
        ) : (
          <>
            {groupData.length > 1 && (
              <div className="flex items-center justify-end mb-2">
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={showPercent}
                    onChange={(e) => setShowPercent(e.target.checked)}
                    className="rounded"
                  />
                  显示百分比
                </label>
              </div>
            )}
            {groupChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={groupChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Legend />
                  {groupData.map((m, i) => (
                    <Line
                      key={m.nickname}
                      type="monotone"
                      dataKey={m.nickname}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-10">暂无数据</p>
            )}
          </>
        )}
      </div>

      {/* 我的统计 */}
      {tab === 'mine' && myData.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatCard label="最高" value={`${Math.max(...myData.map((d) => d.weight)).toFixed(1)} kg`} />
          <StatCard label="最低" value={`${Math.min(...myData.map((d) => d.weight)).toFixed(1)} kg`} />
          <StatCard
            label="变化"
            value={`${(myData[myData.length - 1].weight - myData[0].weight).toFixed(1)} kg`}
            highlight={myData[myData.length - 1].weight <= myData[0].weight}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-500' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
