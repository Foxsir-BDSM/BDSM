#!/usr/bin/env node
/**
 * tools/probe-storage-feasibility.mjs —— 验证媒体上传与任务系统的可行性
 *
 * 只读探测（不创建任何数据）：
 *   1. Supabase Storage 是否可用、有哪些桶、能否列目录
 *   2. Supabase 是否已有任务相关表
 *   3. GitHub 内容仓库的写入方式（读现有文件格式）
 */
import fs from 'node:fs';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

const api = (p, opt = {}) => fetch(`${SUPABASE_URL}${p}`, {
  ...opt,
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(opt.headers || {}),
  },
});

console.log('════════ 存储与任务系统可行性探测 ════════\n');
console.log(`  Supabase: ${SUPABASE_URL}\n`);

// ── 1. Storage 可用性
console.log('── 1. Supabase Storage ──');
try {
  // 常见桶名探测
  const buckets = ['avatars', 'media', 'content', 'uploads', 'images'];
  for (const b of buckets) {
    const r = await api(`/storage/v1/object/list/${b}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: '', limit: 3 }),
    });
    const txt = await r.text();
    let note = '';
    if (r.status === 200) {
      try { const j = JSON.parse(txt); note = `✅ 可访问，${Array.isArray(j) ? j.length : '?'} 个对象`; }
      catch { note = '✅ 可访问'; }
    } else if (r.status === 400 && /not found/i.test(txt)) note = '✗ 桶不存在';
    else if (r.status === 400) note = '✗ ' + txt.slice(0, 70);
    else if (r.status === 401 || r.status === 403) note = '⚠️ 存在但无权限（' + r.status + '）';
    else note = r.status + ' ' + txt.slice(0, 60);
    console.log(`   ${b.padEnd(10)} ${note}`);
  }
} catch (e) {
  console.log('   ✗ 探测失败: ' + e.message);
}

// ── 2. 任务相关表
console.log('\n── 2. Supabase 数据表（探测常见表名）──');
const TABLES = [
  'archive_profiles', 'questionnaire_submissions',
  'task_acceptances', 'task_feedback', 'task_feedbacks',
  'unbound_submissions', 'profiles', 'posts', 'tasks', 'likes',
];
for (const t of TABLES) {
  try {
    const r = await api(`/rest/v1/${t}?select=*&limit=1`);
    if (r.status === 200) {
      const j = await r.json();
      console.log(`   ${t.padEnd(26)} ✅ 存在（本页 ${Array.isArray(j) ? j.length : '?'} 行）`);
    } else if (r.status === 404) {
      console.log(`   ${t.padEnd(26)} · 不存在`);
    } else if (r.status === 401 || r.status === 403) {
      console.log(`   ${t.padEnd(26)} ⚠️ 存在但被 RLS 拦截（${r.status}）`);
    } else {
      const txt = await r.text();
      console.log(`   ${t.padEnd(26)} ? ${r.status} ${txt.slice(0, 50)}`);
    }
  } catch (e) {
    console.log(`   ${t.padEnd(26)} ✗ ${e.message}`);
  }
}

// ── 3. 现有内容文件格式（了解媒体该怎么存）
console.log('\n── 3. 现有内容文件格式（本地 foxsir-content/）──');
const dir = 'foxsir-content';
if (fs.existsSync(dir)) {
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p, out); else out.push(p);
    }
    return out;
  };
  const files = walk(dir);
  console.log(`   共 ${files.length} 个文件`);
  files.slice(0, 3).forEach((f) => console.log('     ' + f));
  const first = files.find((f) => f.endsWith('.md'));
  if (first) {
    console.log(`\n   ── 样例: ${first} ──`);
    fs.readFileSync(first, 'utf8').split('\n').slice(0, 26).forEach((l) => console.log('     ' + l.slice(0, 96)));
  }
} else {
  console.log('   （目录不存在）');
}

// ── 4. 媒体字段在题库/表单侧是否有先例
console.log('\n── 4. 档案馆侧的媒体字段（已有的存储先例）──');
const { FIELD_LABELS, PRIVACY_SWITCHES } = await import('../src/shared/config/archive/fields.js');
const mediaIds = Object.entries(FIELD_LABELS).filter(([, v]) => /照片|影像|素材|封面|乳|穴|臀|腿/.test(v));
console.log(`   疑似媒体字段 ${mediaIds.length} 个：`);
mediaIds.slice(0, 12).forEach(([id, v]) => console.log(`     ${id}  ${v}`));

console.log('\n════════ 结论 ════════');
