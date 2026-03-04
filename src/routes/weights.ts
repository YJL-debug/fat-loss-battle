import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { generateId } from '../utils/crypto';

type Variables = { userId: string };

const weights = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 记录体重 (upsert)
weights.post('/', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('groupId');
  const { weight, date, note } = await c.req.json<{
    weight: number;
    date?: string;
    note?: string;
  }>();

  if (!weight || weight < 20 || weight > 300) {
    return c.json({ error: '请输入合理的体重(20-300kg)' }, 400);
  }

  // 验证群组成员
  const membership = await c.env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(groupId, userId)
    .first();
  if (!membership) return c.json({ error: '你不在该群组中' }, 403);

  const recordedDate = date || new Date().toISOString().slice(0, 10);
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO weight_records (id, user_id, group_id, weight, recorded_date, note)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, group_id, recorded_date)
     DO UPDATE SET weight = excluded.weight, note = excluded.note`
  )
    .bind(id, userId, groupId, weight, recordedDate, note || null)
    .run();

  // 设置初始体重（如果还没设置）
  await c.env.DB.prepare(
    'UPDATE users SET initial_weight = ? WHERE id = ? AND initial_weight IS NULL'
  )
    .bind(weight, userId)
    .run();

  return c.json({ ok: true, date: recordedDate, weight });
});

// 我的体重记录
weights.get('/mine', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('groupId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  let sql = 'SELECT * FROM weight_records WHERE user_id = ? AND group_id = ?';
  const params: (string | number)[] = [userId, groupId!];

  if (from) {
    sql += ' AND recorded_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND recorded_date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY recorded_date ASC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ records: result.results });
});

// 最新一条记录
weights.get('/mine/latest', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('groupId');

  const record = await c.env.DB.prepare(
    'SELECT * FROM weight_records WHERE user_id = ? AND group_id = ? ORDER BY recorded_date DESC LIMIT 1'
  )
    .bind(userId, groupId)
    .first();

  return c.json({ record });
});

// 所有成员的体重数据（用于对比图表）
weights.get('/all', async (c) => {
  const groupId = c.req.param('groupId');
  const userId = c.get('userId');
  const from = c.req.query('from');

  // 验证成员
  const membership = await c.env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(groupId, userId)
    .first();
  if (!membership) return c.json({ error: '你不在该群组中' }, 403);

  let sql = `SELECT wr.user_id, u.nickname, u.initial_weight, wr.weight, wr.recorded_date
     FROM weight_records wr
     JOIN users u ON u.id = wr.user_id
     WHERE wr.group_id = ?`;
  const params: (string | number)[] = [groupId!];

  if (from) {
    sql += ' AND wr.recorded_date >= ?';
    params.push(from);
  }

  sql += ' ORDER BY wr.recorded_date ASC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  // 按用户分组
  const membersMap = new Map<string, { nickname: string; initial_weight: number | null; data: { date: string; weight: number }[] }>();

  for (const row of result.results as any[]) {
    if (!membersMap.has(row.user_id)) {
      membersMap.set(row.user_id, {
        nickname: row.nickname,
        initial_weight: row.initial_weight,
        data: [],
      });
    }
    membersMap.get(row.user_id)!.data.push({
      date: row.recorded_date,
      weight: row.weight,
    });
  }

  return c.json({ members: Array.from(membersMap.values()) });
});

// 删除记录
weights.delete('/:recordId', async (c) => {
  const userId = c.get('userId');
  const recordId = c.req.param('recordId');

  await c.env.DB.prepare('DELETE FROM weight_records WHERE id = ? AND user_id = ?')
    .bind(recordId, userId)
    .run();

  return c.json({ ok: true });
});

export default weights;
