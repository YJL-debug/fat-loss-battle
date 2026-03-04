-- 用户头像字段
ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL;

-- 排行榜 AI 评语表
CREATE TABLE IF NOT EXISTS leaderboard_comments (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    comment TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lb_comments_group ON leaderboard_comments(group_id);
