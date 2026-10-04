# 2026-10-05 · 遗留后台归档

## 归档内容

档案馆（`src/modules/sub-archive/`）下的一套**旧版独立后台**：

| 文件 | 说明 |
|:---|:---|
| `admin.html` | 旧后台页面，未被构建为入口，无人引用 |
| `admin.js` | 其逻辑，内部按下标/字段名读取，与 `api.js` 的白名单口径（字段 ID）不一致 |
| `admin.css` | 该页专用样式 |

## 为什么归档而不是保留

档案管理已经统一到主管理面板（`src/admin/admin.html` → `/admin.html`），
该面板的「全部档案」标签页提供了同样的隐私勾选表格，且：

- 口径正确（用字段 ID，与 `api.js` 的写白名单一致）
- 已适配手机端（横向滚动、列名不竖排、工具栏吸顶）
- 被构建为正式入口

旧后台两者都不满足，留在源码树里只会造成混淆
（例如本次排查时，一度以为改完主面板就够了，实际旧后台里还留着「📤 Push 生效」等字样）。

## ⚠️ 归档前确认过的事

**`js/api.js` 没有动，也不能动。** 它虽然同在这个目录下，但被大量在用的代码依赖：

```
src/admin/admin.js            主管理面板：写档案字段
src/launcher/my.html          我的页面：改隐私开关
src/modules/sub-archive/home.js    档案列表
src/modules/sub-archive/detail.js  档案详情
```

本次归档前逐一查过引用关系，确认只有 `admin.html` / `js/admin.js` 是死代码。

同样保留的还有 `css/global.css`（被在用的 `index.html` 与 `detail.html` 引用）。

## 副作用

`js/api.js` 的 `fetchAllRecords()` 因此失去唯一调用方，成为死代码。
保留未删 —— 它是通用读取接口，日后若要导出全量档案仍可用。

## 若要恢复

把三个文件移回 `src/modules/sub-archive/` 对应位置即可。
但恢复前请先确认：主管理面板的「全部档案」是否已满足需求。
