#!/usr/bin/env node
/**
 * tools/gen-field-mapping.mjs
 * 生成「旧库 → 新库」字段映射表，供手工迁移数据使用
 *
 * 输出：docs/数据表/字段映射_旧库到新库.md
 *      docs/数据表/字段映射_旧库到新库.csv
 *
 * 只读：不改动任何数据库内容。
 */
import https from 'https';
import fs from 'node:fs';
import path from 'node:path';

const OLD = { base: '0019555500b60c58', table: 'taRmZxGFzF5', label: '旧库' };
const NEW = { base: 'e7d18ead20743825', table: 't4d3B3XvKL8', label: '新库' };

const { API_KEY } = await import('../src/shared/config/archive/api.js');

function get(db) {
  return new Promise((resolve, reject) => {
    https.get(`https://tables.fillout.com/api/v1/bases/${db.base}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }, (res) => {
        let d = ''; res.on('data', (c) => (d += c));
        res.on('end', () => {
          const j = JSON.parse(d);
          const t = j.tables.find((x) => x.id === db.table);
          resolve(t.fields.map((f) => ({ id: f.id, name: f.name, type: f.type })));
        });
      }).on('error', reject);
  });
}

const oldFields = await get(OLD);
const newFields = await get(NEW);

const norm = (s) => String(s || '')
  .replace(/[（(].*?[)）]/g, '')
  .replace(/\s+/g, '')
  .replace(/[&＆]/g, '')
  .toLowerCase();

// 归一化索引（同名取第一个）
const newByNorm = new Map();
newFields.forEach((f) => { const k = norm(f.name); if (k && !newByNorm.has(k)) newByNorm.set(k, f); });

// 人工补充的语义映射（名称不同但语义相同）
const SEMANTIC = {
  '认证': '我已确认上述为我真实意愿',
  '公开问卷': '是否公开问卷内容',
  '常住地址（隐私确认）': '是否公开常住地址',
  '联系方式（隐私确认）': '是否公开联系方式',
  '生活照片（隐私确认）': '是否公开生活照片',
  '隐私照片（隐私确认）': '是否公开隐私照片',
  '生活照': '生活照',
  '身高': '身高（cm）',
  '体重': '体重（kg）',
  '身高的': '身高（cm）',
  '深喉最深': '深喉最深（cm）',
  '菊穴最深': '菊穴最深（cm）',
};

const rows = [];
// 已认领的新字段 ID —— 防止多个旧字段映射到同一个新字段
const claimed = new Map();

for (const of of oldFields) {
  // ① 精确同名优先
  let nf = newFields.find((f) => f.name === of.name && !claimed.has(f.id));
  let how = '同名直连';

  // ② 人工语义映射
  if (!nf) {
    const bySem = SEMANTIC[of.name];
    if (bySem) {
      nf = newFields.find((f) => f.name === bySem && !claimed.has(f.id));
      if (nf) how = '语义对应';
    }
  }

  // ③ 归一化匹配（去掉括号与空格后同名），同样避开已认领
  if (!nf) {
    const k = norm(of.name);
    nf = newFields.find((f) => norm(f.name) === k && !claimed.has(f.id));
    if (nf) how = '归一化对应（需复核）';
  }

  if (nf) claimed.set(nf.id, of.id);

  rows.push({
    oldId: of.id,
    oldName: of.name,
    oldType: of.type,
    newId: nf ? nf.id : '',
    newName: nf ? nf.name : '',
    newType: nf ? nf.type : '',
    status: nf ? how : '新库无对应（或已被认领）',
  });
}

// 新库独有（旧库没有来源）
const matchedNewIds = new Set(rows.map((r) => r.newId).filter(Boolean));
const newOnly = newFields.filter((f) => !matchedNewIds.has(f.id));

const OUT_DIR = path.join(process.cwd(), 'docs', '数据表');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Markdown
const L = [];
L.push('# 字段映射表 · 旧库 → 新库');
L.push('');
L.push(`> 生成时间：${new Date().toLocaleString('zh-CN')}`);
L.push('> 用途：把旧库记录导入新库时，按此表对应字段 ID。**只读生成，未改动任何数据。**');
L.push('');
L.push(`| | 旧库 | 新库 |`);
L.push('|:---|:---|:---|');
L.push(`| Base | \`${OLD.base}\` | \`${NEW.base}\` |`);
L.push(`| Table | \`${OLD.table}\` | \`${NEW.table}\` |`);
L.push(`| 字段数 | ${oldFields.length} | ${newFields.length} |`);
L.push('');

const mappable = rows.filter((r) => r.newId);
const unmappable = rows.filter((r) => !r.newId);

L.push(`## 一、可直接对应的字段（${mappable.length} 个）`);
L.push('');
L.push('| # | 旧字段 ID | 旧字段名 | 新字段 ID | 新字段名 | 对应方式 |');
L.push('|:---|:---|:---|:---|:---|:---|');
mappable.forEach((r, i) => {
  L.push(`| ${i + 1} | \`${r.oldId}\` | ${r.oldName} | \`${r.newId}\` | ${r.newName} | ${r.status} |`);
});
L.push('');

L.push(`## 二、新库无对应的旧字段（${unmappable.length} 个）`);
L.push('');
if (unmappable.length) {
  L.push('这些字段在新库中没有承载位置，其数据**无法迁移**：');
  L.push('');
  L.push('| # | 旧字段 ID | 旧字段名 | 类型 |');
  L.push('|:---|:---|:---|:---|');
  unmappable.forEach((r, i) => L.push(`| ${i + 1} | \`${r.oldId}\` | ${r.oldName} | ${r.oldType} |`));
} else {
  L.push('（无）');
}
L.push('');

L.push(`## 三、新库独有字段（${newOnly.length} 个，旧库无来源数据）`);
L.push('');
L.push('| # | 新字段 ID | 新字段名 | 类型 |');
L.push('|:---|:---|:---|:---|');
newOnly.forEach((f, i) => L.push(`| ${i + 1} | \`${f.id}\` | ${f.name} | ${f.type} |`));
L.push('');

L.push('---');
L.push('');
L.push('## 迁移提示');
L.push('');
L.push('1. **写入格式**：Tables API 用 `{ record: { 字段标识: 值 } }`。');
L.push('   PATCH 更新已实测可用；POST 创建同形（此前误用 `data` 导致 400）。');
L.push('2. **字段标识**：旧库写入用**字段名**（如 `公开问卷`、`常住地址（隐私确认）`），');
L.push('   这是现有管理面板的实际做法；新库字段名不同，需按上表转换。');
L.push('3. **无法迁移的字段**：见第二节，导入时直接忽略。');
L.push('4. **新库独有字段**：见第三节，导入时留空或给默认值。');

fs.writeFileSync(path.join(OUT_DIR, '字段映射_旧库到新库.md'), L.join('\n'), 'utf8');

// ── CSV
const csvEsc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [['序号', '旧字段ID', '旧字段名', '旧字段类型', '新字段ID', '新字段名', '新字段类型', '对应方式'].join(',')];
rows.forEach((r, i) => csv.push([
  i + 1, r.oldId, r.oldName, r.oldType, r.newId, r.newName, r.newType, r.status,
].map(csvEsc).join(',')));
newOnly.forEach((f, i) => csv.push([
  `N${i + 1}`, '', '（新库独有）', '', f.id, f.name, f.type, '新库新增',
].map(csvEsc).join(',')));
fs.writeFileSync(path.join(OUT_DIR, '字段映射_旧库到新库.csv'), '\ufeff' + csv.join('\r\n'), 'utf8');

console.log('════════ 字段映射表已生成 ════════\n');
console.log(`  旧库字段: ${oldFields.length}   新库字段: ${newFields.length}`);
console.log(`  可直接对应: ${mappable.length}`);
console.log(`  新库无对应: ${unmappable.length}`);
console.log(`  新库独有  : ${newOnly.length}`);
console.log('');
console.log('  输出:');
console.log('    docs/数据表/字段映射_旧库到新库.md');
console.log('    docs/数据表/字段映射_旧库到新库.csv');
console.log('');
if (unmappable.length) {
  console.log('  无法迁移的旧字段:');
  unmappable.forEach((r) => console.log(`    · ${r.oldName}  (${r.oldId})`));
}
