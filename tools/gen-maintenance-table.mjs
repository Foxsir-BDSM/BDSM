#!/usr/bin/env node
/**
 * tools/gen-maintenance-table.mjs —— 生成「文件维护对照表」
 *
 * 输出：
 *   _dev/docs/数据表/文件维护对照表.csv  （Excel 可直接打开，带 UTF-8 BOM）
 *   _dev/docs/数据表/文件维护对照表.md   （便于在编辑器/网页中查阅）
 *
 * 表格列（按用户要求）：
 *   文件名 | 归属页面 | 具备功能 | 后续维护/调整（要改这个文件时该注意什么）
 *          | 联动依赖（与哪些文件交互）
 *
 * 依赖关系不手写，全部来自 tools/analyze-deps.mjs 生成的 tools/.deps.json，
 * 避免人工维护出错。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEPS_FILE = path.join(ROOT, 'tools', '.deps.json');
if (!fs.existsSync(DEPS_FILE)) {
  console.error('❌ 缺少依赖图，请先运行: node tools/analyze-deps.mjs --json');
  process.exit(1);
}
const DEPS = JSON.parse(fs.readFileSync(DEPS_FILE, 'utf8'));

const short = (p) => p.replace(/^src\//, '');
const relDeps = (arr) => (arr || []).map(short);
const joinOr = (arr, dash = '—') => (arr && arr.length ? arr.join('、') : dash);

// ════════════════════════════════════════════════════════════
// 文件元数据（人工维护部分：归属页面 / 功能 / 维护提示）
// ════════════════════════════════════════════════════════════
// 字段说明：
//   page    归属页面（用户可见的页面）
//   layer   分层：启动器 / 管理后台 / 模块 / 共享层 / 构建工具
//   what    具备功能
//   maintain 后续维护调整要点（要改这个文件时该知道什么）
//   cautions 改动风险提示（可选）

const META = {
  // ───────────────────────── 启动器（src/launcher/）
  'src/launcher/landing.html': {
    layer: '启动器', page: '着陆页 /landing.html',
    what: '品牌形象展示、「随便逛逛」与「立即加入」两个入口',
    maintain: '纯静态页。改文案/配图直接改本文件；两个入口的跳转目标写在本页 <a href>。',
    cautions: '不要改本页的 script 引入方式（无 JS 逻辑）。',
  },
  'src/launcher/index.html': {
    layer: '启动器', page: '首页 /index.html',
    what: '登录后主入口：模块卡片墙、身份与积分展示、控制中心入口',
    maintain: '模块卡片由 shared/js/registry.js 的 PROJECTS 驱动，增删模块改那里，不是改本页 HTML。',
    cautions: '本页依赖 guard.js 做权限拦截，改动引入顺序可能导致权限失效。',
  },
  'src/launcher/auth.html': {
    layer: '启动器', page: '登录注册 /auth.html',
    what: '登录、注册（选 4 身份）、第三方登录入口',
    maintain: '注册写入 Supabase user_metadata，字段在 init()→signUp 的 data 对象里；身份选项来自 identity-config.js 的 IDENTITIES，增删身份改那里。',
    cautions: '★ 用户明确要求：本文件不参与权限放开改造，保持原样。',
  },
  'src/launcher/profile.html': {
    layer: '启动器', page: '个人资料 /profile.html',
    what: '资料查看与编辑、头像上传、身份与角色展示',
    maintain: '身份为只读展示（需管理员改）；头像走 Supabase Storage 的 avatars 桶。',
    cautions: '身份自助修改功能已移除（2026-10-04 决策），如需恢复要同时改 auth.js 与 identity-config.js。',
  },
  'src/launcher/my.html': {
    layer: '启动器', page: '我的 /my.html',
    what: '个人主页（预留）：档案状态、我发布的内容、接取的历史任务',
    maintain: '「档案状态」按昵称匹配档案馆记录：字段取 CARD_FIELDS.name（不硬编码）；后续做账号↔档案绑定要替换这处匹配逻辑。',
    cautions: '顶栏用户菜单由本页与各页面共享，改结构要同步 shared/css 与其它页面。',
  },
  'src/launcher/module.html': {
    layer: '启动器', page: '模块详情 /module.html',
    what: '单模块介绍页（从首页卡片点入）',
    maintain: '内容由 ?id= 参数决定，数据源是 registry.js 的 PROJECTS。',
  },
  'src/launcher/about.html': {
    layer: '启动器', page: '用户指南 /about.html',
    what: '六章图文指南：这是什么地方、怎么开始、身份体系、模块说明、等级积分、隐私开关',
    maintain: '内容多为硬编码说明文字，与代码事实需人工对齐。例如隐私开关一节仍写着旧库字段 ID，迁库后已过时。',
    cautions: '★ 用户明确要求本文件保持原样；若后续要与配置对齐，需你确认后再动。',
  },
  'src/launcher/404.html': {
    layer: '启动器', page: '404 页',
    what: '错误页，静态',
    maintain: '纯静态，可自由改。',
  },

  // ───────────────────────── 管理后台（src/admin/）
  'src/admin/admin.html': {
    layer: '管理后台', page: '管理后台 /admin.html',
    what: '后台外壳：Tab 容器（用户管理 / 档案管理 / 内容管理）',
    maintain: 'Tab 由 admin.js 绑定；新增后台页签改这里加容器 + 在 admin.js 加逻辑。',
  },
  'src/admin/admin.js': {
    layer: '管理后台', page: '管理后台 /admin.html',
    what: '用户角色管理、档案隐私勾选编辑、档案检索',
    maintain: '★ 档案可编辑字段在 SUB_EDITABLE_FIELDS，字段 ID 已改为读 config（VISIBILITY_FIELDS / PRIVACY_CONTROL_IDS / CARD_FIELDS）；再迁库只改 fields.js 即可。',
    cautions: '写库走 api.js 的 updateRecordFields，其白名单必须与 SUB_EDITABLE_FIELDS 保持一致，否则保存会被静默忽略。',
  },
  'src/admin/admin-article.html': {
    layer: '管理后台', page: '内容管理（图文编辑器）',
    what: '带工具栏的图文内容编辑器',
    maintain: '与 content-manager.js 配合；发布写入 GitHub 仓库 foxsir-content。',
  },
  'src/admin/admin-article-simple.html': {
    layer: '管理后台', page: '内容管理（简易版）',
    what: '极简内容编辑器（单页自包含）',
    maintain: '⚠️ 已知缺陷：本页无任何权限校验，任何人可访问。若要上线需补 guard。',
    cautions: '⚠️ 安全风险：零鉴权。',
  },
  'src/admin/content-manager.js': {
    layer: '管理后台', page: '内容管理',
    what: '内容列表读取、发布、删除（对接 GitHub foxsir-content）',
    maintain: '仓库与分支在 content-config.js；Token 来自环境变量 VITE_GITHUB_TOKEN。',
    cautions: '⚠️ Token 会被 Vite 内联进前端产物，属已知安全债。',
  },
  'src/admin/content-config.js': {
    layer: '管理后台', page: '内容管理',
    what: '内容仓库配置（owner / repo / branch / 路径）',
    maintain: '换仓库或分支只改这里。',
  },

  // ───────────────────────── 共享层：配置（src/shared/config/）
  'src/shared/config/identity-config.js': {
    layer: '共享层·配置', page: '全站（注册 / 档案 / 我的 / 首页）',
    what: '身份体系唯一事实源：4 身份（男S/女S/男M/女M）、旧值归并表、互补位置、档案默认筛选推导、主奴称谓',
    maintain: '★ 增删身份只改 IDENTITIES 一处，注册页/档案筛选/个人页自动跟随。旧身份归并表 LEGACY_IDENTITY_MAP 是兼容历史用户的，不要删。',
    cautions: '取向维度已于 2026-10-04 取消；若恢复需同步改注册页、资料页、档案筛选三处。',
  },
  'src/shared/config/levelConfig.js': {
    layer: '共享层·配置', page: '全站（积分与角色）',
    what: '角色称谓（主/奴）与积分阈值',
    maintain: '等级体系已精简为仅「主/奴」两项，原多级阶梯已移除。',
  },
  'src/shared/config/access.js': {
    layer: '共享层·配置', page: '全站（权限）',
    what: '页面访问所需的角色等级定义',
    maintain: '与 guard.js 配合决定「谁能进哪个页面」；放开权限时改这里而非逐页改。',
  },

  // ───────────────────────── 共享层：档案馆配置
  'src/shared/config/archive/api.js': {
    layer: '共享层·档案馆配置', page: '档案馆全模块',
    what: '★ 总 API 配置：数据库 base/table ID、API Key、表单入口 URL、分页与缓存参数、默认占位图',
    maintain: '★ 换数据库只改本文件（BASE_ID / TABLE_ID / API_KEY）与表单 FORM_URL。Zite 编辑器 URL 的 workspace 段=base、database 段=table。',
    cautions: 'DEFAULT_IMAGE 必须保持 base64 形式（不含引号），否则会撑破 onerror 属性导致卡片报错。',
  },
  'src/shared/config/archive/fields.js': {
    layer: '共享层·档案馆配置', page: '档案馆全模块（首页/详情/管理/我的）',
    what: '★ 档案馆字段维护文件：59 字段的 id→名称；★ 字段可见性注册表（按页面区域划分）；5 个隐私公开开关；详情页分组；卡片映射；搜索与筛选字段',
    maintain: '★ 本文件是维护主入口，只需改 FIELD_VISIBILITY 里的对应数组即可调整某页面显示哪些字段，不需要动任何页面代码。区域：home_card（首页卡片）/ detail（详情页）/ bind_only（表单绑定）/ manage（管理面板）/ self（我的页面）。',
    cautions: '分组 id 以 photos_ 开头的走媒体网格渲染，且 photos_life / photos_private 被 detail.js 硬编码引用，不要改名。「首页认证标签」只能出现在 home_card 与 manage，不能进 self。',
  },
  'src/shared/config/archive/instances.js': {
    layer: '共享层·档案馆配置', page: '档案馆全模块',
    what: '★ 单一事实源（聚合层）：把 api.js 与 fields.js 组装成 SUB_ARCHIVE_CONFIG 供全站读取',
    maintain: '本文件只做聚合与兼容，不直接声明字段。改字段去 fields.js，改数据源去 api.js。',
    cautions: '导出契约被 home/detail/utils/admin/my 多处依赖，删减导出项会连锁报错。',
  },
  'src/shared/config/archive/schema.js': {
    layer: '共享层·档案馆配置', page: '档案馆全模块',
    what: '隐私与可见性判定函数：隐私值是否放行、字段对角色是否可见、受控字段是否通过隐私校验',
    maintain: '判定逻辑集中在这里，改隐私规则只在 fields.js 的 PRIVACY_RULES 增删，本文件不需要动。',
  },
  'src/shared/config/archive/index.js': {
    layer: '共享层·档案馆配置', page: '（无）',
    what: '统一导出入口（re-export schema 与 instances）',
    maintain: '⚠️ 当前无任何文件引用（消费方都直连 instances.js）。保留作兼容，若确认无用可删。',
  },

  // ───────────────────────── 共享层：JS
  'src/shared/js/supabase-client.js': {
    layer: '共享层·JS', page: '全站（认证与存储）',
    what: 'Supabase 客户端单例',
    maintain: 'URL 与 anon key 在 shared/js/config.js。',
    cautions: '被 6 个文件依赖，改动影响面大。',
  },
  'src/shared/js/config.js': {
    layer: '共享层·JS', page: '全站',
    what: 'Supabase 连接参数与全局常量',
    maintain: '改后端项目只改这里。',
  },
  'src/shared/js/auth.js': {
    layer: '共享层·JS', page: '全站（登录态）',
    what: '注册 / 登录 / 登出 / 会话缓存 / 身份元数据读取',
    maintain: '身份元数据的解析在 getUserIdentity；新增元数据字段要同步这里与各页读取处。',
    cautions: '被 7 个文件依赖。与 modules/sub-archive/js/auth.js 功能重复（后者已无引用，可清理）。',
  },
  'src/shared/js/identity.js': {
    layer: '共享层·JS', page: '全站（身份与权限）',
    what: '当前用户与角色读取',
    maintain: '只读封装，一般不需要改。角色值来自 Supabase user_metadata。',
    cautions: '被 8 个文件依赖，是全站被依赖最多的模块。',
  },
  'src/shared/js/guard.js': {
    layer: '共享层·JS', page: '全站（页面守卫）',
    what: '页面访问权限守卫，未授权跳转',
    maintain: '白名单与重定向目标在本文件；放开某页权限先看这里。',
  },
  'src/shared/js/identity-selector.js': {
    layer: '共享层·JS', page: '注册页 /auth.html',
    what: '4 身份选择器组件（渲染、选中态、读取选中值）',
    maintain: '身份卡片视觉与文案在本文件；身份数据源是 identity-config.js。',
  },
  'src/shared/js/level.js': {
    layer: '共享层·JS', page: '首页 / 我的 / 资料页',
    what: '角色称谓与积分格式化（仅主/奴）',
    maintain: '已移除多级等级计算（calculateLevel 等），若恢复等级阶梯要重新引入。',
  },
  'src/shared/js/ui-helpers.js': {
    layer: '共享层·JS', page: '全站',
    what: '通用 UI 工具：toast 提示等',
    maintain: '被 4 个文件依赖，改函数签名要全局搜。',
  },
  'src/shared/js/loading.js': {
    layer: '共享层·JS', page: '全站',
    what: '全屏加载遮罩 showLoading / hideLoading',
    maintain: '通用组件，一般不需要改。',
  },
  'src/shared/js/avatar.js': {
    layer: '共享层·JS', page: '资料页 /profile.html',
    what: '头像上传与读取（Supabase Storage avatars 桶）',
    maintain: '桶名与路径规则在本文件；权限问题先查 Storage 的 RLS 策略。',
  },
  'src/shared/js/cache.js': {
    layer: '共享层·JS', page: '全站',
    what: '本地缓存封装（带过期）',
    maintain: '档案馆另有自己的缓存键，见 archive/api.js 的 CACHE_KEY。',
  },
  'src/shared/js/request.js': {
    layer: '共享层·JS', page: '全站',
    what: 'HTTP 请求封装（超时、重试、错误统一处理）',
    maintain: '通用网络层，改超时/重试策略在这里。',
  },
  'src/shared/js/registry.js': {
    layer: '共享层·JS', page: '首页 /index.html',
    what: '模块注册表（PROJECTS）：首页卡片墙的数据源',
    maintain: '★ 增删功能模块改这里；每项含 id/名称/图标/路径/所需权限。',
  },
  'src/shared/js/launcher.js': {
    layer: '共享层·JS', page: '首页 /index.html',
    what: '首页模块卡片渲染',
    maintain: '数据来自 registry.js。',
  },
  'src/shared/js/main.js': {
    layer: '共享层·JS', page: '（无）',
    what: '首版启动器入口（登录表单 + 角色映射）',
    maintain: '⚠️ 已被各页面独立入口取代，当前无任何页面引用。可删。',
  },

  // ───────────────────────── 模块：档案馆（src/modules/sub-archive/）
  'src/modules/sub-archive/index.html': {
    layer: '模块·档案馆', page: '档案列表 /modules/sub-archive/',
    what: '档案列表页：搜索框、身份筛选条、「母の曝光」填写按钮、卡片墙容器',
    maintain: '结构改动少；筛选条由 home.js 动态渲染（renderFilterBar），不是写死在本页。',
  },
  'src/modules/sub-archive/detail.html': {
    layer: '模块·档案馆', page: '档案详情 /modules/sub-archive/detail.html',
    what: '单条档案详情：按板块展示字段、媒体网格、隐私可见性控制',
    maintain: '板块划分完全由 fields.js 的 DETAIL_GROUPS 决定，本页无字段列表。',
  },
  'src/modules/sub-archive/admin.html': {
    layer: '模块·档案馆', page: '档案馆后台 /modules/sub-archive/admin.html',
    what: '档案隐私勾选管理表格',
    maintain: '可编辑字段定义在 js/admin.js。',
  },
  'src/modules/sub-archive/js/home.js': {
    layer: '模块·档案馆', page: '档案列表页',
    what: '列表页主逻辑：拉数据、公开性过滤、身份分流、搜索、分页、卡片渲染、「去填写」拼带参表单链接',
    maintain: '★ 列表可见性判定在 isPublic()，字段取 VISIBILITY_FIELDS.publicQuestionnaire（不要硬编码）。表单跳转参数在 buildFormUrl()：email / name / uid。',
    cautions: '字段 ID 一律从 config.js 读；硬编码会在迁库后静默失效（曾导致列表全空）。',
  },
  'src/modules/sub-archive/js/detail.js': {
    layer: '模块·档案馆', page: '档案详情页',
    what: '详情页主逻辑：按 DETAIL_GROUPS 分板块渲染、媒体网格、隐私过滤、单位后缀',
    maintain: '板块与字段来自 fields.js；单位后缀按字段 ID 查表（CARD_FIELDS.height/weight）。',
    cautions: 'photos_life / photos_private 两个分组 id 在本文件硬编码判断，改名会失去媒体网格效果。',
  },
  'src/modules/sub-archive/js/utils.js': {
    layer: '模块·档案馆', page: '档案列表页 / 详情页',
    what: '通用工具：字段取值（兼容 data 与 fields 两种结构）、卡片姓名/年龄/图片、归属解析与筛选、计数、媒体收集',
    maintain: '★ getFieldValue 同时兼容 record.data 与 record.fields —— 迁库后 API 结构变化时这里是第一道防线。',
    cautions: '被 home.js 与 detail.js 依赖，改函数签名要两处同查。',
  },
  'src/modules/sub-archive/js/api.js': {
    layer: '模块·档案馆', page: '档案馆全模块',
    what: 'Fillout/Zite Tables API 封装：分页拉取、全量拉取、单条拉取、字段更新（管理面板用）、缓存',
    maintain: '★ 写接口白名单 PRIVACY_FIELD_WHITELIST 必须与 admin.js 的 SUB_EDITABLE_FIELDS 对齐，否则保存被静默忽略。',
    cautions: 'API Key 明文在 archive/api.js，属已知安全债。',
  },
  'src/modules/sub-archive/js/config.js': {
    layer: '模块·档案馆', page: '档案馆全模块',
    what: '本模块的配置适配层：把 shared/config/archive 的内容转出，并补充缓存与分页常量',
    maintain: '本文件只是转发，改配置去 shared/config/archive/ 下的 api.js 或 fields.js。',
    cautions: '用相对路径导入（非 @/ 别名），以便 Node 能直接导入做逻辑测试；改成别名会破坏纯逻辑测试。',
  },
  'src/modules/sub-archive/js/admin.js': {
    layer: '模块·档案馆', page: '档案馆后台',
    what: '隐私勾选表格渲染、勾选变更收集、批量保存',
    maintain: '⚠️ 内部按字段名（如「姓名」）读取，不是字段 ID，与 api.js 的白名单口径不一致，功能不完整。',
  },
  'src/modules/sub-archive/js/auth.js': {
    layer: '模块·档案馆', page: '（无）',
    what: '档案馆版认证封装（注册/登录/身份元数据）',
    maintain: '⚠️ 与 shared/js/auth.js 功能重复，当前无任何文件引用。建议清理。',
  },

  // ───────────────────────── 模块：内容（src/modules/content/）
  'src/modules/content/index.html': {
    layer: '模块·内容', page: '内容列表 /modules/content/',
    what: '内容板块列表（原任务区 + 知识区合并为「欲炼之途」）',
    maintain: '分类与筛选项来自 content-types.js。',
  },
  'src/modules/content/post.html': {
    layer: '模块·内容', page: '内容详情 /modules/content/post.html',
    what: '单篇内容展示（按内容类型渲染不同版式）',
    maintain: '渲染分支在 renderers.js，新增内容类型要同时改 content-types.js 与 renderers.js。',
  },
  'src/modules/content/post-editor.html': {
    layer: '模块·内容', page: '内容编辑器 /modules/content/post-editor.html',
    what: '结构化内容编辑器（Fillout 级表单化编辑）',
    maintain: '★ 字段结构由 content-types.js 定义，编辑器按定义自动生成表单；新增字段只改 content-types.js。',
  },
  'src/modules/content/js/content-types.js': {
    layer: '模块·内容', page: '内容模块全部页面',
    what: '★ 内容类型定义：类型清单、每类的字段结构、校验规则',
    maintain: '★ 这是内容模块的单一事实源；增删字段、改校验都从这里入手，编辑器与列表自动跟随。',
  },
  'src/modules/content/js/editor.js': {
    layer: '模块·内容', page: '内容编辑器',
    what: '编辑器主逻辑：表单生成、实时预览、提交',
    maintain: '表单由 content-types.js 驱动生成，不要在编辑器里硬编码字段。',
  },
  'src/modules/content/js/render.js': {
    layer: '模块·内容', page: '内容列表 / 详情 / 我的',
    what: '内容渲染入口与数据获取',
    maintain: '被 3 个页面共用，改输出结构要三处同查。',
  },
  'src/modules/content/js/renderers.js': {
    layer: '模块·内容', page: '内容详情',
    what: '按内容类型分发的渲染器实现',
    maintain: '新增类型在此加一个渲染分支。',
  },

  // ───────────────────────── 模块：随机（src/modules/random/）
  'src/modules/random/index.html': {
    layer: '模块·随机', page: '随机模块 /modules/random/',
    what: '占位页（模块骨架，尚未实现功能）',
    maintain: '如需实现功能，参照档案馆的目录结构：index.html + js/ + css/，并在 registry.js 注册。',
  },

  // ───────────────────────── 共享 CSS
  'src/shared/css/main.css': { layer: '共享层·CSS', page: '全站', what: '全局基础样式与设计变量', maintain: '改主题色/字体在这里。' },
  'src/shared/css/admin.css': { layer: '共享层·CSS', page: '管理后台', what: '后台通用样式', maintain: '后台专属，不影响前台。' },
  'src/shared/css/identity-selector.css': { layer: '共享层·CSS', page: '注册页', what: '身份选择器样式', maintain: '与 identity-selector.js 的类名对应。' },
  'src/shared/css/level.css': { layer: '共享层·CSS', page: '首页 / 我的 / 资料页', what: '角色与积分徽章样式', maintain: '等级体系精简后部分样式可能已无引用。' },
  'src/shared/css/avatar.css': { layer: '共享层·CSS', page: '资料页', what: '头像上传控件样式', maintain: '与 avatar.js 对应。' },
  'src/shared/css/landing.css': { layer: '共享层·CSS', page: '着陆页', what: '着陆页样式', maintain: '仅着陆页使用。' },
  'src/shared/css/control-center.css': { layer: '共享层·CSS', page: '首页控制中心', what: '控制中心面板样式', maintain: '仅首页使用。' },
  'src/modules/sub-archive/css/global.css': { layer: '模块·档案馆', page: '档案馆全部页面', what: '档案馆全局样式与设计变量', maintain: '改档案馆主题色在这里。' },
  'src/modules/sub-archive/css/home.css': { layer: '模块·档案馆', page: '档案列表页', what: '列表页样式：卡片、筛选条、搜索框', maintain: '筛选条样式与 home.js 的 renderFilterBar 对应。' },
  'src/modules/sub-archive/css/detail.css': { layer: '模块·档案馆', page: '档案详情页', what: '详情页样式：字段板块、媒体网格', maintain: '媒体网格样式与 detail.js 的 photos_ 分组渲染对应。' },
  'src/modules/sub-archive/css/admin.css': { layer: '模块·档案馆', page: '档案馆后台', what: '档案馆后台表格样式', maintain: '与 js/admin.js 对应。' },
  'src/modules/content/css/content.css': { layer: '模块·内容', page: '内容列表 / 详情', what: '内容展示样式', maintain: '—' },
  'src/modules/content/css/editor.css': { layer: '模块·内容', page: '内容编辑器', what: '编辑器样式', maintain: '—' },
};

// ════════════════════════════════════════════════════════════
// 组装行
// ════════════════════════════════════════════════════════════
const rows = [];

// JS 文件
Object.entries(DEPS.js).sort((a, b) => a[0].localeCompare(b[0])).forEach(([file, dep]) => {
  const m = META[file] || {};
  const owners = (DEPS.jsOwners[file] || []).map((p) => path.basename(p));
  const imports = relDeps(dep.imports);
  const importedBy = relDeps(dep.importedBy);
  const dynamic = relDeps(dep.dynamic);
  rows.push({
    file,
    type: 'JS',
    layer: m.layer || '未归类',
    page: m.page || (owners.length ? owners.join('、') : '（无页面引用）'),
    what: m.what || '（待补充）',
    maintain: m.maintain || '（待补充）',
    caution: m.cautions || '',
    imports: joinOr(imports),
    importedBy: joinOr(importedBy),
    dynamic: joinOr(dynamic),
    fanIn: dep.importedBy.length,
    size: fs.statSync(path.join(ROOT, file)).size,
  });
});

// HTML 文件
Object.entries(DEPS.html).sort((a, b) => a[0].localeCompare(b[0])).forEach(([file, ref]) => {
  const m = META[file] || {};
  const scripts = relDeps(ref.scriptFiles);
  const inline = [...new Set(ref.inlineImports)];
  rows.push({
    file,
    type: 'HTML',
    layer: m.layer || '未归类',
    page: m.page || '—',
    what: m.what || '（待补充）',
    maintain: m.maintain || '（待补充）',
    caution: m.cautions || '',
    imports: joinOr([...scripts, ...inline.map((s) => (s.startsWith('@/') ? short(s.slice(2)) : s))]),
    importedBy: '（页面，不被引用）',
    dynamic: '—',
    fanIn: 0,
    size: fs.statSync(path.join(ROOT, file)).size,
  });
});

// CSS 文件
Object.keys(META).filter((k) => k.endsWith('.css')).forEach((file) => {
  const m = META[file];
  const used = Object.entries(DEPS.html)
    .filter(([, ref]) => ref.styles.some((s) => s.includes(path.basename(file))))
    .map(([h]) => path.basename(h));
  rows.push({
    file,
    type: 'CSS',
    layer: m.layer,
    page: m.page,
    what: m.what,
    maintain: m.maintain,
    caution: '',
    imports: '—',
    importedBy: joinOr(used, '（未被任何页面直接引用）'),
    dynamic: '—',
    fanIn: used.length,
    size: fs.existsSync(path.join(ROOT, file)) ? fs.statSync(path.join(ROOT, file)).size : 0,
  });
});

// 仅被 import 但未在 DEPS.js 里出现的补充
const known = new Set(rows.map((r) => r.file));
Object.keys(DEPS.js).forEach((f) => {
  if (known.has(f)) return;
  rows.push({ file: f, type: 'JS', layer: '未归类', page: '—', what: '（待补充）', maintain: '（待补充）', caution: '', imports: '—', importedBy: '—', dynamic: '—', fanIn: 0, size: 0 });
});

// ════════════════════════════════════════════════════════════
// 输出
// ════════════════════════════════════════════════════════════
const OUT_DIR = path.join(ROOT, '_dev', 'docs', '数据表');
fs.mkdirSync(OUT_DIR, { recursive: true });

const HEAD = ['文件名', '类型', '所属分层', '归属页面', '具备功能', '后续维护/调整（要改这个文件时）', '改动风险提示', '本文件依赖', '被谁依赖', '动态导入'];

// ── CSV（带 BOM，便于 Excel 打开）
const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [HEAD.join(',')];
rows.forEach((r) => csv.push([
  r.file, r.type, r.layer, r.page, r.what, r.maintain, r.caution, r.imports, r.importedBy, r.dynamic,
].map(esc).join(',')));
fs.writeFileSync(path.join(OUT_DIR, '文件维护对照表.csv'), '\ufeff' + csv.join('\r\n'), 'utf8');

// ── Markdown
const L = [];
L.push('# 文件维护对照表');
L.push('');
L.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}　·　共 ${rows.length} 个文件`);
L.push('>');
L.push('> 用途：想改某个功能时，先在这里定位「该改哪个文件」以及「会不会影响别的文件」。');
L.push('>');
L.push('> **「被谁依赖」列的数字越大，改动影响面越大**，改前建议先跑 `npm run check`。');
L.push('>');
L.push('> 本表由 `node tools/gen-maintenance-table.mjs` 生成，依赖关系来自 `tools/analyze-deps.mjs` 自动分析，非手写。');
L.push('');

const layers = [...new Set(rows.map((r) => r.layer))];
layers.forEach((layer) => {
  const group = rows.filter((r) => r.layer === layer);
  if (!group.length) return;
  L.push(`## ${layer}（${group.length} 个文件）`);
  L.push('');
  L.push('| 文件名 | 归属页面 | 具备功能 | 后续维护/调整 | 改动风险 | 本文件依赖 | 被谁依赖 |');
  L.push('|:---|:---|:---|:---|:---|:---|:---|');
  group.forEach((r) => {
    L.push(`| \`${short(r.file)}\` | ${r.page} | ${r.what} | ${r.maintain} | ${r.caution || '—'} | ${r.imports} | ${r.importedBy} |`);
  });
  L.push('');
});

// 高影响面清单
L.push('---');
L.push('');
L.push('## 附：改动影响面最大的文件');
L.push('');
L.push('这些文件被多处依赖，改动前请留意连锁影响。');
L.push('');
L.push('| 文件 | 被依赖数 | 被谁依赖 |');
L.push('|:---|---:|:---|');
rows.filter((r) => r.fanIn > 0).sort((a, b) => b.fanIn - a.fanIn).slice(0, 15).forEach((r) => {
  L.push(`| \`${short(r.file)}\` | ${r.fanIn} | ${r.importedBy} |`);
});
L.push('');

// 孤儿文件
const orphans = rows.filter((r) => r.type === 'JS' && /无页面引用|^—$/.test(r.page) && r.fanIn === 0);
if (orphans.length) {
  L.push('## 附：无引用的文件（可考虑清理）');
  L.push('');
  L.push('| 文件 | 说明 |');
  L.push('|:---|:---|');
  orphans.forEach((r) => L.push(`| \`${short(r.file)}\` | ${r.maintain} |`));
  L.push('');
}

fs.writeFileSync(path.join(OUT_DIR, '文件维护对照表.md'), L.join('\n'), 'utf8');

console.log('════════ 文件维护对照表已生成 ════════\n');
console.log(`  文件总数: ${rows.length}`);
const byLayer = {};
rows.forEach((r) => { byLayer[r.layer] = (byLayer[r.layer] || 0) + 1; });
Object.entries(byLayer).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${String(v).padStart(2)}  ${k}`));
const missing = rows.filter((r) => r.what === '（待补充）');
if (missing.length) {
  console.log(`\n  ⚠️ ${missing.length} 个文件缺元数据：`);
  missing.slice(0, 20).forEach((r) => console.log(`     · ${r.file}`));
}
console.log('\n  输出:');
console.log('    _dev/docs/数据表/文件维护对照表.csv');
console.log('    _dev/docs/数据表/文件维护对照表.md');
