import { Hono } from 'hono';
import type { Bindings } from '../bindings';

type Variables = { userId: string };

const leaderboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 减脂率排行
leaderboard.get('/fat-loss', async (c) => {
  const groupId = c.req.param('groupId');

  const result = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.initial_weight,
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
    `SELECT u.id, u.nickname FROM group_members gm
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

  // 获取减脂数据
  const fatLossRes = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.initial_weight,
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

    // 综合分 = 减脂率*50% + 连续打卡*30% + 总打卡率*20%
    const daysSinceFirst = dates.length > 0
      ? Math.max(1, Math.floor((Date.now() - new Date(dates[dates.length - 1]).getTime()) / 86400000) + 1)
      : 1;
    const consistency = (m.total_days / daysSinceFirst) * 100;

    const score = lossPercent * 0.5 + streak * 0.3 + consistency * 0.2;

    rankings.push({
      userId: m.id,
      nickname: m.nickname,
      lossPercent: +lossPercent.toFixed(2),
      streak,
      consistency: +consistency.toFixed(1),
      score: +score.toFixed(2),
    });
  }

  rankings.sort((a, b) => b.score - a.score);
  return c.json({ rankings });
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
