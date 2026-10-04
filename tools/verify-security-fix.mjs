#!/usr/bin/env node
/**
 * tools/verify-security-fix.mjs —— 以匿名身份核验 get_all_users() 是否已收紧
 *
 * 做法：用公开的 anon key、不登录，直接调 RPC。
 *   · 返回空数组 / 报错  → 已收紧 ✅
 *   · 返回用户邮箱列表   → 仍泄露 ❌
 */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

console.log('════ 匿名访问核验 ════════\n');
console.log(`  项目: ${SUPABASE_URL}`);
console.log('  身份: 匿名（只带公开的 anon key，无登录）\n');

const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_users`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});

const text = await r.text();
let data = null;
try { data = JSON.parse(text); } catch { /* 非 JSON */ }

console.log(`  HTTP ${r.status}`);
console.log(`  响应: ${String(text).replace(/\s+/g, ' ').slice(0, 200)}\n`);

const n = Array.isArray(data) ? data.length : null;

if (n === 0) {
  console.log('  ✅ 已收紧：匿名调用返回空数组，邮箱不再泄露');
} else if (n === null) {
  console.log('  🟡 未返回数组（可能是权限错误或函数已删）');
  console.log('     若为权限类错误，效果与收紧一致（匿名拿不到数据）');
  if (/permission|denied|not exist/i.test(text)) console.log('     → 判定：匿名无法读取，✅ 安全');
} else if (n > 0) {
  console.log(`  🔴 仍在泄露：匿名读到了 ${n} 个账号`);
  console.log('     样例：');
  data.slice(0, 3).forEach((u) => console.log(`       · ${u.email}`));
  console.log('\n     检查点：');
  console.log('       1) 函数体内是否真的加了 where exists(... auth.uid() ...)');
  console.log('       2) 未登录时 auth.uid() 为 null，exists 应为 false → 返回 0 行');
  console.log('       3) 若仍返回全部，说明 where 条件没生效或被优化掉');
}

// 顺带看看账号总量（同样匿名，若已收紧则应拿不到）
console.log('\n── 顺带：账号总量（匿名视角）──');
if (n !== null && n > 0) {
  const test = data.filter((u) => /@foxsir-test\.local$/i.test(u.email || ''));
  console.log(`  总数 ${n}，其中测试账号 ${test.length}`);
  console.log(`  ${test.length === 0 ? '✅ 测试账号已删净' : '⚠️ 仍有测试账号未删'}`);
} else {
  console.log('  匿名已读不到用户列表，无法统计（这正是期望的结果）');
}
