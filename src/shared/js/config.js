// 职责    Supabase 连接参数与全局常量。
// 归属页面 全站
// 依赖    无
// 被依赖   supabase-client.js、registry.js 等
//
// 维护提示
//   · 换后端项目只改这里。
export const SUPABASE_URL = 'https://mfexambabgxytkrkhmwx.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZXhhbWJhYmd4eXRrcmtobXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzcwMTgsImV4cCI6MjA5OTU1MzAxOH0.FdD4EV8fV1mX6J8Vxsio_eyJgkY-_W7SM0M0xvcKN90';

// ════════════════════════════════════════════════════════════
// 任务与媒体后端（Cloudflare Worker）
// ------------------------------------------------------------
// 部署方式见 cloudflare/README.md。
// 未配置时（留空），任务接取与媒体上传功能会自动降级为不可用，
// 站点其余部分不受影响。
// ════════════════════════════════════════════════════════════
export const TASK_API_BASE = 'https://foxsir-task-api.hzb0705.workers.dev';

/** 后端是否已就绪 —— 供各页面判断要不要显示「接取」等入口 */
export const hasTaskApi = () => !!TASK_API_BASE;

// ★★★ 项目注册表 ★★★
// 访客(guest) 无权访问任何板块
// 普通用户(self) 可访问全部板块
// 认证用户(verified) 可访问全部板块
// 次级管理(subadmin) 可访问全部板块
// 根源管理(admin) 可访问全部板块
//
// 2026-10-03：原「欲主之殿(dom-archive)」与「欲渊之庭(sub-archive)」
// 已合并为单一档案库，不再按上下位分馆；S 与 M 的区分由档案的
// 「身份」字段承担，列表页据用户身份筛选。
//
// 2026-10-04：模块收敛为两个 —— 档案馆 / 欲炼之途。
//   原「🌙 淫梦织境」与「🎲 欲缘之遇」已移除（两者本就指向同一
//   占位目录 /modules/random/，功能未实现）。
//   如需重新上线：在此追加一项即可，首页卡片墙会自动跟随；
//   若对应目录已删除，同时补回目录与页面。
export const PROJECTS = [
  {
    id: 'sub-archive',
    icon: '🌊',                    // 卡片图标（独立字段，勿写进 name，否则会重复显示）
    name: '欲渊之庭',
    description: '统一档案库，提交真实信息建立属于你的档案',
    url: '/modules/sub-archive/',
    status: 'online',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],
  },
  {
    id: 'content',
    icon: '⛓️',                    // 卡片图标
    name: '欲炼之途',
    description: '玩法 · 见闻 · 见解 —— 发布自己的玩法与见解',
    url: '/modules/content/',
    status: 'online',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],
  },
];