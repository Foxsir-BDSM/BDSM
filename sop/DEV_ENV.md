# 📄 文件 3：`sop/DEV_ENV.md`

```markdown
# 项目开发环境说明文档 (Development Environment Spec)

> **适用项目**：纯静态前端（HTML + CSS + JavaScript）  
> **核心工具**：Visual Studio Code (VS Code)  
> **文档版本**：v1.0


## 一、插件矩阵总览

| 功能维度 | 插件名称 | 核心职责 | 必要等级 | 关键操作 / 配置提示 |
| :--- | :--- | :--- | :--- | :--- |
| **🚀 运行预览** | **Live Server** | 右键HTML启动本地开发服务器，模拟Nginx/Apache部署环境，支持热重载 | ★★★★★ (必装) | 1. 必须通过 `文件 -> 打开文件夹` 导入项目根目录<br>2. 右键HTML → `Open with Live Server` |
| **🚀 运行预览** | **Live Preview** | 在VS Code内部直接嵌入预览窗口，无需切换浏览器 | ★★★☆☆ (可选) | 点击编辑器右上角分屏图标即可启用 |
| **🛠 纠错质检** | **ESLint** | 实时检查JS/TS语法错误、代码风格违规，支持自动修复 | ★★★★★ (必装) | 项目根目录需有 `.eslintrc.js` 配置文件 |
| **🛠 纠错质检** | **HTML-JS-CSS Analyzer** | 一站式检查三件套的拼写错误、未使用的CSS类、重复ID等 | ★★★★☆ (强烈推荐) | 安装即用，与ESLint形成互补（一个管逻辑，一个管结构） |
| **🛠 纠错质检** | **Error Lens** | 将报错信息以红色/黄色下划线直接**渲染在代码行末尾** | ★★★☆☆ (推荐) | 无需配置，装完即可在编写时肉眼感知错误 |
| **✨ 效率辅助** | **Auto Rename Tag** | 修改HTML开始标签时，自动同步修改对应的闭合标签 | ★★★★★ (必装) | 零配置，装完即生效 |
| **✨ 效率辅助** | **HTML CSS Support** | 在HTML的 `class` 和 `id` 属性中，智能补全CSS文件里定义的类名/ID名 | ★★★★☆ (强烈推荐) | 装完即可，极大减少样式名拼写错误 |
| **✨ 效率辅助** | **CSS Peek** | 在HTML中按住 `Ctrl` (Mac为 `Cmd`) + 鼠标点击类名，**直接跳转**到CSS定义处 | ★★★★☆ (强烈推荐) | 支持 `Go to Definition` 和 `Peek` 两种模式 |
| **✨ 效率辅助** | **Path Intellisense** | 输入 `src=` 或 `href=` 时，自动补全文件/文件夹路径 | ★★★★☆ (强烈推荐) | 安装即用，告别手动输入 `../../` 层级 |
| **🎨 代码美化** | **Prettier** | 保存时自动格式化HTML/CSS/JS代码，统一缩进、分号、引号风格 | ★★★★★ (必装) | **必须开启**：设置中搜索 `Format On Save` 并打勾 |
| **📁 视觉辅助** | **vscode-icons** | 根据文件类型显示不同图标（如JS蓝色、CSS橙色、HTML红色） | ★★★☆☆ (推荐) | 安装后若未生效，需在设置中启用 `File Icon Theme` |
| **🌐 版本控制** | **GitLens** | 在代码行尾显示该行最后的提交人、提交时间和commit信息 | ★★☆☆☆ (按需) | 适合团队协作，个人项目可不装 |
| **🌐 界面语言** | **Chinese (Simplified) Language Pack** | 将VS Code界面完全汉化为简体中文 | ★★★☆☆ (新手推荐) | 安装后需 `Ctrl+Shift+P` → 输入 `Configure Display Language` 切换 |


## 二、核心配置推荐 (settings.json)

为了让上述插件协同工作，建议在项目根目录新建 `.vscode/settings.json` 并写入以下配置（矩阵中的必装插件将按此规则运行）：

```json
{
  // ----- 编辑器基础 -----
  "editor.fontSize": 14,
  "editor.tabSize": 2,
  "editor.wordWrap": "on",
  
  // ----- Prettier 自动格式化（必开） -----
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  
  // ----- ESLint 实时校验 -----
  "eslint.validate": ["javascript", "html"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  
  // ----- Live Server 默认端口（避免冲突） -----
  "liveServer.settings.port": 5500,
  "liveServer.settings.root": "/",  // 项目根目录
  
  // ----- 路径补全忽略后缀（写HTML时更流畅） -----
  "path-intellisense.extensionOnImport": false
}
```


## 三、开发工作流速查（矩阵式流程）

| 开发阶段 | 使用的插件 | 标准操作 |
| :--- | :--- | :--- |
| **1. 写结构 (HTML)** | Auto Rename Tag + HTML CSS Support | 输入 `<div` 自动补全，改标签名自动改闭合 |
| **2. 写样式 (CSS)** | CSS Peek | 按住 `Ctrl` 点类名跳去改样式，改完 `Ctrl+Tab` 切回HTML |
| **3. 写逻辑 (JS)** | ESLint + Error Lens | 写错变量名或漏分号，行尾直接飘红提醒 |
| **4. 查错/调试** | HTML-JS-CSS Analyzer | 手动运行一次（或装插件后自动检查）未被使用的样式 |
| **5. 预览/运行** | Live Server | 右键HTML → `Open with Live Server`，浏览器自动打开 `http://127.0.0.1:5500` |
| **6. 提交代码前** | Prettier + ESLint | `Ctrl+S` 自动格式化，保存时ESLint自动修复简单错误 |


## 四、常见问题排错（矩阵式）

| 报错现象 | 可能原因 | 解决方案（插件矩阵对应操作） |
| :--- | :--- | :--- |
| 右键HTML没有 `Open with Live Server` | 未以文件夹形式打开项目 | 关闭文件，点击 `文件` → `打开文件夹` 重新导入 |
| ESLint飘红但代码没错 | 缺少 `.eslintrc.js` 配置文件 | 在项目根目录新建该文件，写入 `module.exports = { extends: "eslint:recommended" };` |
| Prettier保存后格式乱掉 | 与其他格式化插件冲突 | 在设置中搜索 `Default Formatter`，强制选为 `Prettier` |
| CSS Peek无法跳转 | HTML中类名与CSS文件未关联 | 确保CSS文件已在编辑器中打开，或项目已保存 |


**使用建议**：将此文档保存为项目根目录下的 `DEV_ENV.md`，每次新开项目时第一个创建并输出它。后续开发中遇到环境疑问，直接回看此矩阵即可。祝你编码顺利！ 🚀
```