# 减脂大作战 - 体重跟踪分析应用

## 项目概述

一群小伙伴减脂用的 Web 应用，支持每日体重打卡、数据可视化、排行榜比拼和 AI 趣味分析。

**技术栈：** Cloudflare Worker (Hono) + D1 数据库 + React + TailwindCSS + Recharts

**部署方式：** GitHub Actions 推送 main 分支自动部署到 Cloudflare Workers

## 项目结构

```
weight-tracker/
├── .github/workflows/deploy.yml  ← GitHub Actions 自动部署
├── wrangler.toml                 ← Cloudflare Worker 配置
├── package.json
├── tsconfig.json
├── src/                          ← Worker 后端 API (Hono)
│   ├── index.ts                  ← 入口，路由注册
│   ├── bindings.ts               ← 环境变量类型定义
│   ├── middleware/auth.ts        ← Bearer Token 认证中间件
│   ├── routes/
│   │   ├── auth.ts               ← 注册/登录/登出
│   │   ├── groups.ts             ← 群组管理/邀请码
│   │   ├── weights.ts            ← 体重记录 CRUD
│   │   ├── leaderboard.ts        ← 三种排行榜
│   │   └── ai.ts                 ← AI 分析（三种模式）
│   └── utils/crypto.ts           ← 密码哈希/Token 生成
├── frontend/                     ← React SPA 前端
│   ├── vite.config.ts            ← build 输出到 ../static
│   ├── tailwind.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               ← 路由配置
│       ├── api/client.ts         ← API 请求封装（全部接口）
│       ├── hooks/useAuth.tsx     ← 认证 Context
│       ├── components/layout/AppShell.tsx ← 底部 Tab 导航壳
│       └── pages/
│           ├── LoginPage.tsx     ← 登录
│           ├── RegisterPage.tsx  ← 注册
│           ├── SetupPage.tsx     ← 创建/加入群组
│           ├── DashboardPage.tsx ← 首页：快速打卡+概览+迷你图
│           ├── ChartsPage.tsx    ← 个人趋势图+全员对比图
│           ├── LeaderboardPage.tsx ← 减脂率/连续打卡/综合排行
│           ├── AIPage.tsx        ← AI 个人分析/群组播报/搞笑点评
│           └── SettingsPage.tsx  ← 群组管理/邀请码/退出
├── migrations/
│   └── 0001_initial.sql          ← D1 建表（7张表+索引）
└── static/                       ← 前端 build 产物（gitignore）
```

## 已实现的功能

### 用户系统
- 昵称+密码注册登录（PBKDF2 哈希）
- Session Token 认证（30天有效期）
- 无需邮箱，轻量级朋友间使用

### 群组 + 邀请码
- 创建群组 → 自动成为管理员
- 生成 8 位邀请码 → 分享给朋友加入
- 支持多群组切换

### 每日体重打卡
- 每人每天一条记录（重复提交为 upsert 更新）
- 首次记录自动设为初始体重（用于计算减脂率）
- 支持手动填写历史日期

### 数据图表 (Recharts)
- **个人趋势图**：7/30/90 天切换，显示最高/最低/变化统计
- **全员对比图**：多人折线叠加，支持「百分比变化」模式（保护隐私）

### 三种排行榜
- **减脂率**：`(初始体重 - 当前体重) / 初始体重 × 100%`
- **连续打卡天数**：streak 必须包含今天或昨天
- **综合积分**：减脂率×50% + 连续打卡×30% + 总打卡率×20%

### AI 分析（三种模式）
- **个人趋势分析**：AI 教练风格，温暖鼓励+实用建议
- **群组趣味播报**：体育解说员风格，戏剧化 play-by-play + 趣味头衔
- **排行榜搞笑点评**：脱口秀风格，搞笑颁奖（友善不伤人）
- 结果缓存在 D1（个人 24h / 群组 12h），支持手动刷新

## 数据库表

