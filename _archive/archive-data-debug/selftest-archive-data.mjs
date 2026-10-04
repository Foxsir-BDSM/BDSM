#!/usr/bin/env node
/**
 * tools/selftest-archive-data.mjs —— 自检：新库有数据但列表页无卡片
 *
 * 逐层排查：
 *   1. API 是否读到记录
 *   2. isPublic（公开问卷）判定是否全部为假
 *   3. 相对过滤（本地 vs 远端）差异
 */
import https from 'https';

const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');
const { CARD_FIELDS, FIELD_LABELS } = await import('../src/shared/config/archive/fields.js');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    r.write(payload); r.end();
  });
}

const URL_LIST = `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`;

console.log('════════ 自检：列表页为何无卡片 ════════\n');
console.log(`  数据源: ${BASE_ID} / ${TABLE_ID}\n`);

// ── 第 1 层：API 原始返回
const r = await post(URL_LIST, { limit: 100, offset: 0 });
console.log(`── 层 1：API 原始返回 ──`);
console.log(`   HTTP ${r.status}`);
let j = null;
try { j = JSON.parse(r.body); } catch { console.log('   解析失败: ' + r.body.slice(0, 200)); process.exit(1); }
const recs = j.records || [];
console.log(`   total=${j.total}  本页返回 ${recs.length} 条  hasMore=${j.hasMore}`);

if (!recs.length) {
  console.log('\n   ❌ API 层就没有数据 —— 问题在数据库侧，不在前端');
  process.exit(1);
}

// ── 第 2 层：公开问卷判定（前端 isPublic 的等价实现）
console.log(`\n── 层 2：「公开问卷」判定 ──`);
const PUB_KEY = '是否公开问卷内容';
const pubIds = Object.entries(FIELD_LABELS).filter(([, v]) => v === PUB_KEY).map(([k]) => k);
console.log(`   字段 ID: ${pubIds.join(', ') || '(未在 FIELD_LABELS 中找到)'}`);

const isPublic = (v) => {
  if (v === true || v === '是' || v === 'true' || v === 1) return true;
  if (typeof v === 'string' && v.trim().toLowerCase() === 'true') return true;
  return false;
};

let pubTrue = 0, pubFalse = 0;
const pubSamples = [];
recs.forEach((rec) => {
  const f = rec.fields || {};
  // 同时检查所有可能的公开字段
  const vals = {};
  for (const k of Object.keys(f)) {
    const label = FIELD_LABELS[k];
    if (label && /公开/.test(label)) vals[label] = f[k];
  }
  const main = f[pubIds[0]];
  if (isPublic(main)) pubTrue++; else pubFalse++;
  if (pubSamples.length < 5) pubSamples.push({ id: rec.id.slice(0, 8), 公开问卷: main, 全部公开字段: vals });
});
console.log(`   公开=true : ${pubTrue}`);
console.log(`   公开=false: ${pubFalse}   ← 若有记录被判 false，列表页会过滤掉它们`);
console.log('\n   前 5 条样例：');
pubSamples.forEach((s) => console.log(`     ${s.id}  公开问卷=${JSON.stringify(s.公开问卷)}  ${JSON.stringify(s.全部公开字段)}`));

// ── 第 3 层：卡片字段是否有值
console.log(`\n── 层 3：卡片关键字段取值 ──`);
console.log(`   CARD_FIELDS.photo    = ${CARD_FIELDS.photo}  (${FIELD_LABELS[CARD_FIELDS.photo] || '?'})`);
console.log(`   CARD_FIELDS.name     = ${CARD_FIELDS.name}  (${FIELD_LABELS[CARD_FIELDS.name] || '?'})`);
console.log(`   CARD_FIELDS.identity = ${CARD_FIELDS.identity}  (${FIELD_LABELS[CARD_FIELDS.identity] || '?'})`);
console.log('');
recs.slice(0, 5).forEach((rec) => {
  const f = rec.fields || {};
  const name = f[CARD_FIELDS.name] || f[CARD_FIELDS.nameFallback] || '(空)';
  const ident = f[CARD_FIELDS.identity] || '(空)';
  const photo = f[CARD_FIELDS.photo] ? '有' : (f[CARD_FIELDS.photoFallback] ? '回退有' : '无');
  const age = f[CARD_FIELDS.age] || '(空)';
  console.log(`   ${rec.id.slice(0, 8)}  名=${JSON.stringify(name)}  身份=${JSON.stringify(ident)}  年龄=${JSON.stringify(age)}  照片=${photo}`);
});

// ── 第 4 层：身份分流（前端 affFilter 默认会过滤）
console.log(`\n── 层 4：身份分流影响 ──`);
const identityCount = {};
recs.forEach((rec) => {
  const v = (rec.fields || {})[CARD_FIELDS.identity];
  const key = v === undefined || v === null || v === '' ? '(空)' : JSON.stringify(v);
  identityCount[key] = (identityCount[key] || 0) + 1;
});
console.log('   各身份记录数：');
Object.entries(identityCount).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`     ${k.padEnd(20)} ${n}`));
console.log('\n   注意：访客/未设身份用户默认看全部；');
console.log('         已设身份用户默认只看互补侧（S 看 M，M 看 S），可能被过滤为空。');

// ── 结论
console.log(`\n════════ 结论 ════════`);
if (pubTrue === 0) {
  console.log(`  ❌ 全部 ${recs.length} 条记录的「公开问卷」都不为真`);
  console.log(`     → 列表页的 isPublic() 会把它们全部过滤掉，这就是无卡片的原因`);
  console.log(`     → 需把该字段设为 true，字段 ID: ${pubIds.join(', ')}`);
} else if (pubTrue < recs.length) {
  console.log(`  ⚠️ ${pubFalse} 条因「公开问卷」不为真被过滤，${pubTrue} 条应能显示`);
} else {
  console.log(`  ✅ 「公开问卷」判定通过（${pubTrue}/${recs.length}）`);
  console.log(`     → 问题可能在身份分流或前端渲染，需进一步查`);
}
