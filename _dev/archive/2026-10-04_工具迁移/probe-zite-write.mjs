#!/usr/bin/env node
/**
 * tools/probe-zite-write.mjs —— 系统探测 Zite/Fillout Tables 的写入 API
 *
 * 目的：判断能否把「任务接取记录」存进这个已有的数据服务，
 *       从而避免新建 Supabase 表。
 */
const KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const BASE = 'e7d18ead20743825';
const TABLE = 't4d3B3XvKL8';
const HOST = 'https://tables.fillout.com';

const call = async (method, path, body) => {
  try {
    const r = await fetch(HOST + path, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { s: r.status, b: await r.text() };
  } catch (e) {
    return { s: 0, b: e.message };
  }
};

console.log('════════ Zite / Fillout Tables 写入 API 探测 ════════\n');

const PATHS = [
  ['POST', `/api/v1/bases/${BASE}/tables/${TABLE}/records`, '新建记录'],
  ['POST', `/api/v1/bases/${BASE}/tables/${TABLE}/records/create`, '新建(create)'],
  ['POST', `/api/v1/tables/${TABLE}/records`, '短路径'],
];

const BODIES = [
  ['{data:{fields:{…}}}', { data: { fields: { fkHpgmVVTg7: 'probe' } } }],
  ['{record:{fields:{…}}}', { record: { fields: { fkHpgmVVTg7: 'probe' } } }],
  ['{fields:{…}}', { fields: { fkHpgmVVTg7: 'probe' } }],
  ['{data:{fkHpgmVVTg7}}', { data: { fkHpgmVVTg7: 'probe' } }],
  ['{record:{fkHpgmVVTg7}}', { record: { fkHpgmVVTg7: 'probe' } }],
  ['[{fields:{…}}]', [{ fields: { fkHpgmVVTg7: 'probe' } }]],
  ['{rows:[{…}]}', { rows: [{ fkHpgmVVTg7: 'probe' }] }],
];

for (const [method, path, label] of PATHS) {
  console.log(`── ${label}：${method} ${path} ──`);
  for (const [blabel, body] of BODIES) {
    const r = await call(method, path, body);
    const brief = String(r.b).replace(/\s+/g, ' ').slice(0, 100);
    const ok = r.s === 200 || r.s === 201;
    console.log(`   ${String(r.s).padEnd(4)} ${blabel.padEnd(22)} ${ok ? '★ 成功' : brief}`);
    if (ok) {
      console.log('\n  ✅ 可用格式：' + method + ' ' + path + '  ' + blabel);
      console.log('     ' + String(r.b).slice(0, 240));
      process.exit(0);
    }
  }
  console.log('');
}

console.log('── 对照：PATCH（已知可用，验证 key 写权限）──');
const list = await call('POST', `/api/v1/bases/${BASE}/tables/${TABLE}/records/list`, { limit: 1, offset: 0 });
const j = JSON.parse(list.b);
const rec = j.records?.[0];
if (rec) {
  const patch = await call('PATCH',
    `/api/v1/bases/${BASE}/tables/${TABLE}/records/${rec.id}`,
    { record: { fkHpgmVVTg7: rec.data?.fkHpgmVVTg7 } });
  console.log(`   PATCH ${rec.id.slice(0, 8)} → HTTP ${patch.s}  ${patch.s === 200 ? '✅ key 有写权限' : patch.b.slice(0, 80)}`);
}

console.log('\n════════ 结论 ════════');
console.log('  · PATCH 成功 → key 对主表可写');
console.log('  · POST 全失败 → 该表不允许通过 API 新建记录');
console.log('    （档案馆的表是表单提交驱动的，记录只能由表单产生）');
