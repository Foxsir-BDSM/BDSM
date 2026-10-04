#!/usr/bin/env node
/**
 * tools/gen-feature-table.mjs
 * 生成《功能点全量梳理表》—— 列顺序：
 *   文件名 | 归属板块 | 具体功能 | 与哪个功能具有联动效果 | 在哪个页面的容器或按钮进行交互
 *
 * 输出：功能点全量梳理表.md（项目根目录，便于直接查看/编辑）
 *
 * 数据来源：对 src/ 全量源码的逐文件通读 + tools/extract-inventory.mjs 的机械化提取
 * （所有容器名、按钮名、函数名均取自真实代码，非推测）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ══════════════════════════════════════════════════════════════════
// 数据：每行 = [文件名, 归属板块, 具体功能, 联动效果, 交互位置]
// ══════════════════════════════════════════════════════════════════

const P = { launcher: '启动器', admin: '管理后台', shared: '共享层' };
const M = {
  dom: '模块·欲主之殿',
  sub: '模块·欲渊之庭',
  know: '模块·欲识之海',
  miss: '模块·欲炼之途',
  rand: '模块·淫梦织境/欲缘之遇',
};

const SECTIONS = [
  // ─────────────────────────────────────── 一、启动器
  {
    title: '一、启动器（src/launcher/）—— 公开门面 + 控制中心',
    rows: [
      [P.launcher, 'landing.html', '品牌 Logo 展示', '无（静态）', '/landing.html 页 .logo-icon 圆形容器（72px 圆形图 OIP-C.jpg）'],
      [P.launcher, 'landing.html', '主标题与副标题展示', '无（静态）', '/landing.html 页 h1「欲界之门 · 只渡有缘人」+ .subtitle'],
      [P.launcher, 'landing.html', '「立即加入」入口', '→ auth.html 登录注册页', '/landing.html 页 .cta-group > a.btn-primary「🌿 立即加入」'],
      [P.launcher, 'landing.html', '「了解规则」入口', '→ about.html 用户指南', '/landing.html 页 .cta-group > a.btn-secondary「📖 了解规则 →」'],
      [P.launcher, 'landing.html', 'Telegram 作者入口', '外部跳转 t.me/Foxsir0（新窗口）', '/landing.html 页 .social-buttons > a.social-btn.telegram 圆形图标钮'],
      [P.launcher, 'landing.html', 'Twitter/X 作者入口', '外部跳转 twitter.com/foxsir00（新窗口）', '/landing.html 页 .social-buttons > a.social-btn.twitter 圆形图标钮'],
      [P.launcher, 'landing.html', '已登录自动跳转控制中心', '读 auth.getCurrentUser() → 有用户则跳 index.html', '页面加载即触发（无 UI 元素，顶层 await）'],
      [P.launcher, 'landing.html', '响应式（480 / 380px 两档）', '无', '/landing.html 页整页（@media 断点）'],
      [P.launcher, 'landing.html', '底部链接区（已屏蔽）', '登录/关于链接被 HTML 注释包裹', '/landing.html 页 L316-L325 注释块（当前不可见）'],

      [P.launcher, 'about.html', '第一章「这是什么地方」', '展示 6 板块开放状态表', '/about.html 页 .table-wrap 表格（功能板块/状态/说明）'],
      [P.launcher, 'about.html', '第二章「怎么开始」三步引导', '指向 auth.html 注册流程', '/about.html 页 h3 第一步/第二步/第三步 + .info-card「💡 小白提示」'],
      [P.launcher, 'about.html', '第三章 12 身份网格展示', '与 identity-config.js 的 12 身份定义一致', '/about.html 页 .identity-grid > .identity-item ×6（男/女合并展示）'],
      [P.launcher, 'about.html', '第三章 5 角色卡片', '与 ROLE_FIELD_VISIBILITY 5 层角色一致', '/about.html 页 .role-grid > .role-card ×5（含 .role-badge 代码标签）'],
      [P.launcher, 'about.html', '第三章 权限速查表', '对应 guard.js 白名单 + config.js requiredRoles', '/about.html 页 .table-wrap 表格（角色/板块访问/知识任务/档案馆/后台）'],
      [P.launcher, 'about.html', '第四章 功能板块说明', '指向 3 个已开放模块的实际路径', '/about.html 页 .table-wrap 表格 + h3 各模块小节'],
      [P.launcher, 'about.html', '第四章 发布权限说明表', '对应 knowledge/mission 的 checkPermissions() 分层', '/about.html 页 .table-wrap 表格（操作/所需角色/说明）'],
      [P.launcher, 'about.html', '第五章 等级阶梯与积分阈值表', '对应 levelConfig.js 的 LEVEL_THRESHOLDS', '/about.html 页 两张 .table-wrap 表格'],
      [P.launcher, 'about.html', '第五章 积分获取方式表', '⚠️ 5 种方式均未实现（updateUserPoints 无调用者）', '/about.html 页 .table-wrap 表格（方式/积分/说明）'],
      [P.launcher, 'about.html', '第六章 隐私开关说明', '对应 instances.js 的 PRIVACY_RULES 四个控制字段', '/about.html 页 .table-wrap 表格（含 <code> 包裹的字段 ID）'],
      [P.launcher, 'about.html', '第六章 5 角色可见范围矩阵', '对应 ROLE_FIELD_VISIBILITY 白名单', '/about.html 页 .table-wrap 表格（字段分类 × 5 角色）'],
      [P.launcher, 'about.html', '第七章 常见问题 FAQ ×8', '解释积分/身份/认证/隐私开关等', '/about.html 页 h3「Q：…」×8 + p「A：…」'],
      [P.launcher, 'about.html', '第八章 快速指引 8 步表', '串联注册→浏览→发布→完善档案全流程', '/about.html 页 .table-wrap 表格（步骤/操作/说明）'],
      [P.launcher, 'about.html', '第九章 版本信息', '声明 v2.2 / 2026-07-20', '/about.html 页 .table-wrap 表格'],
      [P.launcher, 'about.html', '导航栏跳转', '→ index.html / about.html（当前页）/ admin.html', '/about.html 页 .nav-bar > .nav-links > a ×3'],
      [P.launcher, 'about.html', '页脚返回首页', '→ index.html', '/about.html 页 页脚 a「← 返回首页」'],
      [P.launcher, 'about.html', 'CSS 计数器步骤列表', '无（纯 CSS 组件）', '/about.html 页 .step-list li::before（金色圆形序号）'],

      [P.launcher, 'auth.html', '登录 / 注册 Tab 切换', '切换表单显示 + 重置身份选择器', '/auth.html 页 .tabs > button.tab-btn ×2「登录」「注册」'],
      [P.launcher, 'auth.html', 'Tab 文字链切换', '与 Tab 按钮等价（preventDefault）', '/auth.html 页 .auth-switch > a[data-switch-to]「立即注册」「去登录」'],
      [P.launcher, 'auth.html', '登录提交', '写 localStorage 会话 → 400ms 后跳转（带 ?redirect 回跳）', '/auth.html 页 #login-form > button.btn-primary「进入欲界」'],
      [P.launcher, 'auth.html', '注册提交', '写 8 项 user_metadata → 自动登录 → 跳转', '/auth.html 页 #register-form > button.btn-primary「创建账号」'],
      [P.launcher, 'auth.html', '主身份单选', '决定等级路径（primary_identity / gender / role_type）', '#identity-selector-container 内 .primary-grid > .identity-card ×12'],
      [P.launcher, 'auth.html', '副身份多选', '写入 secondary_identities 数组', '#identity-selector-container 内 .secondary-grid > .secondary-card ×12'],
      [P.launcher, 'auth.html', '身份选择实时提示', '未选主身份时阻止提交并提示', '#identity-selector-container 内 #identity-hint'],
      [P.launcher, 'auth.html', '认证错误本地化', '6 条 Supabase 英文错误 → 中文', '/auth.html 页 #auth-message 消息框（.error / .success）'],
      [P.launcher, 'auth.html', '防重入跳转', 'redirectPending 标记位，避免重复 location.href', '无 UI（内部函数 navigateTo）'],
      [P.launcher, 'auth.html', '全局 Loading 遮罩', '登录/注册期间显示，失败时 hideLoading', '/auth.html 页全屏 #global-loading-overlay（由 loading.js 注入）'],
      [P.launcher, 'auth.html', '返回首页', '→ landing.html', '/auth.html 页 a.back-link「← 返回首页」'],

      [P.launcher, 'index.html', 'Phase 1 三段式启动 Loading', 'loading.js 遮罩 + 时间轴文案推进', '/index.html 页全屏 #global-loading-overlay（含 #loading-text / #loading-bar）'],
      [P.launcher, 'index.html', 'Phase 2 路由守卫', 'guard.js 拦截未登录用户', '页面加载即触发（<script type="module">）'],
      [P.launcher, 'index.html', '顶栏用户菜单（类微信右上角）', '收起态仅头像+昵称+身份；展开含 我的 / 个人资料 / 管理面板（管理员）/ 退出登录；未登录显示注册入口', '/index.html 页 .top-bar > .user-menu#topUserInfo（触发区 #umTrigger）'],
      [P.launcher, 'index.html', '用户菜单展开', '点击触发区；Enter/Space 亦可；aria-expanded 同步', '/index.html 页 #umTrigger'],
      [P.launcher, 'index.html', '用户菜单关闭', '点外部 / Esc / 窗口 resize 三种方式', '/index.html 页 #umTrigger 与 document 全局监听'],
      [P.launcher, 'index.html', '菜单：我的入口', '→ my.html（个人留痕中心）', '/index.html 页 .um-item[href="/my.html"]「🗂️ 我的」'],
      [P.launcher, 'index.html', '菜单：个人资料入口', '→ profile.html', '/index.html 页 .um-item[href="/profile.html"]「👤 个人资料」'],
      [P.launcher, 'index.html', '菜单：管理面板入口', '角色 admin/subadmin 时出现 → admin.html', '/index.html 页 .um-item「⚙️ 管理面板」'],
      [P.launcher, 'index.html', '菜单：退出登录', 'signOut → 清 foxsir_session → 跳 landing', '/index.html 页 .um-item.is-danger#umLogoutBtn「🚪 退出登录」'],
      [P.launcher, 'index.html', '菜单：游客态', '虚线头像占位 + 注册/登录 + 了解规则 + 返回引导页', '/index.html 页 .um-panel（未登录时）'],
      [P.launcher, 'index.html', '欢迎卡片展示', '文案 + OIP-B.jpg 背景渐变融合', '/index.html 页 section.welcome-card（左 .welcome-text + 右 .welcome-image）'],
      [P.launcher, 'index.html', '「了解规则」入口', '→ about.html', '/index.html 页 .welcome-text > a.btn-about「📖 了解规则 →」'],
      [P.launcher, 'index.html', '探索区模块卡片渲染', 'registry.getVisibleProjects(role) → 6 张卡（放宽模式下对所有人可见）', '/index.html 页 section.projects-section > .project-grid#projectGrid'],
      [P.launcher, 'index.html', '模块卡进入', '→ 各模块 URL（/modules/<mod>/）', '/index.html 页 .project-card 整卡 <a>（hover 上浮 + 箭头右移）'],
      [P.launcher, 'index.html', '模块卡状态标签', 'online / maintenance（橙）/ offline（红）——⚠️ 当前全部 online', '/index.html 页 .project-card > span.status-tag'],
      [P.launcher, 'index.html', '移动端卡片结构切换', 'innerWidth ≤ 480 走不同 DOM（横向卡 + .text-group）', '/index.html 页 .project-grid（JS 分支渲染）'],
      [P.launcher, 'index.html', '窗口尺寸监听重绘', 'resize 时重渲染项目网格', 'window resize 事件（无防抖）'],
      [P.launcher, 'index.html', '渲染超时兜底', 'Promise.race 8 秒，失败保留已渲染部分', '无 UI（内部逻辑）'],
      [P.launcher, 'index.html', 'Toast 通知', '毛玻璃 + 边框变色 + 进出动画', '/index.html 页 .toast-container#toastContainer（右下角堆叠）'],
      [P.launcher, 'index.html', '页脚', '「✦ 以安全、尊重、共识为核心 ✦」', '/index.html 页 .footer'],

      [P.launcher, 'my.html', '★ 个人留痕中心（类抖音个人页）', '后续承载账号在平台内的全部留痕：粉丝/关注/档案/任务/内容', '/my.html 页整页'],
      [P.launcher, 'my.html', '个人名片头部', '头像 + 昵称 + 标签行（主身份/等级/角色/副身份）+ 邮箱与加入日期', '/my.html 页 section.hero（#heroAvatar / #heroName / #heroTags / #heroSub）'],
      [P.launcher, 'my.html', '数据栏 · 关注', '🔲 待开放（占位 —，数据模型未建）', '/my.html 页 #statFollowing'],
      [P.launcher, 'my.html', '数据栏 · 粉丝', '🔲 待开放（占位 —，数据模型未建）', '/my.html 页 #statFollowers'],
      [P.launcher, 'my.html', '数据栏 · 积分与等级', 'formatPoints 格式化 + calculateLevel 称号', '/my.html 页 #statPoints / #statLevel'],
      [P.launcher, 'my.html', 'Tab：我的档案', '按昵称匹配 Fillout 档案 → 命中显示姓名/记录 ID/查看入口；未命中如实告知匹配依据', '/my.html 页 .tab[data-tab=archive] + #archiveKv'],
      [P.launcher, 'my.html', 'Tab：接取的任务', '🔲 空态（接取/返图/进度留痕待开发），计数 0', '/my.html 页 .tab[data-tab=missions] + #cntMissions + #missionList'],
      [P.launcher, 'my.html', 'Tab：发布的内容', '★ 真实读取 GitHub 内容，按 author_nickname 归集知识区+任务区并跳详情', '/my.html 页 .tab[data-tab=posts] + #cntPosts + #postList'],
      [P.launcher, 'my.html', 'Tab：关系（预留）', '🔲 关注列表/粉丝列表/互动留痕 三块占位', '/my.html 页 .tab[data-tab=relation] + #panel-relation'],
      [P.launcher, 'my.html', '身份信息区', '主身份（标签+定位+性别+上下位）/ 副身份 / 等级 / 积分含距下一级 / 平台角色', '/my.html 页 #identityKv'],
      [P.launcher, 'my.html', '未登录态', '游客卡：说明留痕定位 + 注册登录 + 先去逛逛', '/my.html 页 #guestCard'],
      [P.launcher, 'my.html', '编辑资料入口', '→ profile.html', '/my.html 页 .hero-actions > a.btn-primary「✏️ 编辑资料」'],
      [P.launcher, 'my.html', '去档案馆入口', '→ /modules/sub-archive/', '/my.html 页 .hero-actions > a.btn-ghost「🌊 去档案馆」'],
      [P.launcher, 'my.html', '骨架屏', '发布内容加载中显示 shimmer 占位（.sk）', '/my.html 页 #postList 加载态'],

      [P.launcher, 'profile.html', '个人资料页', '头像更换 / 昵称编辑 / 身份等级只读展示 / 登出', '/profile.html 页整页'],
      [P.launcher, 'profile.html', '头像更换', 'hover 遮罩 → 类型与大小校验（≤5MB）→ Canvas 压缩 200×200 WebP → Storage → metadata', '/profile.html 页 .avatar-big#avatarBox + 隐藏 input#avatarFile'],
      [P.launcher, 'profile.html', '昵称编辑与保存', '≤24 字；改动启用保存；保存后同步 localStorage 会话供其他页面即时读取', '/profile.html 页 input#nicknameInput + button#saveBtn「保存修改」'],
      [P.launcher, 'profile.html', '昵称还原', '回到原始昵称并禁用保存', '/profile.html 页 button#resetBtn「还原」'],
      [P.launcher, 'profile.html', '邮箱只读展示', '作为登录凭据，不可修改', '/profile.html 页 input#emailInput（disabled）'],
      [P.launcher, 'profile.html', '身份与等级展示', '主身份/副身份/等级含积分与距下一级/平台角色（只读信息行，为后续自助修改预留）', '/profile.html 页 #primaryIdentity / #secondaryIdentity / #levelInfo / #roleInfo'],
      [P.launcher, 'profile.html', '退出登录', 'signOut → 跳转', '/profile.html 页 button#logoutBtn「退出登录」'],
      [P.launcher, 'profile.html', '未登录态', '游客卡 + 注册登录 + 先去逛逛', '/profile.html 页 #guestCard'],


      [P.launcher, 'module.html', '模块信息查询', 'registry.getVisibleProjects(role) 查找 ?id=', '/module.html 页 #moduleDetail 容器'],
      [P.launcher, 'module.html', '状态徽章', 'maintenance「🔧 维护中」/ offline「⛔ 暂不可用」', '/module.html 页 #moduleDetail 内 .status-badge'],
      [P.launcher, 'module.html', '已登录进入模块', '→ project.url', '/module.html 页 .cta-area > a.btn-primary「进入 <模块名>」'],
      [P.launcher, 'module.html', '未登录解锁引导', '→ landing.html?redirect=<当前URL>', '/module.html 页 .cta-area > a.btn-primary「登录后解锁」'],
      [P.launcher, 'module.html', '返回探索', '→ index.html（原锚点 #modules-section 已失效，重构时修正）', '/module.html 页 a.back-link「← 返回探索」'],

      [P.launcher, '404.html', '404 错误页', '无（静态，无 JS）', '/404.html 页 a「返回首页」'],
    ],
  },

  // ─────────────────────────────────────── 二、管理后台
  {
    title: '二、管理后台（src/admin/）—— 管理员操作台',
    rows: [
      [P.admin, 'admin.html', '管理规则横幅', '引导管理员谨慎操作（⚠️「记录日志」未实现）', '/admin.html 页 .rule-banner（OIP-A.jpg + .rule-text）'],
      [P.admin, 'admin.html', 'Tab 切换（三个面板）', 'admin.js Tab 切换逻辑 + .tab-pane.active', '/admin.html 页 nav.tab-nav > button.tab-btn ×3（data-tab=userPerm/domArchive/subArchive）'],
      [P.admin, 'admin.html', '用户权限面板', '仅 admin 可见（subadmin 时被 JS 整体替换）', '/admin.html 页 #pane-userPerm'],
      [P.admin, 'admin.html', '上位档案占位', '开发中提示', '/admin.html 页 #pane-domArchive > .coming-soon「🚧 上位档案馆尚未接入」'],
      [P.admin, 'admin.html', '下位档案面板', 'subadmin + admin 均可操作', '/admin.html 页 #pane-subArchive'],
      [P.admin, 'admin.html', '管理员身份显示', '邮箱 + 角色中文名', '/admin.html 页 #adminUserInfo'],
      [P.admin, 'admin.html', '管理后台登出', 'signOut → 跳首页', '/admin.html 页 button#adminLogoutBtn「登出」'],

      [P.admin, 'admin.js', 'Tab 切换逻辑', '切换 .tab-btn.active 与 .tab-pane.active', '/admin.html 页 → 由 .tab-btn 点击触发'],
      [P.admin, 'admin.js', '用户列表加载', 'supabase.rpc(get_all_users)', '入口在 /admin.html 页（initAdmin 自动调用）'],
      [P.admin, 'admin.js', '用户角色排序', 'ROLE_ORDER：admin→subadmin→verified→self', '/admin.html 页 #userTableContainer 表格行顺序'],
      [P.admin, 'admin.js', '用户表格渲染（4 列）', '昵称｜邮箱｜当前角色徽章｜新角色下拉', '/admin.html 页 #userTableContainer > table.admin-table'],
      [P.admin, 'admin.js', '角色彩色徽章', 'admin 深红 / subadmin 橙 / verified 蓝 / self 灰', '/admin.html 页 #userTableContainer 内 span.role-badge.role-<role>'],
      [P.admin, 'admin.js', '用户搜索筛选', '匹配昵称 + 邮箱（大小写不敏感）', '/admin.html 页 input#userSearchInput（placeholder「🔍 搜索昵称或邮箱…」）'],
      [P.admin, 'admin.js', '筛选计数联动', '显示「共 N 位用户（筛选后 M 位）」', '/admin.html 页 #pane-userPerm .stats-label'],
      [P.admin, 'admin.js', '角色变更暂存（pendingChanges）', '与原始值比对，相同则移除；驱动 Push 按钮 disabled', '/admin.html 页 #userTableContainer 内 select.role-select（change 事件）'],
      [P.admin, 'admin.js', 'Push 生效（用户角色）', '逐个 rpc(update_user_role) + 成功/失败统计', '/admin.html 页 button#pushBtn「📤 Push 生效」（角色变更后才可点）'],
      [P.admin, 'admin.js', 'Push 结果提示', '「✅ 成功更新 N 位用户，❌ 失败 M 位」+ Toast', '/admin.html 页 #pushResult + .toast-container'],
      [P.admin, 'admin.js', '下位档案加载', 'api.fetchAllRecords(true) 强制绕过缓存', '入口在 /admin.html 页（initAdmin 自动调用）'],
      [P.admin, 'admin.js', '档案表格渲染（8 列）', '姓名 + 6 个隐私开关 + 状态', '/admin.html 页 #subRecordsContainer > table.admin-table'],
      [P.admin, 'admin.js', '隐私开关勾选', '记入 pendingSubChanges，显示橙色「待保存」', '/admin.html 页 .sub-check 复选框 ×6（公开问卷/常住地址/联系方式/生活照片/隐私照片/认证）'],
      [P.admin, 'admin.js', 'Push 下位档案变更（动态注入按钮）', 'PATCH Fillout + 乐观更新 + 清缓存 + 重拉', '/admin.html 页 #pane-subArchive .toolbar .right 内动态创建的「📤 Push 下位档案变更」'],
      [P.admin, 'admin.js', '档案搜索', '匹配姓名', '/admin.html 页 input#subSearchInput（placeholder「🔍 搜索姓名」）'],
      [P.admin, 'admin.js', '档案计数联动', '共 N 条档案', '/admin.html 页 #subTotalCount'],
      [P.admin, 'admin.js', '初始化权限判定', '非管理员 → Toast + 2 秒后跳首页', '入口在 /admin.html 页（页面加载即触发）'],
      [P.admin, 'admin.js', 'subadmin 降级处理', '隐藏用户权限 Tab + 面板替换为「🔒 仅限根源管理」', '/admin.html 页 .tab-btn[data-tab=userPerm] 与 #pane-userPerm'],

      [P.admin, 'admin-article.html', 'GitHub Token 输入', 'password 类型输入框', '/admin-article.html 页 #tokenSection > input#githubToken'],
      [P.admin, 'admin-article.html', 'Token 保存', '写 localStorage foxsir_github_token', '/admin-article.html 页 button#saveTokenBtn「保存 Token」'],
      [P.admin, 'admin-article.html', 'Token 状态显示', '「✅ 已配置（localStorage/环境变量）」/「❌ 未配置」', '/admin-article.html 页 span#tokenStatus'],
      [P.admin, 'admin-article.html', '发布目标切换', '知识区 / 任务区（切分支与目录）', '/admin-article.html 页 .publish-target > button.target-btn ×2「📚 知识区」「🎯 任务区」'],
      [P.admin, 'admin-article.html', '管理员鉴权', '非 admin/subadmin → alert 后跳首页', '入口在 /admin-article.html 页（页面加载即触发 checkAuth）'],
      [P.admin, 'admin-article.html', '作者自动填充', 'meta.nickname → 回退 email 前缀', '/admin-article.html 页 input#editAuthor'],
      [P.admin, 'admin-article.html', '表单：标题', '必填，用于生成 slug 与文件名', '/admin-article.html 页 input#editTitle'],
      [P.admin, 'admin-article.html', '表单：分类', '6 个选项（4 知识 + 2 任务）', '/admin-article.html 页 select#editCategory'],
      [P.admin, 'admin-article.html', '表单：摘要', '可空，写入 frontmatter.summary', '/admin-article.html 页 input#editSummary'],
      [P.admin, 'admin-article.html', '表单：封面图 URL', '可空，写入 frontmatter.cover_url', '/admin-article.html 页 input#editCover'],
      [P.admin, 'admin-article.html', 'EasyMDE 编辑器', 'Markdown 编辑 + 预览 + 全屏', '/admin-article.html 页 #editorContainer（15 项工具栏）'],
      [P.admin, 'admin-article.html', '发布内容', '拼 frontmatter → base64 → GitHub PUT', '/admin-article.html 页 button#publishBtn「🚀 发布」'],
      [P.admin, 'admin-article.html', '清空表单', '重置全部字段 + 编辑器', '/admin-article.html 页 button#clearBtn「清空」'],
      [P.admin, 'admin-article.html', '发布状态提示', 'loading / success / error 三态', '/admin-article.html 页 #statusMsg'],
      [P.admin, 'admin-article.html', '已发布列表加载', 'GitHub contents API 过滤 .md', '/admin-article.html 页 #listContainer'],
      [P.admin, 'admin-article.html', '发布后清缓存', 'clearKnowledgeCache / clearTaskCache', '无 UI（发布成功后自动执行）'],
      [P.admin, 'admin-article.html', '⚠️ 列表无删除按钮', '缺失功能（删除在知识/任务区管理模式内）', '/admin-article.html 页 #listContainer（仅文本行）'],

      [P.admin, 'admin-article-simple.html', '零构建依赖编辑器', '全局 script 引入 EasyMDE（失败降级为 textarea）', '/admin-article-simple.html 页 #editorTextarea'],
      [P.admin, 'admin-article-simple.html', 'Token 输入与保存', '同完整版（localStorage）', '/admin-article-simple.html 页 input#tokenInput + button#saveTokenBtn「保存」'],
      [P.admin, 'admin-article-simple.html', '发布目标切换', '知识区 / 任务区', '/admin-article-simple.html 页 .target-tabs > button.tab ×2'],
      [P.admin, 'admin-article-simple.html', '发布表单', '标题/作者/分类/摘要/封面/正文', '/admin-article-simple.html 页 #title #author #category #summary #cover'],
      [P.admin, 'admin-article-simple.html', '发布内容', '同完整版逻辑（内联实现）', '/admin-article-simple.html 页 button#publishBtn「🚀 发布」'],
      [P.admin, 'admin-article-simple.html', '清空表单', '重置全部字段', '/admin-article-simple.html 页 button#clearBtn「清空」'],
      [P.admin, 'admin-article-simple.html', '⚠️ 无鉴权', '任何人可用（安全缺口）', '入口在 /admin-article-simple.html 页（无 checkAuth）'],
      [P.admin, 'admin-article-simple.html', '⚠️ import.meta 语法错误', '非 module script 中使用 import.meta（既有缺陷）', '/admin-article-simple.html 页 L207 getEnvToken（控制台报 SyntaxError）'],

      [P.admin, 'content-config.js', 'GitHub 仓库配置', 'owner / repo / branches / paths', '被 content-manager.js 与两个内容管理页 import'],
      [P.admin, 'content-config.js', 'CDN 直读地址生成', 'getCdnUrl（jsdelivr）——⚠️ 全站零调用', '无 UI（未启用）'],
      [P.admin, 'content-config.js', 'GitHub API 地址生成', 'getApiUrl（contents API）', '被知识区/任务区详情页 import 使用'],

      [P.admin, 'content-manager.js', 'Token 获取（环境变量优先）', 'import.meta.env.VITE_GITHUB_TOKEN → localStorage', '被知识区/任务区/详情页 import'],
      [P.admin, 'content-manager.js', '内容列表拉取（5 分钟缓存）', 'fetchContentList + getCacheWithMeta', '被知识区/任务区列表页调用'],
      [P.admin, 'content-manager.js', '强制刷新列表', 'fetchContentListForce（先清缓存）', '被「🔄 刷新」按钮调用'],
      [P.admin, 'content-manager.js', '缓存剩余时间显示', 'getCacheRemainingTime（调试用）', '无 UI（控制台日志）'],
      [P.admin, 'content-manager.js', '获取文件 SHA', 'getFileSha（用于更新/删除）', '被 createOrUpdateContent / deleteContent 内部调用'],
      [P.admin, 'content-manager.js', '创建或更新文件', 'base64 编码 → GitHub PUT（UTF-8 安全）', '被知识区/任务区发布流程调用'],
      [P.admin, 'content-manager.js', '删除文件', 'getFileSha → GitHub DELETE', '被知识区/任务区「🗑️ 删除」调用'],
      [P.admin, 'content-manager.js', 'Frontmatter 解析', 'title/slug/category/summary/cover/author 等', '被列表页与详情页调用（⚠️ 详情页另有内联副本）'],
      [P.admin, 'content-manager.js', 'Slug 生成', '小写→去特殊字符→空格转-→截断 50', '被发布表单输入标题时自动调用'],
      [P.admin, 'content-manager.js', 'Frontmatter 构建', '含作者昵称与邮箱', '被发布流程调用'],
    ],
  },

  // ─────────────────────────────────────── 三、欲渊之庭
  {
    title: '三、模块 · 欲渊之庭（src/modules/sub-archive/）—— 下位者档案馆【功能最重】',
    rows: [
      [M.sub, 'index.html', '顶部 Logo 展示', '无（静态）', '/modules/sub-archive/ 页 .logo-icon + .logo-text「Foxsir档案库」'],
      [M.sub, 'index.html', '返回首页', '→ index.html 控制中心', '/modules/sub-archive/ 页 a.btn-home「🏠 首页」'],
      [M.sub, 'index.html', '「母の曝光」提交档案', '新窗口打开 Fillout 表单（CONFIG.FORM_URL）', '/modules/sub-archive/ 页 button#btnFillForm「母の曝光」（暖琥珀渐变，视觉重心）'],
      [M.sub, 'index.html', '搜索框输入', '前端过滤 SEARCH_FIELDS（姓名/职业学历/常住地址），重置到第 1 页', '/modules/sub-archive/ 页 input#searchInput（placeholder「搜索姓名、职业或地区…」）'],
      [M.sub, 'index.html', '搜索清除按钮', '清空 + 重置分页 + 重新聚焦', '/modules/sub-archive/ 页 span#searchClear（✕，有内容时才 .visible）'],
      [M.sub, 'index.html', '结果计数显示', '「共 N 位」', '/modules/sub-archive/ 页 #searchStats'],
      [M.sub, 'index.html', '卡片网格渲染', '响应式 7 档列数（≥1800px 7 列 → ≤599px 2 列）', '/modules/sub-archive/ 页 .grid-container#gridContainer'],
      [M.sub, 'index.html', '卡片主图与占位', '生活照 → 照片2 兜底 → 内联 SVG「暂无图片」；受隐私控制', '/modules/sub-archive/ 页 .card > .card-image-wrap > img[loading=lazy]'],
      [M.sub, 'index.html', '认证徽章', 'fwK2mQMoxto 为真时显示 ✅', '/modules/sub-archive/ 页 .card-image-wrap > .verified-badge'],
      [M.sub, 'index.html', '图片底部字幕', '姓名（20px 粗体）+ 年龄', '/modules/sub-archive/ 页 .card-image-caption'],
      [M.sub, 'index.html', '📍 地区展示', '受 f1s9DJg4oLc 控制，未公开显示「未公开」', '/modules/sub-archive/ 页 .card-footer .info-row（第 1 行）'],
      [M.sub, 'index.html', '📏 身高 / ⚖ 体重展示', '⚠️ 空值仍拼接 cm/kg', '/modules/sub-archive/ 页 .card-footer .row-height-weight'],
      [M.sub, 'index.html', '★ 推荐指数星级', '10 星制，无值显示「暂无评分」', '/modules/sub-archive/ 页 .card-footer .stars-row > .stars-container'],
      [M.sub, 'index.html', '卡片进入详情', '→ detail.html?id=<recordId>', '/modules/sub-archive/ 页 .card 整卡 onclick'],
      [M.sub, 'index.html', '无限滚动加载', '距底 150px 自动加载下一页（100ms 防抖）', '/modules/sub-archive/ 页 .main-content（滚动监听容器）'],
      [M.sub, 'index.html', '加载更多指示器', '四态：加载中/滚动加载更多/已加载全部/加载失败', '/modules/sub-archive/ 页 #loadMoreIndicator'],
      [M.sub, 'index.html', '初始加载状态', 'spinner + 「加载中…」', '/modules/sub-archive/ 页 #stateMessage'],
      [M.sub, 'index.html', '控制台清缓存钩子', 'window.clearArchiveCache() 清缓存并刷新', '控制台调用（无 UI 按钮）'],

      [M.sub, 'detail.html', '返回列表', '→ ./index.html', '/modules/sub-archive/detail.html 页 a.btn-back「← 返回列表」'],
      [M.sub, 'detail.html', '标题展示', '「👤 <姓名>の档案」', '/modules/sub-archive/detail.html 页 #detailContainer > .detail-title'],
      [M.sub, 'detail.html', '📋 基本信息分组渲染', '17 个字段，两列键值网格（标签 140px）', '/modules/sub-archive/detail.html 页 .detail-group[data-group=basic]'],
      [M.sub, 'detail.html', '📸 生活写照分组渲染', '4 个字段，媒体网格（标签在图片下方）', '/modules/sub-archive/detail.html 页 .detail-group[data-group=photos_life]'],
      [M.sub, 'detail.html', '🔥 亲密经历分组渲染', '19 个字段，两列键值网格', '/modules/sub-archive/detail.html 页 .detail-group[data-group=intimate]'],
      [M.sub, 'detail.html', '🔞 私密影像分组渲染', '5 个字段，毛玻璃 + 红边框 + 「🔒 隐私内容」警告条', '/modules/sub-archive/detail.html 页 .detail-group[data-group=photos_private]'],
      [M.sub, 'detail.html', '角色权限过滤', 'ROLE_FIELD_VISIBILITY 白名单', '无 UI（渲染时过滤）'],
      [M.sub, 'detail.html', '隐私开关过滤', 'PRIVACY_DEPENDENCIES，⚠️ 用严格 === true（与列表页宽松判定不一致）', '无 UI（渲染时过滤）'],
      [M.sub, 'detail.html', '空值字段隐藏', 'isEmptyValue 判定后剔除', '无 UI（渲染时过滤）'],
      [M.sub, 'detail.html', '空分组隐藏 / 全空提示', '全空显示「🔒 当前角色无权查看此档案内容」', '/modules/sub-archive/detail.html 页 #detailContainer > .state-message'],
      [M.sub, 'detail.html', '媒体横竖屏自动分类', '运行时探测真实像素（5 秒超时兜底）', '/modules/sub-archive/detail.html 页 .media-row.portrait-row / .landscape-row'],
      [M.sub, 'detail.html', '视频缩略图与播放图标', '视频排在图片之后，带 ▶ 图标', '/modules/sub-archive/detail.html 页 .media-item > video + .media-play-icon'],
      [M.sub, 'detail.html', '空媒体分组隐藏', '无有效媒体时整组不渲染', '无 UI（渲染时过滤）'],
      [M.sub, 'detail.html', '🖼️ 图片 Lightbox', '大图查看 + 单击关闭 + 双击 1.8× 缩放 + Esc 关闭 + ✕ 按钮', '/modules/sub-archive/detail.html 页 .lightbox-overlay（含 .lightbox-close / .lightbox-image-wrap / .lightbox-image / .lightbox-loading）'],
      [M.sub, 'detail.html', '▶ 视频全屏播放器', 'autoplay + controls + playsinline，关闭时 pause', '/modules/sub-archive/detail.html 页 .lightbox-overlay.lightbox-video（含 .lightbox-video-wrap > video）'],
      [M.sub, 'detail.html', '多图画廊', '同字段多图渲染为 .image-gallery', '/modules/sub-archive/detail.html 页 .detail-group 内 .image-gallery'],
      [M.sub, 'detail.html', '特殊字段渲染：星级', '颜值 f99RpESRNBX / 身材 fb483ZvPoMH → 10 星', '/modules/sub-archive/detail.html 页 对应 .detail-field-value'],
      [M.sub, 'detail.html', '特殊字段渲染：单位', '身高 cm / 体重 kg / 深喉·淫穴·菊穴最深 cm', '/modules/sub-archive/detail.html 页 对应 .detail-field-value'],
      [M.sub, 'detail.html', '布尔值渲染', 'true → 「是」/ false → 「否」', '/modules/sub-archive/detail.html 页 对应 .detail-field-value'],
      [M.sub, 'detail.html', '数组值渲染', '逗号拼接', '/modules/sub-archive/detail.html 页 对应 .detail-field-value'],
      [M.sub, 'detail.html', 'HTML 转义（XSS 防护）', 'escapeHtml 五字符转义（全站唯一做转义的页面）', '无 UI（安全处理）'],
      [M.sub, 'detail.html', '内存泄漏防护', 'MutationObserver 检测 overlay 移出后清理 keydown 监听', '无 UI（内部处理）'],
      [M.sub, 'detail.html', '⚠️ 缺 ?id 参数提示', '显示「⚠️ 缺少记录 ID」', '/modules/sub-archive/detail.html 页 #detailContainer > .state-message'],

      // admin.html 已归档（旧版独立后台，2026-10-05），档案管理统一走 /admin.html 的「全部档案」
      [M.sub, 'js/api.js', '分页拉取记录（5 分钟缓存）', 'fetchRecordsPage（PAGE_SIZE=20）', '被列表页 loadPage 调用'],
      [M.sub, 'js/api.js', '全量拉取记录（5 分钟缓存）', 'fetchRecords（管理后台用）', '被管理后台 loadSubRecords 调用'],
      [M.sub, 'js/api.js', '单条记录拉取', 'fetchRecordById（无缓存）', '被详情页 init 调用'],
      [M.sub, 'js/api.js', '清空档案缓存', 'clearCache（清所有 foxsir_sub_archive_cache_*）', '被管理后台与 window.clearArchiveCache 调用'],
      [M.sub, 'js/api.js', '全量拉取别名', 'fetchAllRecords（兼容管理后台）', '被 admin.js import'],
      [M.sub, 'js/api.js', '更新记录字段（白名单）', 'PATCH Fillout，仅允许 6 个隐私字段', '被管理后台 Push 流程调用'],

      [M.sub, 'js/config.js', '从共享配置重新导出', 'FIELD_LABELS / DETAIL_GROUPS / PRIVACY_RULES 等 11 项', '被 utils.js / detail.js / home.js import'],
      [M.sub, 'js/config.js', 'Fillout API 配置', 'DATABASE_ID / TABLE_ID / API_KEY / FORM_URL / DEFAULT_IMAGE', '被 api.js 与「母の曝光」按钮使用'],
      [M.sub, 'js/config.js', '分页与缓存常量', 'PAGE_SIZE=20 / CACHE_KEY / CACHE_TTL=5min', '被 api.js 与 home.js 使用'],

      [M.sub, 'js/utils.js', '字段取值（data 优先）', 'getFieldValue：record.data → record.fields', '被列表页与详情页调用'],
      [M.sub, 'js/utils.js', '附件 URL 提取', 'extractFileUrl / extractFileUrls（容错 5 种形态）', '被卡片与媒体渲染调用'],
      [M.sub, 'js/utils.js', '卡片主图取值', 'getCardImage：隐私检查 → photo → photoFallback → 占位图', '被列表页 renderAllCards 调用'],
      [M.sub, 'js/utils.js', '卡片姓名取值', 'getCardName：name → nameFallback → 对象 .name → 「未命名」', '被列表页调用'],
      [M.sub, 'js/utils.js', '卡片年龄取值', 'getCardAge', '被列表页调用'],
      [M.sub, 'js/utils.js', '卡片信息聚合', 'getCardInfo：area（隐私）/height/weight/recommend/verified', '被列表页调用'],
      [M.sub, 'js/utils.js', '图片类型判定', 'isImageValue（扩展名正则 + 数组递归）', '被详情页调用'],
      [M.sub, 'js/utils.js', '角色 + 隐私双过滤', 'filterFieldsByRoleAndPrivacy（★ 隐私对所有角色生效，含 admin）', '被详情页 renderDetail 调用'],
      [M.sub, 'js/utils.js', '⚠️ 未使用导出', 'getBusinessFields / getGroupedBusinessFields / filterFieldsByRole（死代码）', '无调用者'],

      [M.sub, 'js/home.js', '公开问卷准入过滤', 'isPublic：仅 fgerzjJpBTF 为真的记录入列表', '无 UI（数据过滤）'],
      [M.sub, 'js/home.js', '前端排序', 'sortByLatest：按编号 fxwUAnrwpaT 降序', '无 UI（数据排序）'],
      [M.sub, 'js/home.js', '星级生成', 'generateStars：10 星制 ★/☆', '被卡片渲染调用'],
      [M.sub, 'js/home.js', '认证判定', 'isVerified：容忍 true/「是」/「认证」/1', '被卡片渲染调用'],
      [M.sub, 'js/home.js', '全量重绘卡片', 'renderAllCards（无虚拟 DOM）', '影响 .grid-container#gridContainer'],
      [M.sub, 'js/home.js', '分页加载与去重', 'loadPage（按 id 去重）', '无 UI（数据逻辑）'],
      [M.sub, 'js/home.js', '⚠️ hasMore 判定缺陷', '过滤后数量 vs 服务端总数比较 → 永远无法「已加载全部」', '影响 #loadMoreIndicator 文案'],
      [M.sub, 'js/home.js', '⚠️ 滚动监听容器缺陷', '绑定 .main-content 但该元素无 overflow', '影响无限滚动是否生效'],

      [M.sub, 'js/detail.js', 'HTML 转义', 'escapeHtml（5 字符）', '无 UI（安全处理）'],
      [M.sub, 'js/detail.js', 'URL 取记录 ID', 'getRecordIdFromUrl（?id=）', '无 UI'],
      [M.sub, 'js/detail.js', '视频类型判定', 'isVideoValue（8 种格式双正则）', '被媒体分组调用'],
      [M.sub, 'js/detail.js', '媒体尺寸探测', 'loadMediaInfo（Image/video 探测 + 5 秒超时）', '被 collectAndSortMedia 调用'],
      [M.sub, 'js/detail.js', '横竖屏分类', 'collectAndSortMedia（视频排最后）', '影响 .portrait-row / .landscape-row'],
      [M.sub, 'js/detail.js', '字段映射构建', 'buildFieldMap（跳过 id/createdAt/updatedAt）', '无 UI'],
      [M.sub, 'js/detail.js', '按配置分组', 'buildGroupedFieldsFromConfig（按 DETAIL_GROUPS 顺序）', '影响详情页分组顺序'],
      [M.sub, 'js/detail.js', '三级过滤管线', '空值 → 权限+隐私 → 空分组', '无 UI'],
      [M.sub, 'js/detail.js', '全局 Lightbox 挂载', 'window.showLightbox / window.showVideoLightbox', '供内联 onclick 调用'],
      [M.sub, 'js/detail.js', '⚠️ 死文件', 'js/auth.js 与 js/admin.js 旧版实现（无引用/异常）', '无入口'],

      [P.shared, 'config/archive/instances.js', '字段标签映射（57 项）', 'FIELD_LABELS：Fillout 字段 ID → 中文标签', '被详情页 buildFieldMap 使用'],
      [P.shared, 'config/archive/instances.js', '首页卡片字段映射（9 项）', 'CARD_FIELDS：photo/name/age/area/height/weight/recommend/verified', '被 utils.js 卡片函数使用'],
      [P.shared, 'config/archive/instances.js', '搜索字段（3 项）', 'SEARCH_FIELDS：姓名/职业学历/常住地址', '被列表页 handleSearch 使用'],
      [P.shared, 'config/archive/instances.js', '详情页分组（4 组 45 字段）', 'DETAIL_GROUPS：basic/photos_life/intimate/photos_private', '决定详情页渲染顺序与分组'],
      [P.shared, 'config/archive/instances.js', '详情字段顺序派生', 'DETAIL_FIELD_ORDER（getter，自动 flatMap）', '被 config.js 导出'],
      [P.shared, 'config/archive/instances.js', '系统字段排除', 'SYSTEM_FIELD_IDS（Source）', '无 UI（过滤）'],
      [P.shared, 'config/archive/instances.js', '首页专用字段排除（4 项）', 'HOME_ONLY_FIELD_IDS：公开问卷/推荐指数/认证/ID', '无 UI（详情页过滤）'],
      [P.shared, 'config/archive/instances.js', '额外排除字段（2 项）', 'EXTRA_EXCLUDED_FIELD_IDS：我已知悉/继续填写', '无 UI（过滤）'],
      [P.shared, 'config/archive/instances.js', '隐私控制规则（4 条）', 'PRIVACY_RULES：控制字段 → 受控展示字段', '被 utils.js 与详情页过滤使用'],
      [P.shared, 'config/archive/instances.js', '隐私依赖反查表（11 条）', 'PRIVACY_DEPENDENCIES：受控字段 → 控制字段', '被 filterFieldsByRoleAndPrivacy 使用'],
      [P.shared, 'config/archive/instances.js', '角色字段白名单（5 角色）', 'ROLE_FIELD_VISIBILITY：38~45 项/角色', '决定各角色可见字段'],
      [P.shared, 'config/archive/instances.js', '档案库单一实例', 'ARCHIVE_INSTANCES 仅含 sub-archive（原 dom-archive 已合并删除）', '无 UI'],

      [P.shared, 'config/archive/schema.js', '隐私通过判定（宽松）', 'isPrivacyApproved：true/「是」/「true」/1/「TRUE」', '被 utils.js 卡片函数使用'],
      [P.shared, 'config/archive/schema.js', '角色字段可见判定', 'isFieldVisibleForRole', '被 config.js 重新导出'],
      [P.shared, 'config/archive/schema.js', '单字段隐私判定', 'isPrivacyApprovedForField', '被 config.js 重新导出（无直接调用者）'],

      [P.shared, 'config/archive/index.js', '统一导出入口', 'export * from schema.js + instances.js', '无直接 import 者'],
    ],
  },

  // ─────────────────────────────────────── 四、欲炼之途（内容板块）
  {
    title: '四、模块 · 欲炼之途（src/modules/content/）—— 玩法 · 见闻 · 见解',
    rows: [
          [M.content, 'index.html', '统一列表页', '类型筛选 + 标签筛选（6 维度）+ 搜索 + 风险过滤', '首页'],
          [M.content, 'index.html', '类型筛选', '全部 / 玩法任务 / 主题合集 / 分级清单 / 见解随笔', '页 .filters .fbtn'],
          [M.content, 'index.html', '标签筛选', '按 6 个维度动态生成（仅显示已用标签）', '页 #tagBar'],
          [M.content, 'index.html', '搜索', '标题 + 摘要 + 标签 + 作者，200ms 防抖', '页 #searchInput'],
          [M.content, 'index.html', '风险过滤', '默认隐藏「极高风险」，可手动开启', '页 #showHighRisk / #hidePrivate'],
          [M.content, 'index.html', '刷新', '强制绕过缓存重拉，三态反馈', '页 #refreshBtn'],
          [M.content, 'index.html', '卡片差异化渲染', '按类型显示时长/道具数/步骤数/组数/清单项', '页 .pcard'],
          [M.content, 'index.html', '空态引导', '区分「无内容」与「筛选无匹配」两种文案', '页 #stateBox'],
          [M.content, 'post.html', '详情页', '按类型渲染：风险警示条 → 分组 → 检查点 → 后护理', '页 #detailBox'],
          [M.content, 'post.html', '风险警示条', '中/高/极高显示等级、中止条件、安全信号、紧急预案', '页 .d-alert'],
          [M.content, 'post.html', '极高风险折叠', '默认折叠，需点「我已了解风险」才展开', '页 #collapsedBox + #expandBtn'],
          [M.content, 'post.html', '可见性控制', 'public / member（需登录）/ private（仅作者）', '页加载时校验'],
          [M.content, 'post.html', '复制链接', 'navigator.clipboard + 三态反馈', '页 #copyBtn'],
          [M.content, 'post-editor.html', '★ 结构化编辑器', 'schema 驱动，4 种类型共用一套表单引擎', '页 #editorArea'],
          [M.content, 'post-editor.html', '类型页签', '切换类型并重置类型专属字段（有内容时二次确认）', '页 #typeTabs'],
          [M.content, 'post-editor.html', '基础信息', '标题/摘要/封面/风险等级/可见性/标签/匿名', '页 #metaBox'],
          [M.content, 'post-editor.html', '风险等级联动', '高/极高风险强制显示安全字段区', '页 #safetyBox'],
          [M.content, 'post-editor.html', '极高风险知情确认', '必须勾选「我已了解风险」才能发布', '页 #sAck'],
          [M.content, 'post-editor.html', '可增删列表', '道具/步骤/检查点/分组/条目/量表项/题目，支持上下移动', '页 .list-item .li-tools'],
          [M.content, 'post-editor.html', '嵌套列表', '合集的分组内可再加条目', '页 [data-list-key="items"]'],
          [M.content, 'post-editor.html', '依赖联动', 'dependsOn：清单模式切换显示不同字段组', '页 .fld[data-dep-key]'],
          [M.content, 'post-editor.html', '实时预览', '按类型分发渲染 + 字数统计', '页 #previewBox / #pvLen'],
          [M.content, 'post-editor.html', '草稿自动保存', 'localStorage，800ms 防抖，刷新后恢复', '页 #draftTip'],
          [M.content, 'post-editor.html', '发布校验', '标题/风险/安全字段/知情确认/步骤非空', '页 #publishBtn'],
          [M.content, 'post-editor.html', '高风险词提示', '命中不可逆伤害等类别时弹建议（不拦截）', '发布前 confirm'],
          [M.content, 'js/content-types.js', '★ 单一事实源', '4 类型 / 字段 / 风险 / 标签 / 提示词 / 落盘格式', '无 UI'],
          [M.content, 'js/renderers.js', '按类型分发渲染', '预览 + 卡片元信息 + 紧凑列表行', '无 UI'],
          [M.content, 'js/render.js', '列表卡片 + 详情只读渲染', 'schema 驱动，含简易 Markdown（4 语法）', '无 UI'],
          [M.content, 'js/editor.js', 'schema 驱动表单引擎', '字段渲染 / 增删排序 / 依赖联动 / 校验 / 序列化', '无 UI'],
        ],
      },


  // ─────────────────────────────────────── 五、占位模块
  {
    title: '五、占位模块',
    rows: [
      [M.rand, 'index.html', '随机模块占位页', '无 JS；声明「正在开发中」', '/modules/random/ 页 a「返回首页」'],
      [M.rand, '—', '⚠️ 一个页面被两个模块共用', 'registry 中 dream-weaver 与 random 指向同一 URL', '影响 /index.html 页 探索区 2 张卡片（🌙 淫梦织境 / 🎲 欲缘之遇）'],
    ],
  },

  // ─────────────────────────────────────── 七、共享层
  {
    title: '七、共享层（src/shared/js/ 与 src/shared/config/）',
    rows: [
      [P.shared, 'js/config.js', 'Supabase 连接配置', 'URL + anon key（被 supabase-client.js 使用）', '无 UI'],
      [P.shared, 'js/config.js', '模块注册表（6 项）', 'PROJECTS：id/name/description/url/status/requiredRoles', '决定 /index.html 页 探索区 6 张卡'],
      [P.shared, 'js/config.js', '⚠️ 3 个占位模块标为 online', '不显示「维护中」灰态（既有缺陷）', '影响 /index.html 页 .status-tag'],

      [P.shared, 'js/registry.js', '可见模块查询', 'getVisibleProjects：offline 剔除 / maintenance 仅管理员 / requiredRoles 匹配', '被 /index.html 页与 /module.html 页调用'],
      [P.shared, 'js/registry.js', '⚠️ 未使用导出', 'getAllProjects / getVisibleProjectIds / getProjectStatus', '无调用者'],

      [P.shared, 'js/guard.js', '公开路由白名单', 'landing / about / auth', '影响全站访问'],
      [P.shared, 'js/guard.js', '已登录跳转', '在 landing/auth 页 → 跳 index.html', '影响 /launcher/landing.html 与 /launcher/auth.html'],
      [P.shared, 'js/guard.js', '未登录拦截', '受保护页 → landing.html?redirect=<原URL>', '影响除白名单外的所有页面'],
      [P.shared, 'js/guard.js', '防重入保护', 'guardRunning 标记位', '无 UI（内部）'],
      [P.shared, 'js/guard.js', '异常保守处理', '出错时非公开路由一律跳 landing', '无 UI（内部）'],
      [P.shared, 'js/guard.js', '自动执行', 'DOMContentLoaded 或立即执行', '被 /launcher/index.html 引入'],
      [P.shared, 'js/guard.js', '⚠️ 覆盖缺口', '仅 index.html 引入；其他页面未接守卫', '影响 knowledge/mission 等页'],
      [P.shared, 'js/guard.js', '⚠️ 未使用导出', 'hasModuleAccess / getRedirectParam', '无调用者'],

      [P.shared, 'js/auth.js', '注册（含身份元数据）', '写 role:self + nickname + points:0 + 8 项身份字段', '被 /launcher/auth.html 注册表单调用'],
      [P.shared, 'js/auth.js', '登录', 'signInWithPassword', '被 /launcher/auth.html 登录表单调用'],
      [P.shared, 'js/auth.js', '登出', '清 foxsir_session → 跳 landing', '被 /launcher/index.html #topLogoutBtn 与 /admin.html #adminLogoutBtn 调用'],
      [P.shared, 'js/auth.js', '会话读取与持久化', 'setSession / getSession（localStorage foxsir_session）', '被多页调用'],
      [P.shared, 'js/auth.js', '当前用户（缓存 + 有效性验证）', 'localStorage → supabase.auth.getUser() 验证 → 失败清缓存', '被 guard / 顶栏 / 各模块调用'],
      [P.shared, 'js/auth.js', '身份元数据聚合', 'getUserIdentity：primaryId/nickname/role/points/avatarUrl 等 9 项', '被 /launcher/index.html renderTopUser 调用'],
      [P.shared, 'js/auth.js', '错误消息本地化', 'mapAuthError：6 条英文 → 中文', '被登录/注册表单使用'],
      [P.shared, 'js/auth.js', '⚠️ 积分更新未启用', 'updateUserPoints 无任何调用者', '无 UI'],

      [P.shared, 'js/identity.js', '角色读取', 'getUserRole：user_metadata.role → 回退 guest', '被全站权限判断调用'],
      [P.shared, 'js/identity.js', '昵称 / 头像 / 元数据读取', 'getUserNickname / getUserAvatar / getUserMetadata', '被顶栏与各模块调用'],
      [P.shared, 'js/identity.js', '⚠️ 与 auth.js 的 getCurrentUser 双份实现', '本文件版无缓存；auth.js 版带缓存验证（语义不同）', '无 UI（架构隐患）'],

      [P.shared, 'js/supabase-client.js', 'Supabase 客户端创建', 'autoRefreshToken / persistSession / detectSessionInUrl', '被 auth / identity / avatar / admin 调用'],
      [P.shared, 'js/supabase-client.js', '★ auth 方法超时注入', 'Proxy 包装 7 个方法，10 秒超时（防网络挂起）', '无 UI（全站生效）'],
      [P.shared, 'js/supabase-client.js', '原始客户端备用导出', 'rawSupabase', '无调用者'],

      [P.shared, 'js/loading.js', '全局 Loading 遮罩', '单例 DOM 复用 + 72px Logo + 进度条 + 副文案', '全站 #global-loading-overlay'],
      [P.shared, 'js/loading.js', '进度条模拟动画', '三段速度衰减，封顶 95%', '全站 #loading-bar'],
      [P.shared, 'js/loading.js', '10 秒超时保护', '超时切错误态并露出重试按钮', '全站 #loading-error + #loading-retry-btn「刷新重试」'],
      [P.shared, 'js/loading.js', '文案更新 API', 'updateLoadingText', '被 /launcher/index.html 三段式调用'],
      [P.shared, 'js/loading.js', '强制隐藏 API', 'forceHideLoading（异常场景）', '无调用者'],

      [P.shared, 'js/ui-helpers.js', 'Toast 提示（简陋版）', '⚠️ 砖红/钢蓝纯色，与黑金主题冲突', '被 /admin.html 与 /admin-article.html 调用'],
      [P.shared, 'js/ui-helpers.js', '⚠️ showLoading 与 loading.js 同名不同义', '把容器 innerHTML 换成「加载中...」', '无调用者'],

      [P.shared, 'js/avatar.js', '图片压缩', 'compressImage：等比缩放至 200px + WebP quality 0.8', '被头像上传调用'],
      [P.shared, 'js/avatar.js', '头像上传', 'Storage(avatars) upsert → 更新 metadata → 同步本地会话', '被 /launcher/index.html 头像点击触发'],
      [P.shared, 'js/avatar.js', '⚠️ 未使用导出', 'getAvatarUrl / deleteAvatar', '无调用者'],

      [P.shared, 'js/level.js', '等级计算', 'calculateLevel：8 级阈值 + 称号 + 进度百分比', '被 /launcher/index.html 顶栏调用'],
      [P.shared, 'js/level.js', '⚠️ 未使用导出', 'getLevelBadge / getLevelProgressBar / formatPoints（已 import 未调用）', '无实际 UI 使用'],
      [P.shared, 'js/level.js', '徽章三档配色', 'bronze Lv0-2 / silver Lv3-5 / gold Lv6-7', '影响 level.css 的 .level-badge'],

      [P.shared, 'js/cache.js', '带元数据缓存（新 API）', 'getCacheWithMeta / setCacheWithMeta（含版本号 + TTL）', '被 content-manager.js 列表缓存使用'],
      [P.shared, 'js/cache.js', '裸值缓存（旧 API）', 'getCache / setCache（永不过期）', '被知识/任务详情页使用'],
      [P.shared, 'js/cache.js', '分区清缓存', 'clearKnowledgeCache / clearTaskCache', '被发布/删除流程调用'],
      [P.shared, 'js/cache.js', '⚠️ clearAllCache 会连会话一起删', 'foxsir_ 前缀通杀（含 foxsir_session / github_token）', '无 UI（潜在风险）'],
      [P.shared, 'js/cache.js', '⚠️ 新旧 API 混用缺陷', '降级路径用旧 getCache 读新格式 → 返回包装对象', '影响列表页降级逻辑'],

      [P.shared, 'js/request.js', '超时 Promise 包装', 'withTimeout（默认 8000ms）', '被 supabase-client.js 使用'],
      [P.shared, 'js/request.js', '错误分类', 'classifyError：timeout/network/server/auth/unknown', '无直接调用者'],
      [P.shared, 'js/request.js', '⚠️ 未使用导出', 'safeAsync', '无调用者'],

      [P.shared, 'js/identity-selector.js', '主身份卡渲染（12 张）', '单选；再点可取消', '/launcher/auth.html 页 #identity-selector-container > .primary-grid > #primary-grid'],
      [P.shared, 'js/identity-selector.js', '副身份卡渲染（12 张）', '多选，青蓝色高亮', '/launcher/auth.html 页 #identity-selector-container > .secondary-grid > #secondary-grid'],
      [P.shared, 'js/identity-selector.js', '实时提示拼装', '「主：… ｜ 副：…」/「⚠️ 请选择主身份」', '/launcher/auth.html 页 #identity-selector-container > #identity-hint'],
      [P.shared, 'js/identity-selector.js', '选中数据导出', 'getSelectedIdentityData（valid + 6 字段）', '被 /launcher/auth.html 注册提交调用'],
      [P.shared, 'js/identity-selector.js', '选择重置', 'resetIdentitySelector', '被 /launcher/auth.html Tab 切换调用'],

      [P.shared, 'js/launcher.js', '⚠️ 旧版启动器渲染（死代码）', 'renderLauncher（旧 .project-card 结构）', '无调用者（已被 index.html 内联实现取代）'],
      [P.shared, 'js/main.js', '⚠️ 旧版控制中心逻辑（死代码）', 'renderUserSection / renderAll（选择器指向已不存在的元素）', '无调用者'],

      [P.shared, 'config/identity-config.js', '12 身份定义', 'id/label/gender/type/icon/desc', '被 /launcher/auth.html 身份选择器使用'],
      [P.shared, 'config/identity-config.js', '身份工具函数', 'getGender / getType / getIdentityById / IDENTITY_IDS', '无直接调用者（预留）'],

      [P.shared, 'config/levelConfig.js', '积分阈值表（8 级）', 'LEVEL_THRESHOLDS = [0,1,11,51,101,501,1001,5001]', '被 level.js calculateLevel 使用'],
      [P.shared, 'config/levelConfig.js', '12 身份 × 8 级称号（96 个）', 'LEVEL_TITLES', '被 level.js getLevelTitle 使用'],
      [P.shared, 'config/levelConfig.js', '称号与身份名查询', 'getLevelTitle / getIdentityLabel', '被 level.js 调用'],
      [P.shared, 'config/levelConfig.js', '⚠️ 等级分段与文档不一致', 'about.html 分段（Lv1-2/3-4/5-6/7）vs 代码徽章分段（0-2/3-5/6-7）', '影响 /launcher/about.html 第五章表格'],

      [P.shared, 'css/theme 系列', '黑金主题（7 个 CSS 文件）', 'landing/level/avatar/identity-selector/main/admin/control-center', '被各页面 <link> 引入（control-center.css 无引用）'],
      [P.shared, 'assets/images/OIP-A/B/C.jpg', '全站图片资源', 'A=favicon+规则横幅；B=首页欢迎卡背景；C=全站 Logo', '被各页面 favicon / .logo-icon / .welcome-image 使用'],
    ],
  },
];

// ══════════════════════════════════════════════════════════════════
// 生成
// ══════════════════════════════════════════════════════════════════

const COLS = ['文件名', '归属板块', '具体功能', '与哪个功能具有联动效果', '在哪个页面的容器或按钮进行交互'];

let totalRows = 0;
const lines = [];
lines.push('# Foxsir · 欲研所 —— 功能点全量梳理表');
lines.push('');
lines.push(`> **基线**：分层重构后（\`src/\` 结构）｜**生成时间**：${new Date().toISOString().slice(0, 10)}`);
lines.push('> **列定义**：' + COLS.join(' ｜ '));
lines.push('> **数据来源**：对 `src/` 全量源码逐文件通读 + `tools/extract-inventory.mjs` 机械化提取（容器名/按钮名/函数名均取自真实代码）');
lines.push('> **说明**：标 ⚠️ 的条目为**发现的问题或缺失功能**，标 ★ 的为重点设计');
lines.push('');
lines.push('## 统计概览');
lines.push('');
lines.push('| 归属板块 | 功能点数 |');
lines.push('|:---|---:|');

const byModule = {};
for (const sec of SECTIONS) {
  for (const r of sec.rows) {
    const mod = r[0];
    byModule[mod] = (byModule[mod] || 0) + 1;
    totalRows++;
  }
}
for (const [k, v] of Object.entries(byModule).sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${k} | ${v} |`);
}
lines.push(`| **合计** | **${totalRows}** |`);
lines.push('');

for (const sec of SECTIONS) {
  lines.push(`## ${sec.title}`);
  lines.push('');
  lines.push(`共 **${sec.rows.length}** 个功能点。`);
  lines.push('');
  lines.push('| ' + COLS.join(' | ') + ' |');
  lines.push('|:---|:---|:---|:---|:---|');
  for (const r of sec.rows) {
    const cells = r.map((c) => String(c).replace(/\|/g, '\\|').replace(/\n/g, '<br>'));
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('## 附：本轮梳理发现的问题清单');
lines.push('');
lines.push('| 编号 | 问题 | 位置 | 影响 |');
lines.push('|:---|:---|:---|:---|');
const ISSUES = [
  ['I-01', 'Fillout 生产 API Key 前端明文', 'src/modules/sub-archive/js/config.js', '档案隐私体系可被绕过（严重）'],
  ['I-02', 'admin-article-simple.html 零鉴权', 'src/admin/admin-article-simple.html', '任何人可发布内容（严重）'],
  ['I-03', '知识区/任务区详情页正文无 HTML 转义', 'src/modules/*/detail.html|article.html', '存储型 XSS（严重）'],
  ['I-04', 'VITE_GITHUB_TOKEN 编译期内联 + 写 localStorage', 'src/admin/content-manager.js', '仓库写权限 Token 暴露（严重）'],
  ['I-05', 'role 完全依赖客户端 user_metadata', 'src/shared/js/identity.js', '前端可提权（严重）'],
  ['I-06', '档案馆 hasMore 判定错误', 'src/modules/sub-archive/js/home.js', '永远无法显示「已加载全部」'],
  ['I-07', '隐私判定宽严不一致（列表宽松/详情严格）', 'src/modules/sub-archive/js/utils.js', '同记录列表可见、详情隐藏'],
  ['I-08', '缓存降级路径返回包装对象', 'src/admin/content-manager.js', '降级时抛 TypeError'],
  ['I-09', '管理后台搜索无结果时回退显示全部用户', 'src/admin/admin.js', '搜索结果误导'],
  ['I-10', '档案馆滚动监听绑定在无 overflow 的容器', 'src/modules/sub-archive/js/home.js', '无限滚动可能失效'],
  ['I-11', '健康身高/体重空值仍拼接单位', 'src/modules/sub-archive/js/home.js', '显示「cm」「kg」孤立单位'],
  ['I-12', '任务区页面标题误作「欲渊之庭」', 'src/modules/mission/index.html', '命名错误，应为「欲炼之途」'],
  ['I-13', '3 个占位模块 status 标为 online', 'src/shared/js/config.js', '首页不显示维护灰态'],
  ['I-14', 'dream-weaver 与 random 指向同一 URL', 'src/shared/js/config.js', '2 张卡片实际同一目标'],
  ['I-15', 'nameFallback 与 name 是同一字段', 'src/shared/config/archive/instances.js', '备用姓名机制失效'],
  ['I-16', 'parseFrontmatter 三份重复实现', 'content-manager.js + 两个详情页', '改一处需改三处'],
  ['I-17', '管理后台搜索用了不存在的字段 ID', 'src/admin/admin.js（fF9i8Q5CgBe）', '「地区」搜索永远命中空值'],
  ['I-18', '可编辑字段白名单两处手工同步', 'api.js + admin.js', '漏改则开关静默不生效'],
  ['I-19', 'getCurrentUser 双份实现且语义不同', 'shared/js/auth.js + identity.js', '不同页面可能读到不一致状态'],
  ['I-20', '头像 cacheControl 3600 + 固定文件名', 'src/shared/js/avatar.js', '换头像后 1 小时内可能显示旧图'],
  ['I-21', '档案馆仍是全站唯一亮色模块（含彩虹渐变）', 'src/modules/sub-archive/css/*', '与黑金体系视觉割裂'],
  ['I-22', '三套 Toast 并存（精美版/简陋版/原生 alert）', 'index.html + ui-helpers.js + 各模块', '交互体验不一致'],
  ['I-23', '积分体系半成品（数据/计算/徽章齐全但零调用）', 'shared/js/level.js + auth.js', 'about.html 宣称的 5 种积分获取均未实现'],
  ['I-24', '死代码：shared/js/{main,launcher}.js、control-center.css', '多处', '维护困惑（sub-archive/admin.* 已于 2026-10-05 归档）'],
  ['I-25', 'not marked：guard.js 仅 index.html 引入', 'src/shared/js/guard.js', '其他页面未接守卫，靠数据降级'],
];
for (const [id, name, loc, impact] of ISSUES) {
  lines.push(`| ${id} | ${name} | ${loc} | ${impact} |`);
}
lines.push('');
lines.push('*本表由 `tools/gen-feature-table.mjs` 生成，可随代码变更重新生成。*');

