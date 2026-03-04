import { Hono } from 'hono';
import type { Bindings } from '../bindings';

type Variables = { userId: string };

const ai = new Hono<{ Bindings: Bindings; Variables: Variables }>();

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callAI(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const url = endpoint.replace(/\/$/, '') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API 错误 (${response.status}): ${text}`);
  }

  const data = (await response.json()) as any;
  return data.choices[0].message.content;
}

// 个人趋势分析
ai.post('/analyze/me', async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('groupId');

  const user = await c.env.DB.prepare('SELECT nickname, initial_weight FROM users WHERE id = ?')
    .bind(userId)
    .first<{ nickname: string; initial_weight: number }>();

  const records = await c.env.DB.prepare(
    'SELECT weight, recorded_date FROM weight_records WHERE user_id = ? AND group_id = ? ORDER BY recorded_date DESC LIMIT 30'
  )
    .bind(userId, groupId)
    .all();

  if (!records.results.length) {
    return c.json({ content: '还没有体重记录，先去打卡吧！' });
  }

  // 检查缓存
  const cached = await c.env.DB.prepare(
    `SELECT content FROM ai_analyses
     WHERE group_id = ? AND target_user_id = ? AND analysis_type = 'personal'
     AND generated_at > datetime('now', '-24 hours')
     ORDER BY generated_at DESC LIMIT 1`
  )
    .bind(groupId, userId)
    .first<{ content: string }>();

  const forceRefresh = c.req.query('refresh') === 'true';
  if (cached && !forceRefresh) {
    return c.json({ content: cached.content, cached: true });
  }

  const dataStr = JSON.stringify({
    nickname: user?.nickname,
    initialWeight: user?.initial_weight,
    recentRecords: records.results,
  });

  const content = await callAI(c.env.AI_ENDPOINT, c.env.AI_API_KEY, c.env.AI_MODEL, [
    {
      role: 'system',
      content: `你是一个有趣、暖心的减脂教练。分析用户的体重数据，给出：
1. 趋势总结（上升/下降/平台期）
2. 根据趋势给予鼓励或温柔提醒
3. 一个实用的本周建议
4. 以一句有趣的励志语结尾

控制在200字以内，温暖且略带幽默。用中文回答。`,
    },
    { role: 'user', content: `请分析这位用户的体重数据：\n${dataStr}` },
  ]);

  // 缓存结果
  await c.env.DB.prepare(
    "INSERT INTO ai_analyses (id, group_id, target_user_id, analysis_type, content) VALUES (?, ?, ?, 'personal', ?)"
  )
    .bind(crypto.randomUUID(), groupId, userId, content)
    .run();

  return c.json({ content, cached: false });
});

// 群组趣味播报
ai.post('/analyze/group', async (c) => {
  const groupId = c.req.param('groupId');

  // 检查缓存
  const cached = await c.env.DB.prepare(
    `SELECT content FROM ai_analyses
     WHERE group_id = ? AND analysis_type = 'group_commentary' AND target_user_id IS NULL
     AND generated_at > datetime('now', '-12 hours')
     ORDER BY generated_at DESC LIMIT 1`
  )
    .bind(groupId)
    .first<{ content: string }>();

  const forceRefresh = c.req.query('refresh') === 'true';
  if (cached && !forceRefresh) {
    return c.json({ content: cached.content, cached: true });
  }

  // 获取所有成员数据
  const membersData = await c.env.DB.prepare(
    `SELECT u.nickname, u.initial_weight,
       wr.weight, wr.recorded_date
     FROM weight_records wr
     JOIN users u ON u.id = wr.user_id
     WHERE wr.group_id = ?
     ORDER BY u.nickname, wr.recorded_date DESC`
  )
    .bind(groupId)
    .all();

  const content = await callAI(c.env.AI_ENDPOINT, c.env.AI_API_KEY, c.env.AI_MODEL, [
    {
      role: 'system',
      content: `你是一个充满激情的体育赛事解说员，正在解说一场朋友间的减脂大赛。请根据数据：
1. 用戏剧化的方式解说谁在领先、谁在追赶
2. 给每个人颁发趣味头衔（如"稳如泰山奖"、"逆袭之星"、"佛系选手"）
3. 编织每个人的有趣故事线
4. 保持轻松有趣，绝不伤人

要像体育赛事回顾一样精彩！用中文回答，300字以内。`,
    },
    { role: 'user', content: `选手数据如下：\n${JSON.stringify(membersData.results)}` },
  ]);

  await c.env.DB.prepare(
    "INSERT INTO ai_analyses (id, group_id, target_user_id, analysis_type, content) VALUES (?, ?, NULL, 'group_commentary', ?)"
  )
    .bind(crypto.randomUUID(), groupId, content)
    .run();

  return c.json({ content, cached: false });
});

// 排行榜搞笑点评
ai.post('/analyze/roast', async (c) => {
  const groupId = c.req.param('groupId');

  const cached = await c.env.DB.prepare(
    `SELECT content FROM ai_analyses
     WHERE group_id = ? AND analysis_type = 'leaderboard_roast' AND target_user_id IS NULL
     AND generated_at > datetime('now', '-12 hours')
     ORDER BY generated_at DESC LIMIT 1`
  )
    .bind(groupId)
    .first<{ content: string }>();

  const forceRefresh = c.req.query('refresh') === 'true';
  if (cached && !forceRefresh) {
    return c.json({ content: cached.content, cached: true });
  }

  // 简化的排行数据
  const rankings = await c.env.DB.prepare(
    `SELECT u.nickname, u.initial_weight,
       (SELECT weight FROM weight_records WHERE user_id = u.id AND group_id = ?
        ORDER BY recorded_date DESC LIMIT 1) as current_weight,
       (SELECT COUNT(*) FROM weight_records WHERE user_id = u.id AND group_id = ?) as total_days
     FROM users u
     JOIN group_members gm ON gm.user_id = u.id AND gm.group_id = ?`
  )
    .bind(groupId, groupId, groupId)
    .all();

  const content = await callAI(c.env.AI_ENDPOINT, c.env.AI_API_KEY, c.env.AI_MODEL, [
    {
      role: 'system',
      content: `你是一个脱口秀演员，在朋友减脂大赛的颁奖典礼上做搞笑点评。请：
1. 给每人颁发搞笑奖项（要有创意，比如"嘴上说减肥身体很诚实奖"）
2. 用轻松的吐槽风格点评每人表现
3. 最后以正能量的团队鼓励结尾
4. 友善吐槽，绝不越线

像脱口秀一样有趣！用中文回答，300字以内。`,
    },
    { role: 'user', content: `排行榜数据：\n${JSON.stringify(rankings.results)}` },
  ]);

  await c.env.DB.prepare(
    "INSERT INTO ai_analyses (id, group_id, target_user_id, analysis_type, content) VALUES (?, ?, NULL, 'leaderboard_roast', ?)"
  )
    .bind(crypto.randomUUID(), groupId, content)
    .run();

  return c.json({ content, cached: false });
});

export default ai;
