#!/usr/bin/env node
/**
 * tools/probe-bucket-exists.mjs —— 对照实验：list 端点能否区分「桶存在」与「桶不存在」
 *
 * 用随机假桶名做对照。若假桶也返回 200，则说明该端点不校验桶名，
 * 之前探测到的 media/content/uploads/images 不能证明桶存在。
 */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

const listBucket = async (bucket) => {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: '', limit: 5 }),
  });
  const txt = await r.text();
  return { status: r.status, body: txt.slice(0, 120) };
};

console.log('════════ 对照实验：桶存在性判定 ════════\n');

const names = ['avatars', 'media', 'content', 'uploads', 'images',
  `zz-fake-bucket-${Date.now().toString(36)}`, 'definitely-not-real-xyz'];

for (const b of names) {
  const r = await listBucket(b);
  const isFake = b.startsWith('zz-fake') || b.startsWith('definitely');
  const tag = isFake ? '[对照·假桶]' : '[真实候选]';
  console.log(`${tag} ${b}`);
  console.log(`        HTTP ${r.status}  ${r.body}`);
}

console.log('\n  判读方式：');
console.log('    假桶返回 400/404  → list 端点会校验桶名，之前的 200 可信');
console.log('    假桶也返回 200    → 端点不校验，之前结果不能证明桶存在');

// 补充：直接查 bucket 元信息
console.log('\n── 补充：bucket 端点（需鉴权）──');
for (const b of ['avatars', 'media']) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${b}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const t = await r.text();
  console.log(`   ${b.padEnd(10)} HTTP ${r.status}  ${t.slice(0, 110)}`);
}

// 补充：avatars 桶的公开访问（证明该桶真实存在且公开）
console.log('\n── 补充：avatars 已有对象的真实 URL 是否可读 ──');
const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/avatars`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ prefix: '', limit: 5 }),
});
const objs = await r.json();
if (Array.isArray(objs) && objs.length) {
  objs.slice(0, 5).forEach((o) => console.log(`     ${o.name}  (${o.metadata?.size ?? '?'} B)`));
  const sample = `${SUPABASE_URL}/storage/v1/object/public/avatars/${objs[0].name}`;
  const pr = await fetch(sample, { method: 'HEAD' });
  console.log(`     公开读取: HTTP ${pr.status}`);
} else {
  console.log('     ' + JSON.stringify(objs).slice(0, 120));
}