const outFile = path.join(ROOT, '_dev', 'docs', '草稿', '功能点全量梳理表.md');
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

// ── 同时生成 CSV（带 UTF-8 BOM，Excel 双击可直接正确显示中文）──
const csvCell = (s) => {
  const v = String(s).replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return /[",]/.test(v) ? `"${v}"` : v;
};
const csv = [];
csv.push(['分区', ...COLS].map(csvCell).join(','));
for (const sec of SECTIONS) {
  for (const r of sec.rows) {
    csv.push([sec.title.replace(/^[一二三四五六七]、/, ''), ...r].map(csvCell).join(','));
  }
}
const csvFile = path.join(ROOT, '_dev', 'docs', '草稿', '功能点全量梳理表.csv');
fs.writeFileSync(csvFile, '\ufeff' + csv.join('\r\n'), 'utf8');

console.log(`已生成: ${path.relative(ROOT, outFile)}`);
console.log(`已生成: ${path.relative(ROOT, csvFile)}  (CSV, UTF-8 BOM, ${csv.length - 1} 行)`);
console.log(`功能点合计: ${totalRows}`);
for (const [k, v] of Object.entries(byModule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
console.log(`章节数: ${SECTIONS.length}`);
console.log(`问题清单: ${ISSUES.length} 条`);
