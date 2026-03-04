import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

type Mode = 'personal' | 'group' | 'roast';

const cacheKey = (groupId: string, mode: Mode) => `ai_cache_${groupId}_${mode}`;

export default function AIPage() {
  const { currentGroupId } = useAuth();
  const [mode, setMode] = useState<Mode>('personal');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  const analyze = useCallback(async (refresh = false) => {
    if (!currentGroupId) return;
    setLoading(true);
    if (refresh) setContent('');
    try {
      const fn = mode === 'personal'
        ? api.analyzeMe
        : mode === 'group'
        ? api.analyzeGroup
        : api.analyzeRoast;

      const data = await fn(currentGroupId, refresh);
      setContent(data.content);
      setCached(!!data.cached);
      // 写入 localStorage 缓存
      localStorage.setItem(cacheKey(currentGroupId, mode), JSON.stringify({ content: data.content }));
    } catch (err: any) {
      setContent(`分析失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentGroupId, mode]);

  // 页面加载或切换 mode 时自动加载缓存
  useEffect(() => {
    if (!currentGroupId) return;
    // 先从 localStorage 即时显示
    const local = localStorage.getItem(cacheKey(currentGroupId, mode));
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setContent(parsed.content);
        setCached(true);
      } catch { /* ignore */ }
    }
    // 再从后端加载最新缓存
    analyze(false);
  }, [mode, currentGroupId, analyze]);

  return (
    <div className="max-w-md mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">AI 分析</h1>

      {/* Mode 选择 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { key: 'personal' as Mode, label: '我的分析', emoji: '🏋️' },
          { key: 'group' as Mode, label: '群组播报', emoji: '📢' },
          { key: 'roast' as Mode, label: '搞笑点评', emoji: '😂' },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`p-3 rounded-xl text-center transition ${
              mode === m.key
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            <div className="text-xl mb-1">{m.emoji}</div>
            <div className="text-xs font-medium">{m.label}</div>
          </button>
        ))}
      </div>

      {/* 描述 */}
      <div className="bg-gray-50 rounded-xl p-3 mb-4">
        <p className="text-sm text-gray-500">
          {mode === 'personal' && '🏋️ AI 教练会分析你的体重趋势，给出个性化建议和鼓励'}
          {mode === 'group' && '📢 AI 解说员会用体育赛事的风格解说你们的减脂大战'}
          {mode === 'roast' && '😂 AI 脱口秀演员会为每个人颁发搞笑奖项（友善吐槽不伤人）'}
        </p>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={() => analyze(false)}
        disabled={loading}
        className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition mb-4"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            AI 正在分析中...
          </span>
        ) : (
          '开始分析'
        )}
      </button>

      {/* 结果展示 */}
      {content && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              {cached ? '缓存结果' : '最新分析'}
            </h3>
            {cached && (
              <button
                onClick={() => analyze(true)}
                disabled={loading}
                className="text-xs text-primary-600 hover:underline"
              >
                刷新
              </button>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
