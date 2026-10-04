# Foxsir · 欲研所

面向 BDSM 爱好者的私密社区平台。核心理念：**安全 · 尊重 · 共识**。

> 📖 想了解这个项目能做什么，请读 **[项目介绍](_dev/docs/项目介绍.md)**。

---

## 快速开始

```bash
npm install          # 安装依赖
npm run dev          # 本地开发（默认 5173 端口）
npm run build        # 生产构建 → dist/
npm run preview      # 预览构建产物
```

---

## 目录结构

本仓库分为**运行所需**与**开发资料**两部分，后者全部集中在 `_dev/`。

```
Foxsir-BDSM/
│
├── src/                    ★ 源码（构建输入）
│   ├── launcher/               启动器：着陆页 / 首页 / 登录 / 我的 / 编辑资料 / 指南
│   ├── modules/                功能模块
│   │   ├── sub-archive/            欲渊之庭 —— 档案库
│   │   └── content/                欲炼之途 —— 玩法与见解
│   ├── admin/                  管理后台
│   └── shared/                 共享层：配置 / JS / CSS / 资源
│
├── tools/                  构建与校验脚本
│   ├── flatten-dist.mjs        构建后扁平化 dist
│   ├── analyze-deps.mjs        依赖图分析
│   ├── check-*.mjs             各类校验（配置 / 渲染 / 布局 / 引用 …）
│   └── *.py                    数据处理脚本
│
├── dist/                   构建产物（不纳入版本控制）
├── foxsir-content/         内容数据（发布的内容落在这里）
├── node_modules/
│
├── package.json            依赖与脚本
├── vite.config.js          构建配置
├── CNAME                   部署域名
├── README.md               本文件
│
└── _dev/                   ★ 开发资料（不参与构建，详见 _dev/README.md）
    ├── docs/                   开发文档
    │   ├── 项目介绍.md             对外简介
    │   ├── 架构设计/               分层与重构方案
    │   ├── 操作手册/               环境搭建、字段维护 SOP
    │   ├── 验证记录/               测试与验证流程
    │   ├── 数据表/                 题库、字段映射、维护对照表
    │   └── 草稿/                   已过时的中间产物
    ├── sop/                    标准作业流程
    └── archive/                历史归档（按主题 + 时间线）
```

---

## 常用命令

| 命令 | 用途 |
|:---|:---|
| `npm run dev` | 启动本地开发服务 |
| `npm run build` | 生产构建（含 dist 扁平化） |
| `npm run ref-check` | 引用完整性检查 |
| `npm run fields` | 对比远程数据库字段与本地配置 |
| `npm run check:archive` | 档案馆配置校验 |
| `npm run check:render` | 档案列表页渲染验证 |
| `npm run check:profile:layout` | 资料编辑页布局验证 |

---

## 技术栈

| 项 | 说明 |
|:---|:---|
| 形态 | 静态多页面站点（MPA），原生 ES Modules，无前端框架 |
| 构建 | Vite 5 |
| 认证与存储 | Supabase |
| 档案数据 | Zite / Fillout Tables |
| 内容数据 | GitHub 仓库（`foxsir-content`） |

---

## 开发约定

1. **字段配置集中在 `src/shared/config/archive/fields.js`**
   调整某页面显示哪些字段，改该文件对应的数组即可，不用动页面代码。

2. **不要硬编码字段 ID**
   迁移数据库后字段 ID 会变，硬编码会导致静默失效。
   所有字段 ID 一律从配置读取。

3. **提交前跑校验**
   ```bash
   npm run build && npm run ref-check
   ```

4. **开发文档写进 `_dev/docs/`**
   根目录只保留运行所需的文件。

---

## 许可

私有项目，仅供授权用户使用。
