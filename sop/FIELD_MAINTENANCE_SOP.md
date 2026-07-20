```markdown
# 📋 Foxsir-BDSM 档案模块完整维护 SOP

**适用版本**：v2.2+  
**维护范围**：下位者档案馆（sub-archive）的字段、映射、分组、权限、隐私、API 等全部配置  
**核心原则**：**90% 的档案变更只需修改 1 个文件 → `instances.js`**


## 📁 档案模块文件架构总览
assets/
├── config/
│ └── archive/
│ ├── schema.js # 【工具层】字段处理通用函数（极少修改）
│ ├── instances.js # 【配置层】★ 核心维护文件 ★ 所有字段/分组/权限/隐私配置
│ └── index.js # 【导出层】统一导出入口（无需修改）
│
├── pages/
│ └── sub-archive/
│ └── assets/
│ ├── js/
│ │ ├── api.js # 【数据层】Fillout API 调用（换表/换Key时修改）
│ │ ├── config.js # 【桥接层】从 instances.js 导入并重新导出（无需修改）
│ │ ├── detail.js # 【渲染层】详情页渲染（特殊格式/单位需修改）
│ │ ├── home.js # 【渲染层】首页列表渲染（一般无需修改）
│ │ ├── admin.js # 【管理面板】字段白名单（新增可切换字段时修改）
│ │ └── utils.js # 【工具层】字段过滤/提取函数（逻辑变更时修改）
│ └── css/ # 样式文件（无需修改）
│
└── js/
└── admin.js # 【全局管理面板】与子项目 admin.js 联动

text


## 🔑 第一部分：Key（字段ID）的获取与维护

### 1.1 如何获取字段 ID

| 方法 | 操作步骤 | 适用场景 |
| :--- | :--- | :--- |
| **方法一：Fillout 后台** | 进入 Fillout 表 → 点击字段设置 → URL 或字段属性中查看 `fieldId` | 新建字段后首次获取 |
| **方法二：浏览器控制台** | 打开任意详情页 → F12 Console → 输入 `record.data` 查看所有字段 ID | 快速查看已有字段 |
| **方法三：API 调试** | 在 Console 执行 `(await import('/assets/pages/sub-archive/assets/js/api.js')).fetchAllRecords().then(r => console.log(Object.keys(r[0].data)))` | 批量获取所有字段 ID |

### 1.2 字段 ID 命名规范

| 类型 | 格式 | 示例 | 说明 |
| :--- | :--- | :--- | :--- |
| Fillout 原生字段 | `f` + 随机字母数字 | `fqidTsBW5js` | Fillout 自动生成，不可自定义 |
| 系统内部字段 | `id`, `createdAt`, `updatedAt` | — | 由 Fillout 自动生成，前端不展示 |
| 隐私控制字段 | 任意 Fillout ID | `f1s9DJg4oLc` | 通常为 Checkbox 类型，控制其他字段显隐 |

### 1.3 字段 ID 变更的影响范围

| 变更操作 | 影响范围 | 需同步更新的文件 |
| :--- | :--- | :--- |
| **新增字段 ID** | 无影响（新增配置） | `instances.js` |
| **修改字段 ID（Fillout 中重命名）** | 🔴 破坏性变更 | 所有引用该 ID 的地方（`instances.js` + `admin.js` + `detail.js` 硬编码） |
| **删除字段 ID** | 该字段前端不再显示 | 从 `instances.js` 中移除所有引用 |

> ⚠️ **警告**：切勿在 Fillout 中随意修改已有字段的 ID，否则需要全局搜索替换所有配置文件。


## 🗺️ 第二部分：映射（Mapping）的配置与维护

### 2.1 映射层级关系图
Fillout 字段 ID（如 'fqidTsBW5js'）
↓
FIELD_LABELS（映射为中文标签 '姓名'）
↓
┌───────┼───────┐
↓ ↓ ↓
CARD_FIELDS DETAIL_GROUPS ROLE_FIELD_VISIBILITY
（首页展示） （详情分组） （权限控制）

text

### 2.2 各映射配置详解

#### 2.2.1 `FIELD_LABELS` —— 字段 ID → 中文标签

```javascript
FIELD_LABELS: {
  // 格式：'字段ID': '中文显示名',
  'fqidTsBW5js': '姓名',
  'fxwUAnrwpaT': '编号',
  'fgerzjJpBTF': '公开问卷',
  // ... 所有字段都必须在此定义
}
维护场景：

