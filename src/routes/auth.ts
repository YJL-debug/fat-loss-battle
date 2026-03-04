import { Hono } from 'hono';
import type { Bindings } from '../bindings';
import { generateId, hashPassword, generateToken } from '../utils/crypto';

type Variables = { userId: string };

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auth.post('/register', async (c) => {
  const { nickname, password } = await c.req.json<{ nickname: string; password: string }>();

  if (!nickname?.trim() || !password || password.length < 4) {
    return c.json({ error: '昵称和密码不能为空，密码至少4位' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE nickname = ?')
    .bind(nickname.trim())
    .first();
  if (existing) {
    return c.json({ error: '昵称已被使用' }, 409);
  }

  const id = generateId();
  const salt = id;
  const passwordHash = await hashPassword(password, salt);

  await c.env.DB.prepare(
    'INSERT INTO users (id, nickname, password_hash) VALUES (?, ?, ?)'
  )
    .bind(id, nickname.trim(), passwordHash)
    .run();

  const token = generateToken();
  await c.env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
  )
    .bind(token, id)
    .run();

  return c.json({ token, user: { id, nickname: nickname.trim() } });
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
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, nickname, initial_weight, created_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first();

  if (!user) return c.json({ error: '用户不存在' }, 404);
  return c.json({ user });
});

export default auth;
