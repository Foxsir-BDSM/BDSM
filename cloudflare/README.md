# 任务与媒体后端 · 部署说明

本目录是「欲炼之途」的任务接取、媒体上传、内容发布的服务端。
基于 **Cloudflare Workers + D1 + R2**。

---

## 为什么需要服务端

三件事**不能**在浏览器里直接做：

| 事情 | 直连的问题 |
|:---|:---|
| 任务接取记录 | 没有可信的「我是谁」，谁都能伪造别人的记录 |
| 媒体上传 | 需要存储服务，且要限制谁能传 |
| 内容发布 | GitHub Token 若打进前端产物，F12 就能拿到并删改整个仓库 |

本 Worker 把密钥留在服务端，并**按登录用户身份限制只能操作自己的数据**。

---

## 部署步骤

### 0. 前置

需要一个 Cloudflare 账号（免费版足够）。域名 `foxsir.top` 的 DNS 在阿里云，这**不影响**部署——Worker 会先给一个 `*.workers.dev` 地址，之后可选绑自定义域名。

### 1. 安装 wrangler

```bash
npm install -g wrangler
wrangler login          # 会打开浏览器授权
```

### 2. 创建 D1 数据库

```bash
cd cloudflare
wrangler d1 create foxsir
```

命令会输出一段 `database_id = "xxxx-..."`，**把它填进 `wrangler.toml` 的 `database_id`**（替换 `REPLACE_WITH_YOUR_D1_DATABASE_ID`）。

### 3. 建表

```bash
wrangler d1 execute foxsir --remote --file=./schema.sql
```

### 4. 创建 R2 存储桶

```bash
wrangler r2 bucket create foxsir-media
```

### 5. 配置密钥

以下三个用 `wrangler secret put` 逐个设置（会提示你粘贴值，**不会写进代码仓库**）：

```bash
wrangler secret put SUPABASE_URL        # 例如 https://xxxx.supabase.co
wrangler secret put SUPABASE_ANON_KEY   # Supabase 的 anon key
wrangler secret put GITHUB_TOKEN        # 见下方「GitHub Token 怎么生成」
```

**GitHub Token 生成**：

```
GitHub → Settings → Developer settings → Personal access tokens
  → Fine-grained tokens → Generate new token
      Repository access : 只勾选 Foxsir-BDSM/foxsir-content
      Permissions       : Contents → Read and write
      Expiration        : 建议 1 年（到期前记得换）
```

### 6. 部署

```bash
wrangler deploy
```

成功后输出形如：

```
https://foxsir-task-api.<你的子域>.workers.dev
```

把这个地址填进前端的配置（见下）。

### 7. 验证

```bash
curl https://foxsir-task-api.<你的子域>.workers.dev/health
# 期望: {"ok":true,"service":"foxsir-task-api","ts":"..."}
```

---

## 前端需要填的配置

部署完把 Worker 地址填到 `src/shared/js/config.js`：

```js
export const TASK_API_BASE = 'https://foxsir-task-api.xxx.workers.dev';
```

---

## 可选：绑定自定义域名

默认的 `*.workers.dev` 在国内访问不稳定。绑自定义域名会好很多：

```
Cloudflare Dashboard → Workers → foxsir-task-api → Settings → Domains & Routes
  → Add Custom Domain → api.foxsir.top
```

然后在**阿里云 DNS 控制台**加一条记录（Cloudflare 会给出目标值）：

```
主机记录: api
记录类型: CNAME
记录值  : （Cloudflare 显示的地址）
```

R2 同理，可绑 `media.foxsir.top`，绑好后把地址填进 `wrangler.toml` 的 `R2_PUBLIC_BASE` 并重新 `wrangler deploy`。

---

## 接口一览

| 方法 | 路径 | 说明 | 需登录 |
|:---|:---|:---|:---:|
| GET | `/health` | 健康检查 | ✗ |
| POST | `/api/tasks/accept` | 接取任务 | ✓ |
| GET | `/api/tasks/mine` | 我的任务列表（`?status=accepted\|submitted\|all`） | ✓ |
| PATCH | `/api/tasks/:slug` | 更新状态（`{status, feedbackSlug}`） | ✓ |
| POST | `/api/media` | 上传媒体（multipart，字段名 `file`） | ✓ |
| POST | `/api/content` | 发布内容（`{slug, content, message}`） | ✓ |

所有需登录的接口都要带：

```
Authorization: Bearer <Supabase access_token>
```

---

## 安全设计要点

| 设计 | 原因 |
|:---|:---|
| 每次请求都向 Supabase 校验 token | 不自己解 JWT，避开签名算法与密钥轮换的坑 |
| 所有 SQL 都用 `?` 参数绑定 | 防注入 |
| 查询/更新一律带 `user_id = ?` | 用户只能碰自己的记录 |
| 上传类型白名单 + 20MB 上限 | 防滥用 |
| Token 存 Workers Secret | 不进代码、不进前端产物 |
| CORS 限定来源 | 防其他站点盗用接口 |
| 错误统一返回模糊信息 | 不把内部细节暴露给前端 |

---

## 本地调试（可选）

```bash
cd cloudflare
wrangler dev              # 本地起一个带 D1/R2 模拟的后端
```

本地调试时把前端的 `TASK_API_BASE` 指向 `http://127.0.0.1:8787`。

---

## 常见问题

**Q: `wrangler d1 execute` 报 database not found？**
先确认 `wrangler.toml` 里的 `database_id` 已替换成真实值。

**Q: 上传成功但拿不到 URL？**
`R2_PUBLIC_BASE` 还没配。R2 桶需要开启公开访问或绑定自定义域名。

**Q: 前端报 401？**
Supabase 登录已过期，重新登录即可。Worker 不维护自己的会话。

**Q: 内容发布报 502 GitHub 提交失败？**
检查 `GITHUB_TOKEN` 是否有 `contents: write` 权限，以及 `CONTENT_BRANCH` 是否为仓库真实存在的分支。
