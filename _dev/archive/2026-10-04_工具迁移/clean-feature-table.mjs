#!/usr/bin/env node
/**
 * tools/clean-feature-table.mjs
 * 清理 gen-feature-table.mjs 中已删除模块的段落：
 *   · 四、欲识之海（knowledge）  ┐ 已合并为「欲炼之途」(content)
 *   · 五、欲炼之途（mission）    ┘
 *   · 六、占位模块里的 dom-archive
 * 并补入新的 content 模块段落与更新的注册表说明。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'tools', 'gen-feature-table.mjs');

let lines = fs.readFileSync(FILE, 'utf8').split('\n');
const before = lines.length;

// 定位「四、欲识之海」与「六、占位模块」的行号（1-based）
const idxOf = (needle) => lines.findIndex((l) => l.includes(needle));
const i4 = idxOf('四、模块 · 欲识之海');
const i6 = idxOf("title: '六、占位模块'");

if (i4 < 0 || i6 < 0) {
  console.log('⚠️ 未定位到段落边界', { i4, i6 });
  process.exit(1);
}

// 新段落：content 模块（替换原 四/五 两节）
const NEW_SECTION = `      // ─────────────────────────────────────── 四、欲炼之途（内容板块）
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

`;

// 替换 [i4, i6) 区间（即原 四、五 两节）
const removed = i6 - i4;
lines = [
  ...lines.slice(0, i4),
  ...NEW_SECTION.split('\n'),
  ...lines.slice(i6),
];

let out = lines.join('\n');

// 更新模块标签表
out = out.replace(
  `    const M = {
      dom: '模块·欲主之殿',
      sub: '模块·欲渊之庭',
      know: '模块·欲识之海',
      miss: '模块·欲炼之途',
      rand: '模块·淫梦织境/欲缘之遇',
    };`,
  `    const M = {
      sub: '模块·欲渊之庭',
      content: '模块·欲炼之途',
      rand: '模块·淫梦织境/欲缘之遇',
    };`
);

// 占位模块一节：删掉 dom 行（若仍在）
out = out.replace(/^\s*\[M\.dom,.*\n/gm, '');

fs.writeFileSync(FILE, out, 'utf8');

console.log(`✅ 已清理 gen-feature-table.mjs`);
console.log(`   删除原「四、欲识之海」「五、欲炼之途」共 ${removed} 行`);
console.log(`   补入新的「四、欲炼之途（content）」段落`);
console.log(`   行数 ${before} → ${out.split('\n').length}`);
console.log('   U+FFFD:', (out.match(/\uFFFD/g) || []).length);
console.log('   残留 M.know:', (out.match(/M\.know/g) || []).length);
console.log('   残留 M.miss:', (out.match(/M\.miss/g) || []).length);
console.log('   残留 M.dom :', (out.match(/M\.dom/g) || []).length);
