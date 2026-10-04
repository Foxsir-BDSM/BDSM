#!/usr/bin/env node
/**
 * tools/add-file-headers.mjs —— 为源文件补「文件头注释块」
 *
 * 特点：
 *   · 幂等：若已有旧注释头（以 === 分隔线开头的块），先剔除再写入，不产生重复
 *   · 安全：只改文件顶部的注释区，不触碰任何代码
 *   · 支持 JS（双斜杠）、HTML（尖括号感叹号）、CSS（斜杠星号）三种注释语法
 *
 * 用法：
 *   node tools/add-file-headers.mjs --dry     # 预览将要改动的文件
 *   node tools/add-file-headers.mjs           # 实际写入
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

// ════════════════════════════════════════════════════════════
// 每个文件的注释头内容
// ════════════════════════════════════════════════════════════
// 结构统一为五段：
//   【职责】【归属页面】【依赖】【被依赖】【维护提示】
const HEADERS = {
  // ───────── 档案馆模块（改动最频繁，优先）
  'src/modules/sub-archive/js/config.js': {
    what: '档案馆模块的配置适配层。把 shared/config/archive 的内容转出，并补充缓存与分页常量。',
    pages: '档案馆全部页面（列表 / 详情 / 后台）',
    deps: 'shared/config/archive/instances.js、api.js、schema.js',
    usedBy: 'home.js、detail.js、utils.js、api.js、admin.js、launcher/my.html、admin/admin.js',
    notes: [
      '本文件只做转发，改配置请去 shared/config/archive/ 下的 api.js 或 fields.js。',
      '★ 这里用相对路径导入（不是 @/ 别名），是为了让 Node 能直接导入做纯逻辑测试；改成别名会破坏 tools/check-affiliation-filter.mjs。',
    ],
  },
  'src/modules/sub-archive/js/home.js': {
    what: '档案列表页主逻辑：拉取数据、公开性过滤、身份分流、搜索分页、卡片渲染、拼带参表单链接。',
    pages: '档案列表页 /modules/sub-archive/index.html',
    deps: 'config.js、api.js、utils.js、shared/config/identity-config.js、shared/js/auth.js',
    usedBy: '入口模块，由 index.html 以 <script type="module" src="./js/home.js"> 加载',
    notes: [
      '★ 列表可见性判定在 isPublic()，字段取 VISIBILITY_FIELDS.publicQuestionnaire —— 不要硬编码字段 ID，迁库后会静默失效（曾导致列表全部为空）。',
      '★ 表单跳转参数在 buildFormUrl()：email / name / uid，与 Fillout 的 URL 参数一一对应。',
      '筛选条由 renderFilterBar() 动态渲染，HTML 里没有写死按钮。',
    ],
  },
  'src/modules/sub-archive/js/detail.js': {
    what: '档案详情页主逻辑：按 DETAIL_GROUPS 分板块渲染、媒体网格、隐私过滤、单位后缀。',
    pages: '档案详情页 /modules/sub-archive/detail.html',
    deps: 'config.js、api.js、utils.js',
    usedBy: '入口模块，由 detail.html 加载',
    notes: [
      '★ 板块与字段完全来自 fields.js 的 DETAIL_GROUPS，本文件不含字段清单。',
      '★ 分组 id "photos_life" / "photos_private" 在本文件被硬编码判断（决定是否走媒体网格渲染），改名会失去网格效果。',
      '单位后缀按字段 ID 查表（CARD_FIELDS.height / weight），不硬编码旧 ID。',
    ],
  },
  'src/modules/sub-archive/js/utils.js': {
    what: '档案馆通用工具：字段取值、卡片信息提取、归属解析与筛选、计数、媒体收集、隐私判定辅助。',
    pages: '档案列表页、档案详情页',
    deps: 'config.js',
    usedBy: 'home.js、detail.js',
    notes: [
      '★ getFieldValue() 同时兼容 record.data 与 record.fields 两种结构 —— 换数据源导致 API 返回结构变化时，这里是第一道防线。',
      '归属筛选会把「未标注身份」的记录一律保留，不会因筛选而丢数据。',
    ],
  },
  'src/modules/sub-archive/js/api.js': {
    what: 'Fillout / Zite Tables API 封装：分页拉取、全量拉取、单条拉取、字段更新（管理面板用）、本地缓存。',
    pages: '档案馆全部页面、管理后台',
    deps: 'config.js',
    usedBy: 'home.js、detail.js、admin.js、admin/admin.js、launcher/my.html',
    notes: [
      '★ 写接口白名单 PRIVACY_FIELD_WHITELIST 必须与 admin/admin.js 的 SUB_EDITABLE_FIELDS 保持一致，否则保存会被静默忽略。',
      '接口地址：tables.fillout.com/api/v1/bases/{BASE_ID}/tables/{TABLE_ID}/records/list',
      '⚠️ API Key 明文写在 shared/config/archive/api.js，属已知安全债。',
    ],
  },
  'src/modules/sub-archive/js/admin.js': {
    what: '档案馆后台：隐私勾选表格渲染、勾选变更收集、批量保存。',
    pages: '档案馆后台 /modules/sub-archive/admin.html',
    deps: 'api.js',
    usedBy: '入口模块，由 admin.html 加载',
    notes: [
      '⚠️ 本文件内部按下标/字段名读取（如「姓名」），与 api.js 的白名单口径（字段 ID）不一致，功能尚不完整。',
      '若要修好，需统一为字段 ID 口径，并同步 api.js 的白名单。',
    ],
  },
  'src/modules/sub-archive/js/auth.js': {
    what: '档案馆版认证封装（注册 / 登录 / 身份元数据读取）。',
    pages: '（无页面引用）',
    deps: 'shared/js/supabase-client.js',
    usedBy: '无',
    notes: [
      '⚠️ 与 shared/js/auth.js 功能重复，当前没有任何文件引用本文件。',
      '可安全删除；删除前建议全局搜索确认。',
    ],
  },

  // ───────── 共享层 · 档案馆配置
  'src/shared/config/archive/api.js': {
    what: '★ 档案馆总 API 配置：数据库 base/table ID、API Key、表单入口 URL、分页与缓存参数、默认占位图。',
    pages: '档案馆全部页面、管理后台',
    deps: '无（最底层配置）',
    usedBy: 'fields.js 无关；instances.js、sub-archive/js/config.js、tools 下多个脚本',
    notes: [
      '★ 换数据库只改本文件的 BASE_ID / TABLE_ID / API_KEY，以及表单入口 FORM_URL。',
      '★ ID 对应关系（易混）：Zite 编辑器 URL 形如 app.zite.com/workspace/<BASE>/database/<TABLE>/<VIEW>，其中 workspace 段是 base，database 段是 table。',
      '★ DEFAULT_IMAGE 必须保持 base64 形式（不含任何引号）。若改回内嵌引号的写法，会撑破卡片的 onerror 属性，导致占位图加载失败并逐卡报错。',
    ],
  },
  'src/shared/config/archive/fields.js': {
    what: '★ 档案馆字段维护文件：56 个字段的 id→名称、详情页分组（显隐板块）、卡片字段映射、搜索字段、隐私规则、列表可见性字段、筛选字段、角色可见性。',
    pages: '档案馆全部页面（列表 / 详情 / 后台）＋ 我的页面',
    deps: '无（纯声明式配置）',
    usedBy: 'archive/instances.js（聚合后供全站读取）',
    notes: [
      '★ 字段维护流程：运行 npm run fields 对比远程与本地 → 把差异按「字段id: \'名称\'」粘回本文件 → 消费方自动生效，无需改代码。',
      '★ DETAIL_GROUPS 决定详情页的板块划分。新增字段要归入某个分组，否则详情页不会展示。',
      '★ 分组 id 以 photos_ 开头的走媒体网格渲染；photos_life / photos_private 被 detail.js 硬编码引用，不要改名。',
      'PRIVACY_DEPENDENCIES 由 PRIVACY_RULES 自动派生，不需手工维护。',
    ],
  },
  'src/shared/config/archive/instances.js': {
    what: '★ 档案馆单一事实源（聚合层）：把 api.js 与 fields.js 组装成 SUB_ARCHIVE_CONFIG，供全站读取。',
    pages: '档案馆全部页面、管理后台、我的页面',
    deps: 'archive/api.js、archive/fields.js',
    usedBy: 'sub-archive/js/config.js',
    notes: [
      '本文件只做聚合与向后兼容，不直接声明字段。改字段去 fields.js，改数据源去 api.js。',
      '★ 导出契约被多处依赖，删减导出项会连锁报错。',
      'DETAIL_FIELD_ORDER 是由 DETAIL_GROUPS 展平得到的兼容项。',
    ],
  },
  'src/shared/config/archive/schema.js': {
    what: '档案馆隐私与可见性判定：隐私值是否放行、字段对角色是否可见、受控字段是否通过隐私校验。',
    pages: '档案馆全部页面',
    deps: '无',
    usedBy: 'sub-archive/js/config.js（转出给 utils.js 使用）',
    notes: [
      '改隐私规则只需增删 fields.js 的 PRIVACY_RULES，本文件的判定逻辑不需要动。',
    ],
  },
  'src/shared/config/archive/index.js': {
    what: '档案馆配置的统一导出入口（re-export schema 与 instances）。',
    pages: '（无）',
    deps: 'archive/schema.js、archive/instances.js',
    usedBy: '无',
    notes: [
      '⚠️ 当前没有任何文件引用本文件（消费方都直连 instances.js）。保留作兼容，确认无用后可删。',
    ],
  },

  // ───────── 共享层 · 身份与等级
  'src/shared/config/identity-config.js': {
    what: '★ 身份体系唯一事实源：4 身份定义（男S / 女S / 男M / 女M）、旧身份归并表、互补位置、档案默认筛选推导、主奴称谓。',
    pages: '注册页、档案列表页、我的页、资料页、等级展示',
    deps: '无',
    usedBy: 'shared/js/identity-selector.js、shared/js/level.js、sub-archive/js/home.js、launcher/my.html、launcher/profile.html',
    notes: [
      '★ 增删身份只改本文件的 IDENTITIES，注册页 / 档案筛选 / 个人页会自动跟随。',
      '★ LEGACY_IDENTITY_MAP 用于兼容历史用户（旧 12 分类 → 新 4 身份），不要删。',
      '★ 取向维度已于 2026-10-04 取消，deriveArchiveFilter 现在只按身份分流：S 看 M，M 看 S。若恢复取向，需同步改注册页、资料页、档案筛选三处。',
    ],
  },
  'src/shared/config/levelConfig.js': {
    what: '角色称谓（主 / 奴）与积分阈值配置。',
    pages: '首页、我的页、资料页',
    deps: '无',
    usedBy: 'shared/js/level.js',
    notes: [
      '等级体系已精简为仅「主 / 奴」两项，原多级阶梯已移除。若恢复阶梯等级，需重新设计本文件与 level.js。',
    ],
  },
  'src/shared/config/access.js': {
    what: '页面访问所需的角色等级定义。',
    pages: '全站（页面守卫）',
    deps: '无',
    usedBy: 'shared/js/guard.js 等',
    notes: [
      '与 guard.js 配合决定「谁能进哪个页面」。放开某页权限时改这里，而不是逐页改 HTML。',
    ],
  },

  // ───────── 共享层 · JS
  'src/shared/js/identity.js': {
    what: '当前用户与角色的读取封装（只读）。',
    pages: '全站',
    deps: 'shared/js/supabase-client.js',
    usedBy: '被 8 个文件依赖 —— 全站被依赖最多的模块',
    notes: [
      '★ 改动影响面最大，修改函数签名前请全局搜索调用点。',
      '角色值来自 Supabase 的 user_metadata.role，属于客户端可读字段。',
    ],
  },
  'src/shared/js/auth.js': {
    what: '注册 / 登录 / 登出 / 会话缓存 / 身份元数据解析。',
    pages: '全站（登录态）',
    deps: 'shared/js/supabase-client.js',
    usedBy: '被 7 个文件依赖',
    notes: [
      '身份元数据的解析在 getUserIdentity()。新增用户元数据字段时，要同步本文件与各页面的读取处。',
      '⚠️ 与 modules/sub-archive/js/auth.js 功能重复，后者已无任何引用，可清理。',
    ],
  },
  'src/shared/js/supabase-client.js': {
    what: 'Supabase 客户端单例。',
    pages: '全站',
    deps: 'shared/js/config.js',
    usedBy: '被 6 个文件依赖',
    notes: ['URL 与 anon key 在 shared/js/config.js，换后端项目只改那里。'],
  },
  'src/shared/js/guard.js': {
    what: '页面访问权限守卫：未授权的访问会跳转。',
    pages: '全站',
    deps: 'shared/js/identity.js、shared/config/access.js',
    usedBy: '各页面的入口',
    notes: ['白名单与重定向目标在本文件。放开某页权限时先看这里。'],
  },
  'src/shared/js/identity-selector.js': {
    what: '4 身份选择器组件：渲染卡片、选中态、读取选中值、重置。',
    pages: '注册页 /auth.html',
    deps: 'shared/config/identity-config.js',
    usedBy: 'launcher/auth.html',
    notes: [
      '身份数据源是 identity-config.js 的 IDENTITIES，本文件不应重复声明身份清单。',
      '★ 原「取向选择器」已于 2026-10-04 随取向维度一并移除。',
    ],
  },
  'src/shared/js/level.js': {
    what: '角色称谓与积分格式化（仅主 / 奴）。',
    pages: '首页、我的页、资料页',
    deps: 'shared/config/identity-config.js、shared/config/levelConfig.js',
    usedBy: 'launcher/index.html、launcher/my.html、launcher/profile.html',
    notes: [
      '已移除多级等级计算（calculateLevel / getLevelBadge / getLevelProgressBar）。若恢复等级阶梯需重新引入。',
    ],
  },
  'src/shared/js/ui-helpers.js': {
    what: '通用 UI 工具：toast 提示等。',
    pages: '全站',
    deps: '无',
    usedBy: '被 4 个文件依赖',
    notes: ['改函数签名要全局搜索调用点。'],
  },
  'src/shared/js/registry.js': {
    what: '★ 模块注册表（PROJECTS）：首页模块卡片墙的数据源。',
    pages: '首页 /index.html',
    deps: 'shared/js/config.js',
    usedBy: 'launcher.js、首页相关逻辑',
    notes: [
      '★ 增删功能模块改这里 —— 每项含 id / 名称 / 图标 / 路径 / 所需权限。不要改首页 HTML 来加模块。',
    ],
  },
  'src/shared/js/main.js': {
    what: '首版启动器入口（登录表单 + 角色中文映射）。',
    pages: '（无页面引用）',
    deps: 'auth.js、identity.js、launcher.js、ui-helpers.js',
    usedBy: '无',
    notes: [
      '⚠️ 已被各页面的独立入口取代，当前没有任何页面引用本文件。可安全删除。',
    ],
  },
  'src/shared/js/avatar.js': {
    what: '头像上传与读取（Supabase Storage 的 avatars 桶）。',
    pages: '资料页 /profile.html',
    deps: 'shared/js/supabase-client.js',
    usedBy: 'launcher/profile.html',
    notes: ['桶名与路径规则在本文件。上传失败优先排查 Storage 的 RLS 策略。'],
  },
  'src/shared/js/cache.js': {
    what: '本地缓存封装（带过期时间）。',
    pages: '全站',
    deps: '无',
    usedBy: '按需调用',
    notes: ['档案馆另有自己的缓存键，见 shared/config/archive/api.js 的 CACHE_KEY / CACHE_TTL。'],
  },
  'src/shared/js/request.js': {
    what: 'HTTP 请求封装（超时、重试、错误统一处理）。',
    pages: '全站',
    deps: '无',
    usedBy: '按需调用',
    notes: ['改超时 / 重试策略在这里。'],
  },
  'src/shared/js/loading.js': {
    what: '全屏加载遮罩：showLoading / hideLoading。',
    pages: '全站',
    deps: '无',
    usedBy: '多个页面',
    notes: ['通用组件，一般不需要改。'],
  },
  'src/shared/js/config.js': {
    what: 'Supabase 连接参数与全局常量。',
    pages: '全站',
    deps: '无',
    usedBy: 'supabase-client.js、registry.js 等',
    notes: ['换后端项目只改这里。'],
  },
  'src/shared/js/launcher.js': {
    what: '首页模块卡片渲染。',
    pages: '首页 /index.html',
    deps: 'shared/js/registry.js',
    usedBy: 'launcher/index.html',
    notes: ['卡片数据来自 registry.js。'],
  },

  // ───────── 管理后台
  'src/admin/admin.js': {
    what: '管理后台主逻辑：用户角色管理、档案隐私勾选编辑、档案检索、Tab 切换。',
    pages: '管理后台 /admin.html',
    deps: 'shared/js/identity.js、auth.js、supabase-client.js、ui-helpers.js、sub-archive/js/api.js、sub-archive/js/config.js',
    usedBy: '入口模块，由 admin.html 加载',
    notes: [
      '★ 档案可编辑字段在 SUB_EDITABLE_FIELDS，字段 ID 从 config 读取（VISIBILITY_FIELDS / PRIVACY_CONTROL_IDS / CARD_FIELDS）—— 再迁库只改 fields.js 即可。',
      '★ 该清单必须与 sub-archive/js/api.js 的 PRIVACY_FIELD_WHITELIST 一致，否则保存会被静默忽略。',
      '本文件内置了一份 getFieldValue，与 sub-archive/js/utils.js 的同名函数是两份实现。',
    ],
  },
  'src/admin/content-manager.js': {
    what: '内容管理：内容列表读取、发布、删除（对接 GitHub 仓库 foxsir-content）。',
    pages: '管理后台的内容管理页',
    deps: 'content-config.js',
    usedBy: '内容管理页面',
    notes: [
      '仓库 / 分支 / 路径在 content-config.js。',
      '⚠️ VITE_GITHUB_TOKEN 会被 Vite 内联进前端产物，属已知安全债。',
    ],
  },
  'src/admin/content-config.js': {
    what: '内容仓库配置（owner / repo / branch / 路径）。',
    pages: '管理后台的内容管理页',
    deps: '无',
    usedBy: 'content-manager.js、admin-article.html',
    notes: ['换仓库或分支只改这里。'],
  },

  // ───────── 内容模块
  'src/modules/content/js/content-types.js': {
    what: '★ 内容类型定义：类型清单、每类的字段结构、校验规则。',
    pages: '内容模块全部页面（列表 / 详情 / 编辑器）',
    deps: '无',
    usedBy: 'editor.js、renderers.js、render.js',
    notes: [
      '★ 这是内容模块的单一事实源：增删字段、改校验都从这里入手，编辑器的表单会自动跟随生成。',
      '新增内容类型需同时在本文件与 renderers.js 加渲染分支。',
    ],
  },
  'src/modules/content/js/editor.js': {
    what: '结构化内容编辑器主逻辑：表单生成、实时预览、提交。',
    pages: '内容编辑器 /modules/content/post-editor.html',
    deps: 'content-types.js 等',
    usedBy: '入口模块，由 post-editor.html 加载',
    notes: [
      '★ 表单由 content-types.js 的定义驱动生成，不要在本文件硬编码字段。',
    ],
  },
  'src/modules/content/js/render.js': {
    what: '内容渲染入口与数据获取。',
    pages: '内容列表、内容详情、我的页',
    deps: 'renderers.js、content-types.js',
    usedBy: '被 3 个页面共用',
    notes: ['改动输出结构要三处同查。'],
  },
  'src/modules/content/js/renderers.js': {
    what: '按内容类型分发的渲染器实现。',
    pages: '内容详情页',
    deps: 'content-types.js',
    usedBy: 'render.js',
    notes: ['新增内容类型时在此加一个渲染分支。'],
  },
};

// ════════════════════════════════════════════════════════════
// 注释块渲染
// ════════════════════════════════════════════════════════════
function renderHeader(meta, style) {
  const lines = [];
  lines.push('职责    ' + meta.what);
  lines.push('归属页面 ' + meta.pages);
  if (meta.deps) lines.push('依赖    ' + meta.deps);
  if (meta.usedBy) lines.push('被依赖   ' + meta.usedBy);
  if (meta.notes?.length) {
    lines.push('');
    lines.push('维护提示');
    meta.notes.forEach((n) => lines.push('  · ' + n));
  }

  if (style === 'html') {
    return ['<!--', ...lines.map((l) => (l ? '  ' + l : '')), '-->'].join('\n') + '\n';
  }
  if (style === 'css') {
    return ['/*', ...lines.map((l) => (l ? ' * ' + l : ' *')), ' */'].join('\n') + '\n';
  }
  return lines.map((l) => (l ? '// ' + l : '//')).join('\n') + '\n';
}

