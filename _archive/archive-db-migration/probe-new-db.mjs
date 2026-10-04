#!/usr/bin/env node
/**
 * tools/probe-new-db.mjs —— 探测新数据库（Zite t4d3B3XvKL8）的字段结构
 * 只读：不改动任何远端数据，仅拉取 schema
 */
import https from 'https';

const API_KEY = 'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';

// 候选：数据库 ID 与表 ID 的两种可能组合
const CANDIDATES = [
  { label: 'bases/t4d3B3XvKL8（Database 即 base）', url: 'https://tables.fillout.com/api/v1/bases/t4d3B3XvKL8', tableId: null },
  { label: 'bases/e7d18ead20743825（Workspace 即 base）', url: 'https://tables.fillout.com/api/v1/bases/e7d18ead20743825', tableId: 't4d3B3XvKL8' },
];

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${API_KEY}` } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('超时')); });
  });
}

console.log('════════ 探测新数据库 ════════\n');

for (const c of CANDIDATES) {
  console.log(`── ${c.label} ──`);
  console.log(`   GET ${c.url}`);
  try {
    const r = await get(c.url);
    console.log(`   HTTP ${r.status}`);
    if (r.status !== 200) {
      console.log('   响应: ' + r.body.slice(0, 260));
      console.log('');
      continue;
    }
    let j = null;
    try { j = JSON.parse(r.body); } catch { console.log('   非 JSON 响应'); continue; }

    console.log(`   顶层键: ${Object.keys(j).join(', ')}`);
    const tables = j.tables || [];
    console.log(`   表数量: ${tables.length}`);
    tables.forEach((t) => {
      console.log(`     · id=${t.id}  name=${t.name}  字段数=${(t.fields || []).length}`);
    });

    // 若指定了 tableId，输出该表字段
    const target = c.tableId ? tables.find((t) => t.id === c.tableId) : tables[0];
    if (target) {
      console.log(`\n   ★ 目标表: ${target.name} (${target.id})`);
      console.log(`   字段清单 (${(target.fields || []).length} 个):`);
      (target.fields || []).forEach((f, i) => {
        console.log(`     ${String(i + 1).padStart(3)}. ${f.id}  ${f.name}  [type=${f.type || '?'}]`);
      });
    }
    console.log('');
    break; // 成功即停
  } catch (e) {
    console.log('   请求失败: ' + e.message + '\n');
  }
}
