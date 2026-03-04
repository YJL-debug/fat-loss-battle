import { Context, Next } from 'hono';
import type { Bindings } from '../bindings';

type Variables = {
  userId: string;
};

export async function authMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401);
  }

  const token = authHeader.slice(7);
  const session = await c.env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  )
    .bind(token)
    .first<{ user_id: string }>();

  if (!session) {
    return c.json({ error: '登录已过期' }, 401);
  }

  c.set('userId', session.user_id);
  await next();
}
