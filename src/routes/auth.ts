import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { generateId, hashPassword, generateToken } from '../utils/crypto';

type Variables = { userId: string };

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 公开注册：仅允许第一个用户（引导注册）
auth.post('/register', async (c) => {
  const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
  if (userCount && userCount.count > 0) {
    return c.json({ error: '请使用邀请码注册' }, 403);
  }

  const { nickname, password } = await c.req.json<{ nickname: string; password: string }>();
  if (!nickname?.trim() || !password || password.length < 4) {
    return c.json({ error: '昵称和密码不能为空，密码至少4位' }, 400);
  }

  const id = generateId();
  const passwordHash = await hashPassword(password, id);
  const token = generateToken();

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id, nickname, password_hash) VALUES (?, ?, ?)')
      .bind(id, nickname.trim(), passwordHash),
    c.env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
      .bind(token, id),
  ]);

  return c.json({ token, user: { id, nickname: nickname.trim() } });
});

// 邀请码注册（创建账号 + 加入群组）
auth.post('/register-with-invite', async (c) => {
  const { nickname, password, inviteCode } = await c.req.json<{ nickname: string; password: string; inviteCode: string }>();

  if (!nickname?.trim() || !password || password.length < 4) {
    return c.json({ error: '昵称和密码不能为空，密码至少4位' }, 400);
  }
  if (!inviteCode?.trim()) {
    return c.json({ error: '请输入邀请码' }, 400);
  }

  const invite = await c.env.DB.prepare(
    `SELECT * FROM invite_codes WHERE code = ?
     AND (expires_at IS NULL OR expires_at > datetime('now'))
     AND (max_uses IS NULL OR use_count < max_uses)`
  )
    .bind(inviteCode.trim().toUpperCase())
    .first<{ group_id: string; use_count: number }>();

  if (!invite) return c.json({ error: '邀请码无效或已过期' }, 404);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE nickname = ?')
    .bind(nickname.trim())
    .first();
  if (existing) return c.json({ error: '昵称已被使用' }, 409);

  const id = generateId();
  const passwordHash = await hashPassword(password, id);
  const token = generateToken();

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id, nickname, password_hash) VALUES (?, ?, ?)')
      .bind(id, nickname.trim(), passwordHash),
    c.env.DB.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')")
      .bind(invite.group_id, id),
    c.env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
      .bind(token, id),
    c.env.DB.prepare('UPDATE invite_codes SET use_count = use_count + 1 WHERE code = ?')
      .bind(inviteCode.trim().toUpperCase()),
  ]);

  return c.json({ token, user: { id, nickname: nickname.trim() }, groupId: invite.group_id });
});

auth.post('/login', async (c) => {
  const { nickname, password } = await c.req.json<{ nickname: string; password: string }>();

  const user = await c.env.DB.prepare('SELECT id, nickname, password_hash FROM users WHERE nickname = ?')
    .bind(nickname?.trim())
    .first<{ id: string; nickname: string; password_hash: string }>();

  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }

  const passwordHash = await hashPassword(password, user.id);
  if (passwordHash !== user.password_hash) {
    return c.json({ error: '密码错误' }, 401);
  }

  const token = generateToken();
  await c.env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
  )
    .bind(token, user.id)
    .run();

  return c.json({ token, user: { id: user.id, nickname: user.nickname } });
});

auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  // 手动验证 token（auth 路由在中间件之前注册）
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401);
  const token = authHeader.slice(7);
  const session = await c.env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  ).bind(token).first<{ user_id: string }>();
  if (!session) return c.json({ error: '登录已过期' }, 401);

  const user = await c.env.DB.prepare(
    'SELECT id, nickname, avatar, initial_weight, created_at FROM users WHERE id = ?'
  )
    .bind(session.user_id)
    .first();

  if (!user) return c.json({ error: '用户不存在' }, 404);
  return c.json({ user });
});

// 更新头像
auth.put('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401);
  const token = authHeader.slice(7);
  const session = await c.env.DB.prepare(
    "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  ).bind(token).first<{ user_id: string }>();
  if (!session) return c.json({ error: '登录已过期' }, 401);

  const { avatar } = await c.req.json<{ avatar?: string }>();
  if (avatar && avatar.length > 8) {
    return c.json({ error: '头像格式不正确' }, 400);
  }

  await c.env.DB.prepare("UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(avatar || null, session.user_id)
    .run();

  return c.json({ ok: true });
});

export default auth;