操作	修改内容	示例
新增字段	添加一行 '字段ID': '中文名'	'f_new_hobby': '爱好'
修改标签	改 '字段ID' 对应的值	'fqidTsBW5js': '圈名'
删除字段	删除该行（可选，保留也不影响）	—
重命名字段 ID	删除旧行，新增新行	替换所有引用
2.2.2 CARD_FIELDS —— 首页卡片字段映射
javascript
CARD_FIELDS: {
  // 格式：'业务名': '字段ID',
  name: 'fqidTsBW5js',         // 姓名
  nameFallback: 'fWqX2MxS94b', // 备用姓名
  photo: 'fgtX9QmBAM5',        // 主照片
  photoFallback: 'fRzWgx82L7A',// 备用照片
  age: 'f3sJj8pDk2E',          // 年龄
  area: 'f1s9DJg4oLc',         // 地区（受隐私控制）
  height: 'ffcCmCH3kSE',       // 身高
  weight: 'fgSKHPJhFhb',       // 体重
  recommend: 'fh7s8qR2c3X',    // 推荐指数
  verified: 'fwK2mQMoxto',     // 认证状态
}
维护场景：

操作	修改内容	示例
更换首页显示的字段	修改对应的值	age: 'f_new_age_id'
新增首页字段	新增一行	hobby: 'f_new_hobby'
删除首页字段	删除该行	—
⚠️ 注意：photo 和 photoFallback 用于展示头像，受隐私控制（fgtX9QmBAM5 为 true 时可见）。

2.2.3 DETAIL_GROUPS —— 详情页分组配置
javascript
DETAIL_GROUPS: [
  {
    id: 'basic_info',           // 分组唯一标识（用于程序判断）
    title: '📋 基本信息',       // 分组显示标题
    fields: [
      'fqidTsBW5js',            // 字段 ID 按显示顺序排列
      'fxwUAnrwpaT',
      'f3sJj8pDk2E',
      // ...
    ],
  },
  {
    id: 'photos_life',          // ★ 以 'photos_' 开头 → 自动触发媒体网格渲染
    title: '📸 生活写照',
    fields: ['fgtX9QmBAM5'],
  },
  // ...
]
分组 ID 约定：

分组 ID 前缀	渲染模式	说明
photos_	媒体网格（图片/视频）	自动按横/竖屏分类，支持 Lightbox
其他	普通字段列表	以标签+值的形式逐行展示
维护场景：

操作	修改内容	示例
调整分组顺序	移动 DETAIL_GROUPS 数组中对象的位置	将 photos_life 移到 basic_info 前面
调整字段顺序	修改某个分组内 fields 数组的顺序	fields: ['a', 'b', 'c'] → fields: ['c', 'a', 'b']
新增分组	在 DETAIL_GROUPS 数组中新增一个对象	按格式添加
删除分组	删除该对象	—
字段移入/移出分组	增删 fields 数组中的字段 ID	—
创建新的媒体分组	id 以 'photos_' 开头	{ id: 'photos_work', title: '🖼️ 作品集', fields: ['f_work_photos'] }
2.2.4 SEARCH_FIELDS —— 搜索匹配字段
javascript
SEARCH_FIELDS: [
  'fqidTsBW5js',    // 姓名
  'fI5zGTDkg2W',    // 职业
  'fF9i8Q5CgBe',    // 地区
  // 新增字段如需被搜索命中，在此添加 ID
]
2.2.5 SYSTEM_FIELD_IDS —— 系统字段（不展示）
javascript
SYSTEM_FIELD_IDS: {
  // 这些字段在任何页面都不展示（纯系统用）
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}
2.2.6 HOME_ONLY_FIELD_IDS —— 仅首页卡片使用（详情页不展示）
javascript
HOME_ONLY_FIELD_IDS: [
  'fWqX2MxS94b',   // 备用姓名（仅首页用）
  'fRzWgx82L7A',   // 备用照片（仅首页用）
  'fgtX9QmBAM5',   // 生活照片（首页专用，详情页由分组控制）
]
2.2.7 EXTRA_EXCLUDED_FIELD_IDS —— 额外排除字段
javascript
EXTRA_EXCLUDED_FIELD_IDS: [
  // 需要排除的自定义字段（首页、详情页都不显示）
  'f_system_flag',
  'f_internal_note',
]
🔐 第三部分：权限（Permission）与隐私（Privacy）配置
3.1 PRIVACY_RULES —— 隐私控制规则
javascript
PRIVACY_RULES: [
  // 格式：{ controlId: '控制字段ID', displayIds: ['受控字段ID1', '受控字段ID2'] }
  {
    controlId: 'f1s9DJg4oLc',  // 常住地址（隐私确认）开关
    displayIds: ['fD4kL9s8J2X'], // 详细地址字段
  },
  {
    controlId: 'fgHLgfGRzy8',  // 联系方式（隐私确认）开关
    displayIds: ['fC3mN7pQ5R1', 'fG8hT2wY6Zb'], // 电话、微信等
  },
  // ...
]
工作原理：

