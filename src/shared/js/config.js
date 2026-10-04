// Supabase 配置（保持不变）
export const SUPABASE_URL = 'https://mfexambabgxytkrkhmwx.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZXhhbWJhYmd4eXRrcmtobXd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzcwMTgsImV4cCI6MjA5OTU1MzAxOH0.FdD4EV8fV1mX6J8Vxsio_eyJgkY-_W7SM0M0xvcKN90';

// ★★★ 项目注册表（新可见性矩阵） ★★★
// 访客(guest) 无权访问任何板块
// 普通用户(self) 可访问全部板块
// 认证用户(verified) 可访问全部板块
// 次级管理(subadmin) 可访问全部板块
// 根源管理(admin) 可访问全部板块
//
// 2026-10-03：原「欲主之殿(dom-archive)」与「欲渊之庭(sub-archive)」
// 已合并为单一档案库，不再按上下位分馆；S 与 M 的区分由档案的
// 「身份」字段承担，列表页据用户身份筛选。
export const PROJECTS = [
  {
    id: 'sub-archive',
    name: '🌊 欲渊之庭',
    description: '统一档案库，提交真实信息建立属于你的档案',
    url: '/modules/sub-archive/',
    status: 'online',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],
  },
  {
    id: 'content',
    name: '⛓️ 欲炼之途',
    description: '玩法 · 见闻 · 见解 —— 发布自己的玩法与见解',
    url: '/modules/content/',
    status: 'online',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],
  },
  {
    id: 'dream-weaver',
    name: '🌙 淫梦织境',
    description: '编织梦境与幻想，在场景中尽情发泄',
    url: '/modules/random/',
    status: 'online',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],
  },
  {
    id: 'random',
    name: '🎲 欲缘之遇',
    description: '欲望缘分的偶然相遇，未知的陌生人游戏',
    url: '/modules/random/',
    status: 'online',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],
  },
];