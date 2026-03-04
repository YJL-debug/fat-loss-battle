import { Hono } from 'hono';
import type { Bindings } from './bindings';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import weightRoutes from './routes/weights';
import leaderboardRoutes from './routes/leaderboard';
import aiRoutes from './routes/ai';

type Variables = { userId: string };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 健康检查
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// 公开路由
app.route('/api/v1/auth', authRoutes);

// 认证保护的路由
app.use('/api/v1/*', authMiddleware);
app.route('/api/v1/groups', groupRoutes);
app.route('/api/v1/groups/:groupId/weights', weightRoutes);
app.route('/api/v1/groups/:groupId/leaderboard', leaderboardRoutes);
app.route('/api/v1/groups/:groupId/ai', aiRoutes);

export default app;