| 表名 | 用途 |
|------|------|
| users | 用户（id, nickname, password_hash, initial_weight） |
| groups | 群组 |
| group_members | 群组成员（多对多，role: admin/member） |
| invite_codes | 邀请码（8位，有使用次数和过期时间限制） |
| weight_records | 体重记录（unique: user+group+date） |
| sessions | 登录会话 |
| ai_analyses | AI 分析结果缓存 |

## API 端点速览

```
POST /api/v1/auth/register          ← 注册
POST /api/v1/auth/login             ← 登录
GET  /api/v1/auth/me                ← 当前用户（需认证）

POST /api/v1/groups                 ← 创建群组
GET  /api/v1/groups                 ← 我的群组列表
POST /api/v1/groups/join            ← 邀请码加入
POST /api/v1/groups/:id/invite      ← 生成邀请码

POST /api/v1/groups/:id/weights     ← 记录体重（upsert）
GET  /api/v1/groups/:id/weights/mine       ← 我的记录
GET  /api/v1/groups/:id/weights/all        ← 全员数据

GET  /api/v1/groups/:id/leaderboard/fat-loss   ← 减脂率排行
GET  /api/v1/groups/:id/leaderboard/streaks    ← 打卡排行
GET  /api/v1/groups/:id/leaderboard/combined   ← 综合排行

POST /api/v1/groups/:id/ai/analyze/me     ← AI 个人分析
POST /api/v1/groups/:id/ai/analyze/group  ← AI 群组播报
POST /api/v1/groups/:id/ai/analyze/roast  ← AI 搞笑点评
```

## 本地开发

```bash
# 安装依赖
npm install

# 初始化本地 D1 数据库
npm run db:migrate:local

# 构建前端 + 启动 Worker（生产模式预览）
npm run build
npx wrangler dev

# 或者前后端分别启动（开发模式，前端热更新）
npm run dev
# Worker: http://localhost:8787
# 前端:   http://localhost:5173（自动代理 /api 到 Worker）
```

## 部署到 Cloudflare

### 方式一：GitHub Actions 自动部署（推荐）

1. 把项目推到 GitHub 仓库
2. 在 GitHub → Settings → Secrets and variables → Actions 添加：

| Secret | 说明 | 获取方式 |
|--------|------|---------|
| `CLOUDFLARE_API_TOKEN` | CF API Token | CF Dashboard → My Profile → API Tokens → Create Token → 选 "Edit Cloudflare Workers" 模板 |
| `CLOUDFLARE_ACCOUNT_ID` | CF 账号 ID | CF Dashboard → 右侧栏 Account ID |
| `AI_API_KEY` | AI API 密钥 | 你自己的 OpenAI 兼容 API Key |

3. Push 到 main 分支自动触发部署，或在 Actions 页面手动 Run workflow
4. D1 数据库会在首次部署时自动创建和迁移

### 方式二：手动部署

```bash
# 1. 创建 D1 数据库
npx wrangler d1 create weight-tracker-db
# 把返回的 database_id 填入 wrangler.toml

# 2. 运行远程迁移
npm run db:migrate:remote

# 3. 设置 AI API Key
npx wrangler secret put AI_API_KEY

# 4. 构建并部署
npm run deploy
```

## AI 配置

在 `wrangler.toml` 的 `[vars]` 中修改：

```toml
[vars]
AI_ENDPOINT = "https://你的API地址/v1"   # OpenAI 兼容格式
AI_MODEL = "模型名称"                     # 如 gpt-4o-mini
```

`AI_API_KEY` 通过 Secret 设置（不写在代码里）。

## 待改进 / 后续可做

- [ ] 自定义头像上传
- [ ] 目标体重设定 + 图表上显示目标线
- [ ] 每周/月度自动 AI 周报推送
- [ ] PWA 离线支持 + 推送提醒打卡
- [ ] 更丰富的成就系统（徽章、里程碑）
- [ ] 体脂率等更多指标记录
