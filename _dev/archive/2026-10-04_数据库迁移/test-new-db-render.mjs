#!/usr/bin/env node
/**
 * tools/test-new-db-render.mjs
 * 临时插入一条测试记录 → 验证列表页/详情页渲染 → 删除记录
 *
 * 目的：确认新数据库与前端渲染链路真的通了（不只是能读到空表）
 */
import https from 'https';

const API_KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const BASE = 'e7d18ead20743825';
const TABLE = 't4d3B3XvKL8';
const LIST = `https://tables.fillout.com/api/v1/bases/${BASE}/tables/${TABLE}/records`;

function req(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    r.setTimeout(20000, () => r.destroy(new Error('超时')));
    if (payload) r.write(payload);
    r.end();
  });
}

console.log('════════ 新数据库渲染链路验证 ════════\n');

// 1. 插入测试记录
const testFields = {
  fwz4nCDQfZH: '女M',            // 身份
  fkHpgmVVTg7: 'ZZ渲染测试',      // 姓名
  f57DddbxHNc: '25',             // 年龄
  fviPchG4Lfi: '165',            // 身高
  f7rpwNruYeG: '50',             // 体重
  f2MZCq6ZYzg: '测试城市',        // 常住地址
  fedNsXf9DNV: true,             // 是否公开常住地址
  fkAEd2CE2gQ: true,             // 是否公开问卷内容
  fhUrgTMzZbb: false,            // 是否公开生活照片
  fi8wfWQmC96: false,            // 是否公开隐私照片
  fwKCmynWaVf: true,             // 我已确认上述为我真实意愿
};

console.log('── 1. 插入测试记录 ──');
// Tables API 写入格式：{ data: { fields: {...} } }
const created = await req(LIST, 'POST', { data: { fields: testFields } });
console.log(`   HTTP ${created.status}`);
console.log('   ' + created.body.slice(0, 320));

let recId = null;
try {
  const j = JSON.parse(created.body);
  recId = (j.records && j.records[0] && j.records[0].id) || j.id || null;
} catch { /* ignore */ }
console.log(`   记录 ID: ${recId}`);

// 2. 读回确认
console.log('\n── 2. 读回确认 ──');
const list = await req(`${LIST}/list`, 'POST', { limit: 5, offset: 0 });
console.log(`   HTTP ${list.status}`);
let total = 0, first = null;
try {
  const j = JSON.parse(list.body);
  total = j.total ?? 0;
  first = (j.records && j.records[0]) || null;
  console.log(`   total=${total}  返回 ${(j.records || []).length} 条`);
  if (first) {
    const f = first.fields || {};
    console.log('   身份      = ' + JSON.stringify(f.fwz4nCDQfZH));
    console.log('   姓名      = ' + JSON.stringify(f.fkHpgmVVTg7));
    console.log('   年龄      = ' + JSON.stringify(f.f57DddbxHNc));
    console.log('   常住地址  = ' + JSON.stringify(f.f2MZCq6ZYzg));
    console.log('   是否公开常住地址 = ' + JSON.stringify(f.fedNsXf9DNV));
    console.log('   我已确认  = ' + JSON.stringify(f.fwKCmynWaVf));
  }
} catch (e) { console.log('   解析失败: ' + list.body.slice(0, 200)); }

// 输出记录 ID 供后续删除
console.log('\n' + '='.repeat(46));
console.log('RECORD_ID=' + (recId || (first && first.id) || ''));
console.log('TOTAL=' + total);
console.log('='.repeat(46));
