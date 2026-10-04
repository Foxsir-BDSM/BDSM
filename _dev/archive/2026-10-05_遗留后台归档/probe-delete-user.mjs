#!/usr/bin/env node
/**
 * tools/probe-delete-user.mjs —— 探测删除用户所需的权限
 *
 * 只针对一个测试账号试一次，用于确认 anon key 是否有删除权限。
 * 若成功，说明权限配置有问题（任何人都能删用户），需立即修复。
 */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

console.log('════ 删除用户权限探测 ════════\n');

// 先取一个测试账号
const list = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_users`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const users = await list.json();
const target = (Array.isArray(users) ? users : []).find((u) => /@foxsir-test\.local$/i.test(u.email || ''));
if (!target) { console.log('  ✗ 未找到测试账号'); process.exit(1); }
console.log(`  目标账号: ${target.email}`);
console.log(`  id: ${target.id}\n`);

const attempts = [
  ['DELETE', `/auth/v1/admin/users/${target.id}`, null],
  ['POST', `/rest/v1/rpc/delete_user`, { user_id: target.id }],
  ['POST', `/rest/v1/rpc/admin_delete_user`, { target_email: target.email }],
];

for (const [method, p, body] of attempts) {
  const r = await fetch(SUPABASE_URL + p, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = (await r.text()).slice(0, 160).replace(/\s+/g, ' ');
  const mark = r.ok ? '⚠️ 成功了（不应如此）' : '✗ 被拒';
  console.log(`  ${method.padEnd(7)} ${p.padEnd(46)} HTTP ${r.status}  ${mark}`);
  console.log(`          ${t}`);
}

// 顺带确认：账号是否还在
const after = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_users`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const au = await after.json();
const still = (Array.isArray(au) ? au : []).some((u) => u.id === target.id);
console.log(`\n  账号是否仍存在: ${still ? '是（未被删除，符合预期）' : '❗ 已被删除'}`);
