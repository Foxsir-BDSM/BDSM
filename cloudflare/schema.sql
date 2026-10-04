-- ============================================================
-- 欲炼之途 · 任务与媒体 · D1 表结构
-- ------------------------------------------------------------
-- 用途：Cloudflare D1（SQLite）存放「谁接取了哪个任务」这类流水数据。
--
-- 为什么不放 GitHub：任务是天天变的流水数据，Git 适合沉淀型内容，
--                   不适合高频写入（每次写都是一个 commit）。
-- 为什么不放 Zite：  Zite 的 API Key 是全局权限，做不到「只能改自己的行」。
--                   本表由 Worker 校验用户身份后按 user_id 隔离。
--
-- 部署：wrangler d1 execute foxsir --remote --file=./worker/schema.sql
-- ============================================================

-- ── 任务接取记录 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_acceptances (
  id            TEXT PRIMARY KEY,              -- uuid，由 Worker 生成
  user_id       TEXT NOT NULL,                 -- Supabase auth 的 user.id（不可伪造）
  task_slug     TEXT NOT NULL,                 -- 关联内容的 frontmatter slug
  task_title    TEXT,                          -- 冗余存储，列表页免二次查询
  task_type     TEXT,                          -- 接取时该内容属于哪个板块
  status        TEXT NOT NULL DEFAULT 'accepted',  -- accepted | submitted
  accepted_at   TEXT NOT NULL,                 -- ISO 字符串，SQLite 无原生时间类型
  submitted_at  TEXT,
  feedback_slug TEXT,                          -- 提交后回填：关联的反馈内容 slug
  UNIQUE (user_id, task_slug)                  -- 同一任务只能接取一次
);

CREATE INDEX IF NOT EXISTS idx_task_acc_user
  ON task_acceptances (user_id, status, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_acc_slug
  ON task_acceptances (task_slug);

-- ── 媒体文件索引 ──────────────────────────────────────────
-- 说明：文件本体在 R2，这里只记元信息，便于：
--   · 统计某用户上传了多少
--   · 将来做清理（删除内容时连带清媒体）
CREATE TABLE IF NOT EXISTS media_objects (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  r2_key      TEXT NOT NULL UNIQUE,            -- R2 里的对象键
  url         TEXT NOT NULL,                   -- 公开访问地址
  filename    TEXT,                            -- 原始文件名（仅作展示）
  content_type TEXT,
  size        INTEGER,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_user
  ON media_objects (user_id, created_at DESC);
