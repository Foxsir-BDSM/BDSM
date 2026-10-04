// 职责    页面访问所需的角色等级定义。
// 归属页面 全站（页面守卫）
// 依赖    无
// 被依赖   shared/js/guard.js 等
//
// 维护提示
//   · 与 guard.js 配合决定「谁能进哪个页面」。放开某页权限时改这里，而不是逐页改 HTML。
/**
 * true  = 放宽模式（当前阶段）
 *           · 路由守卫不做任何重定向，所有页面任何人可访问
 *           · 探索区向所有人展示全部已上线模块
 *           · 登录后才有的能力（发布/管理/个人资料编辑）仍按各自逻辑限制
 *
 * false = 管控模式（发布前恢复）
 *           · 访客仅可访问 landing / about / auth
 *           · 已登录访问 landing / auth 自动跳转控制中心
 *           · 探索区按角色白名单展示模块
 */
export const RELAXED_ACCESS = true;

/** 放宽模式下不受角色白名单限制（仍会过滤 offline） */
export const RELAXED_NOTE =
  'RELAXED_ACCESS = true：全站页面与模块对所有访问者开放，' +
  '发布前请把 src/shared/config/access.js 的 RELAXED_ACCESS 改为 false';
