#!/usr/bin/env node
/**
 * tools/check-field-mapping.mjs —— 审查映射表质量（只读）
 * 检查：一对多冲突、可疑语义对、漏配
 */
import fs from 'node:fs';
import path from 'node:path';

const md = fs.readFileSync(path.join(process.cwd(), 'docs', '数据表', '字段映射_旧库到新库.md'), 'utf8');

// 解析第一节映射表
const sec1 = md.split('## 一、')[1].split('## 二、')[0];
const pairs = [];
for (const m of sec1.matchAll(/\| \d+ \| `(f\w+)` \| ([^|]+) \| `(f\w+)` \| ([^|]+) \| ([^|]+) \|/g)) {
  pairs.push({ oldId: m[1], oldName: m[2].trim(), newId: m[3], newName: m[4].trim(), how: m[5].trim() });
}

const sec2 = md.split('## 二、')[1].split('## 三、')[0];
const unmapped = [];
for (const m of sec2.matchAll(/\| \d+ \| `(f\w+)` \| ([^|]+) \| ([^|]+) \|/g)) {
  unmapped.push({ id: m[1], name: m[2].trim(), type: m[3].trim() });
}

const sec3 = md.split('## 三、')[1].split('---')[0];
const newOnly = [];
for (const m of sec3.matchAll(/\| \d+ \| `(f\w+)` \| ([^|]+) \| ([^|]+) \|/g)) {
  newOnly.push({ id: m[1], name: m[2].trim(), type: m[3].trim() });
}

console.log('════════ 映射表审查 ════════\n');
console.log(`  映射对: ${pairs.length}   未映射: ${unmapped.length}   新库独有: ${newOnly.length}`);

// ── 1. 一对多冲突
console.log('\n── 1. 冲突检查：多个旧字段映射到同一新字段 ──');
const byNew = new Map();
pairs.forEach((p) => {
  if (!byNew.has(p.newId)) byNew.set(p.newId, []);
  byNew.get(p.newId).push(p);
});
const conflicts = [...byNew.entries()].filter(([, v]) => v.length > 1);
if (conflicts.length) {
  conflicts.forEach(([nid, v]) => {
    const nn = v[0].newName;
    console.log(`  ⚠️ 新字段 ${nid}「${nn}」被 ${v.length} 个旧字段认领：`);
    v.forEach((p) => console.log(`       ← ${p.oldName}  (${p.oldId})`));
  });
} else {
  console.log('  ✅ 无冲突');
}

// ── 2. 可疑：语义相似但未匹配
console.log('\n── 2. 漏配检查：旧字段与「新库独有」名称相似 ──');
const norm = (s) => String(s || '').replace(/[（(].*?[)）]/g, '').replace(/\s+/g, '').toLowerCase();
const kw = (s) => {
  const t = String(s || '');
  const out = [];
  ['玩具', '破处', '性交', '多人', '颜值', '身材', '推荐', '认证', '公开', '照片', '最深', '已发布', '备注'].forEach((k) => {
    if (t.includes(k)) out.push(k);
  });
  return out;
};
let found = 0;
unmapped.forEach((u) => {
  const uk = kw(u.name);
  if (!uk.length) return;
  newOnly.forEach((n) => {
    const nk = kw(n.name);
    const shared = uk.filter((k) => nk.includes(k));
    if (shared.length) {
      console.log(`  ▸ 「${u.name}」  ⇄  「${n.name}」   共同关键词: ${shared.join('、')}`);
      console.log(`       旧 ${u.id}  →  新 ${n.id}`);
      found++;
    }
  });
});
if (!found) console.log('  （无相似项）');

// ── 3. 附件类字段的映射情况
console.log('\n── 3. 附件字段映射（易错区）──');
pairs.filter((p) => /照片|FileUpload|合照|乳|穴|臀|腿/.test(p.oldName) || /照片|FileUpload|合照|乳|穴|臀|腿/.test(p.newName))
  .forEach((p) => console.log(`  ${p.oldName.padEnd(34)} → ${p.newName.padEnd(26)} [${p.how}]`));
console.log('\n  ── 未映射的附件字段 ──');
unmapped.filter((u) => /照片|FileUpload|合照/.test(u.name)).forEach((u) => console.log(`  ${u.name}  (${u.id})`));

console.log('\n════════ 结论 ════════');
if (conflicts.length) {
  console.log(`  ❌ 存在 ${conflicts.length} 处一对多冲突，导入前必须修正`);
  process.exit(1);
} else {
  console.log('  ✅ 映射无冲突');
}