/** 剔除文件顶部已存在的注释头（含旧的 === 分隔块），返回剩余内容 */
function stripExistingHeader(code, style) {
  if (style === 'html') {
    // 顶部若干行注释 + 可选 doctype 之前的内容
    const m = code.match(/^\s*<!--[\s\S]*?-->\s*\n/);
    if (m) return code.slice(m[0].length);
    return code;
  }
  if (style === 'css') {
    const m = code.match(/^\s*\/\*[\s\S]*?\*\/\s*\n/);
    if (m) return code.slice(m[0].length);
    return code;
  }
  // JS：连续的前导 // 注释块（含 === 分隔线）
  const lines = code.split('\n');
  let i = 0;
  while (i < lines.length && (/^\s*\/\//.test(lines[i]) || lines[i].trim() === '')) i++;
  // 若第一个非注释行之前没有任何注释，则不动
  const hadComment = lines.slice(0, i).some((l) => /^\s*\/\//.test(l));
  if (!hadComment) return code;
  return lines.slice(i).join('\n');
}

// ════════════════════════════════════════════════════════════
// 执行
// ════════════════════════════════════════════════════════════
let changed = 0, skipped = 0;
const report = [];

for (const [file, meta] of Object.entries(HEADERS)) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) { report.push(`  ✗ 不存在: ${file}`); skipped++; continue; }

  const style = file.endsWith('.html') ? 'html' : file.endsWith('.css') ? 'css' : 'js';
  const orig = fs.readFileSync(abs, 'utf8');
  const body = stripExistingHeader(orig, style);
  const header = renderHeader(meta, style);
  const next = header + (style === 'html' ? body : body);

  if (next === orig) { skipped++; continue; }
  if (!DRY) fs.writeFileSync(abs, next, 'utf8');
  changed++;
  const delta = next.length - orig.length;
  report.push(`  ${DRY ? '·' : '✓'} ${file.padEnd(52)} ${delta >= 0 ? '+' : ''}${delta} B`);
}

console.log('════════ 文件头注释块 ════════\n');
report.forEach((r) => console.log(r));
console.log(`\n  ${DRY ? '将修改' : '已修改'} ${changed} 个文件，跳过 ${skipped} 个`);
if (DRY) console.log('  （预览模式，未写入。去掉 --dry 执行）');