用户在前端勾选 f1s9DJg4oLc（公开地区）

系统检查该字段值 → true 则显示 displayIds 中的字段，否则隐藏

维护场景：

操作	修改内容	示例
新增隐私控制	新增一个规则对象	{ controlId: 'f_public_email', displayIds: ['f_email'] }
修改受控字段	增删 displayIds 数组中的字段 ID	—
删除隐私规则	删除该对象	—
3.2 PRIVACY_DEPENDENCIES —— 字段隐私依赖（快速查询映射）
javascript
PRIVACY_DEPENDENCIES: {
  // 格式：'受控字段ID': '控制字段ID'
  'fD4kL9s8J2X': 'f1s9DJg4oLc',  // 详细地址 依赖 地区公开开关
  'fC3mN7pQ5R1': 'fgHLgfGRzy8',  // 电话 依赖 联系方式公开开关
  'fG8hT2wY6Zb': 'fgHLgfGRzy8',  // 微信 依赖 联系方式公开开关
}
💡 这是一个快速查找表，用于 filterFieldsByRoleAndPrivacy 函数快速判断某字段是否受隐私控制。

3.3 ROLE_FIELD_VISIBILITY —— 角色权限白名单（v2.2 完整版）
javascript
ROLE_FIELD_VISIBILITY: {
  // 游客：仅看公开基础信息
  guest: ['fqidTsBW5js', 'fxwUAnrwpaT'],
  
  // 普通用户：可看大部分字段，但联系方式固定不可见
  self: [
    'fqidTsBW5js',       // 姓名
    'fxwUAnrwpaT',       // 编号
    'f3sJj8pDk2E',       // 年龄
    'fgerzjJpBTF',       // 公开问卷
    // ★ 注意：联系方式 fgHLgfGRzy8 在此处被移除，普通用户不可见 ★
  ],
  
  // 认证用户：可看联系方式，但其他隐私字段受管控
  verified: [
    'fqidTsBW5js',
    'fxwUAnrwpaT',
    'f3sJj8pDk2E',
    'fgerzjJpBTF',
    'fgHLgfGRzy8',       // ★ 联系方式可见 ★
    'fwK2mQMoxto',       // 认证状态
  ],
  
  // 次级管理：完整档案管理权限（不可升级用户角色）
  subadmin: [
    '*',                 // ★ 所有字段可见，但受隐私依赖控制 ★
  ],
  
  // 根源管理：最高权限
  admin: [
    '*',                 // ★ 所有字段可见，受隐私依赖控制 ★
  ],
}
角色定义（v2.2 更新）：

角色	代码	板块访问	知识区/任务区	档案馆	管理后台
游客	guest	❌ 仅 Landing/About/Auth	❌	❌	❌
普通用户	self	✅ 全部六大板块	✅ 只读	✅ 联系方式固定不可见	❌
认证用户	verified	✅ 全部六大板块	✅ 可发布	✅ 隐私字段管控	❌
次级管理	subadmin	✅ 全部六大板块	✅ 可发布+删除	✅ 可管理隐私字段	✅ 不可升级用户
根源管理	admin	✅ 全部六大板块	✅ 全权限	✅ 全权限	✅ 全权限
维护场景：

