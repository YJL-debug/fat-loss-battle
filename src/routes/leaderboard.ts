import { Hono } from 'hono';
import type { Bindings } from '../bindings';

type Variables = { userId: string };

const leaderboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 减脂率排行
leaderboard.get('/fat-loss', async (c) => {
  const groupId = c.req.param('groupId');

  const result = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.avatar, u.initial_weight,
       (SELECT weight FROM weight_records WHERE user_id = u.id AND group_id = ?
        ORDER BY recorded_date DESC LIMIT 1) as current_weight
     FROM users u
     JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ?
     WHERE u.initial_weight IS NOT NULL`
  )
    .bind(groupId, groupId)
    .all();

  const rankings = (result.results as any[])
    .filter((r) => r.current_weight != null)
    .map((r) => ({
      userId: r.id,
      nickname: r.nickname,
      avatar: r.avatar,
      initialWeight: r.initial_weight,
      currentWeight: r.current_weight,
      lossKg: +(r.initial_weight - r.current_weight).toFixed(2),
      lossPercent: +(((r.initial_weight - r.current_weight) / r.initial_weight) * 100).toFixed(2),
    }))
    .sort((a, b) => b.lossPercent - a.lossPercent);

  return c.json({ rankings });
});

// 连续打卡排行
leaderboard.get('/streaks', async (c) => {
  const groupId = c.req.param('groupId');

  const members = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.avatar FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?`
  )
    .bind(groupId)
    .all();

  const rankings = [];
  for (const member of members.results as any[]) {
    const records = await c.env.DB.prepare(
      `SELECT recorded_date FROM weight_records
       WHERE user_id = ? AND group_id = ?
       ORDER BY recorded_date DESC`
    )
      .bind(member.id, groupId)
      .all();

    const dates = (records.results as any[]).map((r) => r.recorded_date);
    const streak = calculateStreak(dates);
    const totalDays = dates.length;

    rankings.push({
      userId: member.id,
      nickname: member.nickname,
      avatar: member.avatar,
      streak,
      totalDays,
    });
  }

  rankings.sort((a, b) => b.streak - a.streak);
  return c.json({ rankings });
});

// 综合排行
leaderboard.get('/combined', async (c) => {
  const groupId = c.req.param('groupId');

  const fatLossRes = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.avatar, u.initial_weight,
       (SELECT weight FROM weight_records WHERE user_id = u.id AND group_id = ?
        ORDER BY recorded_date DESC LIMIT 1) as current_weight,
       (SELECT COUNT(*) FROM weight_records WHERE user_id = u.id AND group_id = ?) as total_days
     FROM users u
     JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ?
     WHERE u.initial_weight IS NOT NULL`
  )
    .bind(groupId, groupId, groupId)
    .all();

  const members = fatLossRes.results as any[];
  const rankings = [];

  for (const m of members) {
    if (!m.current_weight) continue;

    const lossPercent = ((m.initial_weight - m.current_weight) / m.initial_weight) * 100;

    const records = await c.env.DB.prepare(
      'SELECT recorded_date FROM weight_records WHERE user_id = ? AND group_id = ? ORDER BY recorded_date DESC'
    )
      .bind(m.id, groupId)
      .all();

    const dates = (records.results as any[]).map((r) => r.recorded_date);
    const streak = calculateStreak(dates);

    const daysSinceFirst = dates.length > 0
      ? Math.max(1, Math.floor((Date.now() - new Date(dates[dates.length - 1]).getTime()) / 86400000) + 1)
      : 1;
    const consistency = (m.total_days / daysSinceFirst) * 100;

    const score = lossPercent * 0.5 + streak * 0.3 + consistency * 0.2;

    rankings.push({
      userId: m.id,
      nickname: m.nickname,
      avatar: m.avatar,
      lossPercent: +lossPercent.toFixed(2),
      streak,
      consistency: +consistency.toFixed(1),
      score: +score.toFixed(2),
    });
  }

  rankings.sort((a, b) => b.score - a.score);
  return c.json({ rankings });
});

// AI 排行榜评语
leaderboard.post('/comments', async (c) => {
  const groupId = c.req.param('groupId');
  const forceRefresh = c.req.query('refresh') === 'true';

  if (!forceRefresh) {
    const cached = await c.env.DB.prepare(
      `SELECT user_id, title, comment FROM leaderboard_comments
       WHERE group_id = ? AND generated_at > datetime('now', '-12 hours')`
    ).bind(groupId).all();

    if (cached.results.length > 0) {
      return c.json({ comments: cached.results, cached: true });
    }
  }

  const rankings = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.initial_weight,
       (SELECT weight FROM weight_records WHERE user_id = u.id AND group_id = ?
        ORDER BY recorded_date DESC LIMIT 1) as current_weight,
       (SELECT COUNT(*) FROM weight_records WHERE user_id = u.id AND group_id = ?) as total_days
     FROM users u
     JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ?`
  ).bind(groupId, groupId, groupId).all();

  const membersData = (rankings.results as any[]).map((r) => ({
    nickname: r.nickname,
    userId: r.id,
    initialWeight: r.initial_weight,
    currentWeight: r.current_weight,
    totalDays: r.total_days,
    lossPercent: r.initial_weight && r.current_weight
      ? +(((r.initial_weight - r.current_weight) / r.initial_weight) * 100).toFixed(1)
      : 0,
  }));

  const url = c.env.AI_ENDPOINT.replace(/\/$/, '') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: c.env.AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `你是减脂比赛的趣味评委。根据排行榜数据，给每个人一个趣味头衔（4-8个字）和一句评语（15字以内）。
必须严格返回JSON数组格式，不要返回其他任何内容：
[{"nickname":"xxx","title":"xxx","comment":"xxx"}]`,
        },
        { role: 'user', content: `排行榜数据：${JSON.stringify(membersData)}` },
      ],
      temperature: 0.8,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    return c.json({ error: 'AI 生成失败' }, 500);
  }

  const aiData = (await response.json()) as any;
  const aiContent = aiData.choices[0].message.content;

  const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return c.json({ error: 'AI 返回格式错误' }, 500);
  }

  let parsed: Array<{ nickname: string; title: string; comment: string }>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return c.json({ error: 'AI 返回 JSON 解析失败' }, 500);
  }

  const batch = [];
  const comments: Array<{ user_id: string; title: string; comment: string }> = [];

  for (const item of parsed) {
    const member = membersData.find((m) => m.nickname === item.nickname);
    if (!member) continue;

    batch.push(
      c.env.DB.prepare(
        `INSERT INTO leaderboard_comments (id, group_id, user_id, title, comment, generated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(group_id, user_id) DO UPDATE SET title = excluded.title, comment = excluded.comment, generated_at = excluded.generated_at`
      ).bind(crypto.randomUUID(), groupId, member.userId, item.title, item.comment)
    );

    comments.push({ user_id: member.userId, title: item.title, comment: item.comment });
  }

  if (batch.length > 0) {
    await c.env.DB.batch(batch);
  }

  return c.json({ comments, cached: false });
});

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const curr = new Date(dates[i - 1]).getTime();
    const prev = new Date(dates[i]).getTime();
    const diffDays = (curr - prev) / 86400000;
    if (Math.abs(diffDays - 1) < 0.01) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default leaderboard;
