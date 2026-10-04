# 📚 Foxsir-BDSM SOP 文档索引

本目录存放项目的标准操作流程（SOP）和技术文档，方便维护时快速查阅。


## 📖 文档列表

| 文档 | 说明 | 适用场景 |
| :--- | :--- | :--- |
| [DEV_ENV.md](./DEV_ENV.md) | 开发环境配置说明（VS Code 插件 + 配置） | 新环境搭建、插件安装 |
| [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md) | **档案模块完整维护 SOP**（字段/映射/权限/隐私） | 90% 的日常维护工作 |
| [REPORT_v2.2.md](./REPORT_v1.0_v2.0.md) | 项目完整开发报告（v1.0 → v2.2） | 项目状态回顾、后续规划参考 |


## 🚀 快速导航

### 我想新增一个字段
→ [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md#第二部分映射mapping的配置与维护)

### 我想调整隐私开关
→ [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md#31-privacy_rules--隐私控制规则)

### 我想修改角色权限
→ [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md#33-role_field_visibility--角色权限白名单)

### 我想调整模块访问权限
→ [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md#34-模块权限配置-v22)

### 我想换 Fillout 数据表
→ [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md#第四部分api-与数据源配置)

### 我遇到显示问题
→ [FIELD_MAINTENANCE_SOP.md](./FIELD_MAINTENANCE_SOP.md#第八部分故障排查指南)

### 我想搭建开发环境
→ [DEV_ENV.md](./DEV_ENV.md)

### 我想回顾项目历史
→ [REPORT_v1.0_v2.0.md](./REPORT_v1.0_v2.0.md)


## 📌 当前项目状态（v2.2）

| 项目 | 状态 |
| :--- | :--- |
| 版本 | v2.2 |
| 部署平台 | Vercel（已迁移） |
| 域名 | `foxsir.top` ✅ 已绑定 |
| 核心功能 | 全部六大板块已上线 |
| 权限体系 | 5 层角色（guest/self/verified/subadmin/admin） |
| 内容管理 | 知识区/任务区（发布+删除，不可编辑） |
| 缓存机制 | localStorage 永久缓存（管理员操作时清除） |


## 📝 文档维护说明

- 所有 SOP 文档使用 Markdown 格式
- 修改配置后，如发现 SOP 与实际代码不符，请同步更新对应文档
- 重大功能变更后，建议补充新的 SOP 章节
- 当前 SOP 版本对应 **v2.2**

---

**最后更新**：2026-07-20