操作	修改内容	示例
某字段仅对认证用户可见	在 self 的数组中删除该 ID，在 verified 中添加	—
放宽某字段至普通用户可见	在 self 的数组中添加该 ID	—
新增角色	在对象中新增一个 key	new_role: ['field1', 'field2']
3.4 模块权限配置（v2.2）
模块访问权限在 assets/js/config.js 的 PROJECTS 中配置：

javascript
// 每个模块的 requiredRoles 定义哪些角色可以访问
export const PROJECTS = [
  {
    id: 'knowledge',
    name: '📖 欲识之海',
    requiredRoles: ['self', 'verified', 'subadmin', 'admin'],  // 访客不可访问
  },
  // ...
];
角色	可访问模块
guest	无（仅 Landing/About/Auth）
self	全部六大板块
verified	全部六大板块
subadmin	全部六大板块
admin	全部六大板块
🔌 第四部分：API 与数据源配置
4.1 api.js 中的基础配置
javascript
export const CONFIG = {
  DATABASE_ID: '0019555500b60c58',  // Fillout 数据库 ID
  TABLE_ID: 'taRmZxGFzF5',          // Fillout 表 ID
  API_KEY: 'sk_prod_xxx...',        // Fillout API Key
  FORM_URL: 'https://forms.fillout.com/t/sZm1g43KzHus',  // 表单链接
  DEFAULT_IMAGE: 'data:image/svg+xml,...',  // 默认占位图
};
维护场景：

操作	修改内容	需同步变更
更换 Fillout 表	修改 DATABASE_ID 和 TABLE_ID	instances.js 中的字段 ID 需同步更新
API Key 过期/更换	修改 API_KEY	无
更换占位图	修改 DEFAULT_IMAGE	无
4.2 缓存相关配置
javascript
export const CACHE_KEY = 'foxsir_sub_archive_cache';  // 缓存存储 key
export const CACHE_TTL = 5 * 60 * 1000;               // 缓存有效期（5分钟）
export const PAGE_SIZE = 20;                           // 每页记录数
🔄 第五部分：完整数据流（从数据到展示）
text
┌─────────────────────────────────────────────────────────────────────┐
│  1. Fillout 数据源                                                │
│     └── 字段: fqidTsBW5js, fxwUAnrwpaT, f3sJj8pDk2E, ...        │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. api.js 请求数据                                               │
│     └── fetchRecordById(id) → { id, data: { ... }, fields: { ... } }│
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. instances.js 配置映射                                         │
│     ├── FIELD_LABELS: 'fqidTsBW5js' → '姓名'                     │
│     ├── DETAIL_GROUPS: 分组结构                                   │
│     ├── PRIVACY_RULES: 隐私控制规则                               │
│     └── ROLE_FIELD_VISIBILITY: 角色权限                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│  4. detail.js 渲染                                                │
│     ├── buildFieldMap() → 字段 ID → { label, value }             │
│     ├── buildGroupedFieldsFromConfig() → 按 DETAIL_GROUPS 分组   │
│     ├── filterFieldsByRoleAndPrivacy() → 权限+隐私过滤            │
│     └── 渲染 HTML → 展示最终结果                                 │
└─────────────────────────────────────────────────────────────────────┘
📝 第六部分：常见变更操作速查表
你想做什么	涉及文件	具体操作
新增普通展示字段	instances.js	① FIELD_LABELS 加一行
② DETAIL_GROUPS 对应分组加 ID
③ 可选：CARD_FIELDS 加映射
④ 可选：SEARCH_FIELDS 加 ID
修改字段中文名	instances.js	修改 FIELD_LABELS 对应值
调整详情页分组顺序	instances.js	移动 DETAIL_GROUPS 数组顺序
调整分组内字段顺序	instances.js	修改 fields 数组顺序
字段移入/移出分组	instances.js	增删 fields 数组中的 ID
新增隐私控制	instances.js	① PRIVACY_RULES 加规则
② PRIVACY_DEPENDENCIES 加依赖
调整角色权限	instances.js	修改 ROLE_FIELD_VISIBILITY 对应角色数组
新增可切换的隐私字段	instances.js + admin.js	① 按"新增隐私控制"操作
② admin.js 的 SUB_EDITABLE_FIELDS 加该字段 ID
调整模块访问权限	assets/js/config.js	修改 PROJECTS 中对应模块的 requiredRoles
带单位的数值字段	instances.js + detail.js	① 按"新增普通展示字段"操作
② detail.js 的 switch 中新增 case
星级评分字段	instances.js + detail.js	① 按"新增普通展示字段"操作
② detail.js 的 if 条件中加入该 ID
更换 Fillout 表	api.js + instances.js	① api.js 改 DATABASE_ID / TABLE_ID
② instances.js 全部字段 ID 替换为新表 ID
更换 API Key	api.js	修改 API_KEY
删除字段	instances.js	从所有配置数组中移除该字段 ID
清除缓存（调试用）	浏览器控制台	执行 localStorage.clear()
🧪 第七部分：变更后验证清单
每次修改后，按以下清单验证：

