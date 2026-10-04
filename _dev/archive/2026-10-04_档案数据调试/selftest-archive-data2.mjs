#!/usr/bin/env node
/**
 * tools/selftest-archive-data2.mjs —— 用「应用真实代码路径」自检
 *
 * 上一版自检脚本自己读 rec.fields，而新库只有 data，
 * 导致误判。本版直接调用 utils.js 里的真实函数。
 */
import https from 'https';

const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');
const {
  getFieldValue, getCardImage, getCardName, getCardAge, getCardInfo,
  filterRecordsByAffiliation, countByAffiliation, hasRealIdentityData,
} = await import('../src/modules/sub-archive/js/utils.js');
const { deriveArchiveFilter } = await import('../src/shared/config/identity-config.js');
const { CARD_FIELDS, FIELD_LABELS, VISIBILITY_FIELDS } = await import('../src/shared/config/archive/fields.js');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const p = JSON.stringify(body);
    const r = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) },
    }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d)); });
    r.on('error', reject); r.write(p); r.end();
  });
}

const raw = await post(
  `https://tables.fillout.com/api/v1/bases/${BASE_ID}/tables/${TABLE_ID}/records/list`,
  { limit: 100, offset: 0 });
const j = JSON.parse(raw);
const records = j.records || [];

console.log('════════ 自检 v2：走应用真实代码路径 ════════\n');
console.log(`  API 返回 ${records.length} 条（total=${j.total}）`);

// 复刻 home.js 现在的 isPublic（字段 ID 来自配置）
function isPublic(record) {
  const value = getFieldValue(record, VISIBILITY_FIELDS.publicQuestionnaire);
  if (value === true || value === '是' || value === 'true' || value === 1) return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}

console.log('\n── 1. getFieldValue 是否真能取到值 ──');
records.slice(0, 3).forEach((r, i) => {
  console.log(`   [${i}] id=${String(r.id).slice(0, 8)}`);
  console.log(`       姓名(${CARD_FIELDS.name}) = ${JSON.stringify(getFieldValue(r, CARD_FIELDS.name))}`);
  console.log(`       身份(${CARD_FIELDS.identity}) = ${JSON.stringify(getFieldValue(r, CARD_FIELDS.identity))}`);
  console.log(`       年龄(${CARD_FIELDS.age}) = ${JSON.stringify(getFieldValue(r, CARD_FIELDS.age))}`);
  console.log(`       封面(${CARD_FIELDS.photo}) = ${getFieldValue(r, CARD_FIELDS.photo) ? '有' : '空'}`);
  console.log(`       getCardName = ${JSON.stringify(getCardName(r))}`);
  console.log(`       getCardAge  = ${JSON.stringify(getCardAge(r))}`);
});

console.log('\n── 2. 旧的 isPublic 字段是否还有值（fgerzjJpBTF = 旧库的「公开问卷」）──');
const oldPubVals = {};
records.forEach((r) => {
  const v = getFieldValue(r, 'fgerzjJpBTF');
  const k = JSON.stringify(v);
  oldPubVals[k] = (oldPubVals[k] || 0) + 1;
});
console.log('   ' + JSON.stringify(oldPubVals));
console.log('   → 若全为 null，说明 isPublic() 恒假 ⇒ 所有记录被过滤');

console.log('\n── 3. 新库的公开开关取值 ──');
const newPubVals = {};
records.forEach((r) => {
  const v = getFieldValue(r, 'fkAEd2CE2gQ');
  const k = JSON.stringify(v);
  newPubVals[k] = (newPubVals[k] || 0) + 1;
});
console.log('   是否公开问卷内容(fkAEd2CE2gQ): ' + JSON.stringify(newPubVals));

console.log('\n── 4. 身份分布与默认筛选 ──');
console.log('   hasRealIdentityData = ' + hasRealIdentityData(records));
const c = countByAffiliation(records);
console.log('   计数: ' + JSON.stringify(c));
const identVals = {};
records.forEach((r) => {
  const v = getFieldValue(r, CARD_FIELDS.identity);
  const k = JSON.stringify(v);
  identVals[k] = (identVals[k] || 0) + 1;
});
console.log('   身份取值分布: ' + JSON.stringify(identVals));

console.log('\n── 5. 模拟列表页三种访客 ──');
for (const [label, identity] of [['未登录/无身份', null], ['男S', 'male_S'], ['女M', 'female_M']]) {
  const d = deriveArchiveFilter(identity);
  const filtered = filterRecordsByAffiliation(records, { position: d.position, gender: d.gender });
  const visible = filtered.filter(isPublic);
  console.log(`   ${label.padEnd(14)} 位置=${String(d.position).padEnd(7)} 过滤后=${String(filtered.length).padEnd(3)} 过 isPublic 后=${visible.length}`);
}

console.log('\n════════ 结论 ════════');
if (oldPubVals['null'] === records.length) {
  console.log('  ❌ 病因确认：home.js 的 isPublic() 读的是**旧库字段** fgerzjJpBTF');
  console.log('     新库没有这个字段 ⇒ 全部为 null ⇒ 所有卡片被过滤掉');
  console.log('     修复：把 isPublic 改读新库的 fkAEd2CE2gQ（是否公开问卷内容）');
} else {
  console.log('  isPublic 字段有值，需继续排查');
}
