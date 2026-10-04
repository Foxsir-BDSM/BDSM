#!/usr/bin/env node
/**
 * tools/probe-write-answers.mjs —— 可行性验证：能否直接写档案答案字段
 *
 * 动作：把一条记录里的某个文本字段「写出原值」（幂等，不改变数据语义）。
 * 成功 = 二次编辑功能在数据层面可行。
 */
import https from 'https';

const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');

const req = (url, method, body) => new Promise((res, rej) => {
  const u = new URL(url); const p = body ? JSON.stringify(body) : null;
  const r = https.request({ hostname: u.hostname, path: u.pathname, method,
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json',
      ...(p ? { 'Content-Length': Buffer.byteLength(p) } : {}) } },
    (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => res({ status: x.statusCode, body: d })); });
  r.on('error', rej); if (p) r.write(p); r.end();
});

const LIST = `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`;

console.log('════════ 写入可行性验证 ════════\n');

const list = await req(LIST, 'POST', { limit: 5, offset: 0 });
const j = JSON.parse(list.body);
const rec = j.records[0];
if (!rec) { console.log('  ❌ 无记录可测'); process.exit(1); }

const d = rec.data || {};
const TEST_FIELDS = {
  fkHpgmVVTg7: '姓名',
  f57DddbxHNc: '年龄',
  fviPchG4Lfi: '身高（cm）',
  f2MZCq6ZYzg: '常住地址',
  fwSj6KJHhHc: '联系方式',
  f97ur4fWUJY: '当前情感状态',
  frPcRu1oJRM: '第一次自慰年纪',
};

console.log(`  测试记录: ${rec.id}`);
console.log(`  姓名: ${d.fkHpgmVVTg7}\n`);

// ① 单字段幂等写入
console.log('── ① 单文本字段幂等写入 ──');
const url = `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/${rec.id}`;
const single = await req(url, 'PATCH', { record: { fkHpgmVVTg7: d.fkHpgmVVTg7 } });
console.log(`   PATCH {record:{fkHpgmVVTg7: 原值}} → HTTP ${single.status}`);
if (single.status !== 200 && single.status !== 204) {
  console.log('   响应: ' + single.body.slice(0, 260));
}

// ② 多字段一起写
console.log('\n── ② 多字段批量幂等写入 ──');
const multi = {};
Object.entries(TEST_FIELDS).forEach(([id, name]) => {
  if (d[id] !== undefined && d[id] !== null && d[id] !== '') multi[id] = d[id];
});
console.log(`   字段数: ${Object.keys(multi).length}   ${JSON.stringify(multi).slice(0, 160)}`);
const batch = await req(url, 'PATCH', { record: multi });
console.log(`   PATCH {record:{…${Object.keys(multi).length} 个}} → HTTP ${batch.status}`);
if (batch.status !== 200 && batch.status !== 204) {
  console.log('   响应: ' + batch.body.slice(0, 260));
}

// ③ 数组型字段（multiple_select）
console.log('\n── ③ 数组型字段（multiple_select）幂等写入 ──');
const arrField = 'fvpqqe12WsG';   // 身体开发进度
if (Array.isArray(d[arrField])) {
  const arr = await req(url, 'PATCH', { record: { [arrField]: d[arrField] } });
  console.log(`   PATCH {record:{${arrField}: [${d[arrField].length} 项]}} → HTTP ${arr.status}`);
  if (arr.status !== 200 && arr.status !== 204) console.log('   响应: ' + arr.body.slice(0, 260));
} else {
  console.log(`   （该记录 ${arrField} 不是数组，跳过）`);
}

// ④ 数字型字段
console.log('\n── ④ 数字型字段（number）幂等写入 ──');
const numField = 'fpsv5kVoVFb';   // 百人斩进度
if (d[numField] !== undefined && d[numField] !== null) {
  const num = await req(url, 'PATCH', { record: { [numField]: d[numField] } });
  console.log(`   PATCH {record:{${numField}: ${d[numField]}}} → HTTP ${num.status}`);
} else {
  console.log(`   （该记录 ${numField} 为空，跳过）`);
}

// 回读校验
console.log('\n── ⑤ 回读校验 ──');
const back = await req(LIST, 'POST', { limit: 5, offset: 0 });
const bj = JSON.parse(back.body);
const brec = bj.records.find((x) => x.id === rec.id);
const bd = brec.data || {};
let ok = true;
Object.entries(multi).forEach(([id, v]) => {
  const same = JSON.stringify(bd[id]) === JSON.stringify(v);
  if (!same) ok = false;
  console.log(`   ${TEST_FIELDS[id].padEnd(14)} 写前=${JSON.stringify(v).slice(0, 30)}  写后=${JSON.stringify(bd[id]).slice(0, 30)}  ${same ? '✅' : '⚠️ 不一致'}`);
});

console.log('\n════════ 结论 ════════');
console.log(batch.status === 200 || batch.status === 204
  ? '  ✅ 可以写入档案答案字段 —— 二次编辑功能在数据层可行'
  : '  ❌ 写入被拒 —— 需要换可写 API Key 或改用其它方案');
console.log(ok ? '  ✅ 数据未被意外改动（幂等写入确认）' : '  ⚠️ 回读值有差异，需检查');