序号	验证项	验证方法
1	字段标签是否正确	打开详情页，检查字段显示名
2	字段顺序是否正确	检查详情页分组内字段顺序
3	分组顺序是否正确	检查详情页各分组显示顺序
4	新增字段是否显示	查看包含该字段的档案详情
5	删除字段是否消失	刷新详情页确认不再显示
6	隐私开关是否生效	在管理面板切换，刷新详情页
7	角色权限是否正确	用不同角色登录查看同一档案
8	搜索是否命中	输入新字段内容搜索
9	媒体字段是否正常	图片/视频加载、点击放大
10	控制台无报错	检查 F12 Console
🚨 第八部分：故障排查指南
8.1 详情页某字段不显示
可能原因	排查方法	解决方案
字段未在 FIELD_LABELS 中定义	检查配置文件	添加标签
字段未在 DETAIL_GROUPS 中引用	检查分组配置	添加字段 ID
字段值在 Fillout 中为空	查看 record.data	填充数据
角色权限不足	查看 ROLE_FIELD_VISIBILITY	添加权限
隐私规则阻止显示	检查 PRIVACY_RULES	修改规则或填充控制字段
8.2 首页卡片字段不显示
可能原因	排查方法	解决方案
字段未在 CARD_FIELDS 中映射	检查配置	添加映射
字段值在 Fillout 中为空	查看 record.data	填充数据
隐私规则阻止显示	检查 PRIVACY_RULES	修改规则
8.3 搜索搜不到某字段
可能原因	排查方法	解决方案
字段未在 SEARCH_FIELDS 中	检查配置	添加字段 ID
浏览器缓存了旧数据	清除缓存	localStorage.clear()
8.4 控制台报错
报错信息	可能原因	解决方案
Cannot read properties of undefined (reading 'xxx')	字段 ID 不存在或拼写错误	检查 instances.js 中字段 ID 与 Fillout 一致
FIELD_LABELS is not defined	导入路径错误	检查 import 路径
record.data is undefined	API 返回数据结构变化	检查 api.js 的数据解析逻辑
📌 第九部分：关键文件边界说明
文件	修改边界	何时需要改
instances.js	所有字段、分组、权限、隐私配置	90% 的变更
admin.js（子项目）	SUB_EDITABLE_FIELDS 数组	新增管理面板可切换的隐私字段
detail.js	特殊渲染逻辑（单位、星级）	新增带特殊格式的字段
api.js	API 连接参数	更换数据源或 API Key
schema.js	工具函数	修改底层逻辑时
utils.js	过滤/提取函数	修改隐私/权限逻辑时
config.js（子项目）	不修改	它是桥接层，从 instances.js 读取
✅ 第十部分：v2.2 权限体系总结
角色权限矩阵
角色	板块访问	知识区/任务区	档案馆	管理后台
访客	❌ 仅 Landing/About/Auth	❌	❌	❌
self	✅ 全部六大板块	✅ 只读	✅ 联系方式固定不可见	❌
verified	✅ 全部六大板块	✅ 可发布（不可编辑/删除）	✅ 隐私字段管控	❌
subadmin	✅ 全部六大板块	✅ 可发布 + 可删除	✅ 可管理隐私字段	✅ 不可升级用户
admin	✅ 全部六大板块	✅ 全权限	✅ 全权限	✅ 全权限
核心记忆法则
改字段 → 改 instances.js
改特殊显示 → 改 detail.js
改管理面板 → 改 admin.js
改数据源 → 改 api.js
改模块权限 → 改 config.js (PROJECTS)
改角色白名单 → 改 instances.js (ROLE_FIELD_VISIBILITY)