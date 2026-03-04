import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { generateId, generateInviteCode } from '../utils/crypto';

type Variables = { userId: string };

const groups = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 创建群组
groups.post('/', async (c) => {
  const userId = c.get('userId');
  const { name } = await c.req.json<{ name: string }>();

  if (!name?.trim()) return c.json({ error: '群组名称不能为空' }, 400);

  const id = generateId();
  const batch = [
    c.env.DB.prepare('INSERT INTO groups (id, name, creator_id) VALUES (?, ?, ?)')
      .bind(id, name.trim(), userId),
    c.env.DB.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')")
      .bind(id, userId),
  ];
  await c.env.DB.batch(batch);

  return c.json({ group: { id, name: name.trim() } });
});

// 我的群组列表
groups.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.created_at, gm.role,
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
     ORDER BY g.created_at DESC`
  )
    .bind(userId)
    .all();

  return c.json({ groups: result.results });
});

// 群组详情
groups.get('/:groupId', async (c) => {
  const groupId = c.req.param('groupId');
  const userId = c.get('userId');

  const membership = await c.env.DB.prepare(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(groupId, userId)
    .first();

  if (!membership) return c.json({ error: '你不在该群组中' }, 403);

  const group = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?')
    .bind(groupId)
    .first();

  const members = await c.env.DB.prepare(
    `SELECT u.id, u.nickname, u.initial_weight, gm.role, gm.joined_at,
       (SELECT weight FROM weight_records WHERE user_id = u.id AND group_id = ?
        ORDER BY recorded_date DESC LIMIT 1) as latest_weight
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?
     ORDER BY gm.joined_at ASC`
  )
    .bind(groupId, groupId)
    .all();

  return c.json({ group, members: members.results, myRole: membership.role });
});

// 生成邀请码
groups.post('/:groupId/invite', async (c) => {
  const groupId = c.req.param('groupId');
  const userId = c.get('userId');

  const membership = await c.env.DB.prepare(
    "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
  )
    .bind(groupId, userId)
    .first<{ role: string }>();

  if (!membership) return c.json({ error: '你不在该群组中' }, 403);

  const code = generateInviteCode();
  await c.env.DB.prepare(
    'INSERT INTO invite_codes (code, group_id, created_by) VALUES (?, ?, ?)'
  )
    .bind(code, groupId, userId)
    .run();

  return c.json({ code });
});

// 通过邀请码加入群组
groups.post('/join', async (c) => {
  const userId = c.get('userId');
  const { code } = await c.req.json<{ code: string }>();

  if (!code?.trim()) return c.json({ error: '请输入邀请码' }, 400);

  const invite = await c.env.DB.prepare(
    `SELECT * FROM invite_codes WHERE code = ?
     AND (expires_at IS NULL OR expires_at > datetime('now'))
     AND (max_uses IS NULL OR use_count < max_uses)`
  )
    .bind(code.trim().toUpperCase())
    .first<{ group_id: string; use_count: number }>();

  if (!invite) return c.json({ error: '邀请码无效或已过期' }, 404);

  const existing = await c.env.DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  )
    .bind(invite.group_id, userId)
    .first();

  if (existing) return c.json({ error: '你已经在该群组中' }, 409);

  const batch = [
    c.env.DB.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')")
      .bind(invite.group_id, userId),
    c.env.DB.prepare('UPDATE invite_codes SET use_count = use_count + 1 WHERE code = ?')
      .bind(code.trim().toUpperCase()),
  ];
  await c.env.DB.batch(batch);

  const group = await c.env.DB.prepare('SELECT id, name FROM groups WHERE id = ?')
    .bind(invite.group_id)
    .first();

  return c.json({ group });
});

export default groups;
