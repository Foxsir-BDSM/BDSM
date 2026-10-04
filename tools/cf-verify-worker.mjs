#!/usr/bin/env node
/**
 * tools/cf-verify-worker.mjs —— 验证已部署的 Worker
 */
const BASE = 'https://foxsir-task-api.hzb0705.workers.dev';

console.log('════════ Worker 验证 ════════\n');
console.log(`  ${BASE}\n`);

const call = async (path, opts = {}) => {
  try {
    const r = await fetch(BASE + path, opts);
    const t = await r.text();
    return { status: r.status, body: t.slice(0, 300) };
  } catch (e) {
    return { status: 0, body: e.message };
  }
};

let pass = 0; const fails = [];
const check = (label, actual, expect) => {
  const ok = typeof expect === 'function' ? expect(actual) : actual === expect;
  if (ok) { pass++; console.log(`  ✓ ${label}  →  ${String(actual).slice(0, 80)}`); }
  else { fails.push(label); console.log(`  ✗ ${label}\n      期望 ${expect}\n      实际 ${actual}`); }
};

// ── 1. 健康检查（无需登录）
console.log('── 1. 健康检查 ──');
const h = await call('/health');
console.log(`     HTTP ${h.status}  ${h.body}`);
check('健康检查返回 200', h.status, 200);
check('返回服务标识', h.body.includes('foxsir-task-api'), true);

// ── 2. 未登录应被拒
console.log('\n── 2. 鉴权（未带 token）──');
const noAuth = await call('/api/tasks/mine');
console.log(`     HTTP ${noAuth.status}  ${noAuth.body.slice(0, 120)}`);
check('未登录返回 401', noAuth.status, 401);

const badAuth = await call('/api/tasks/mine', { headers: { Authorization: 'Bearer not-a-real-token' } });
console.log(`     HTTP ${badAuth.status}  ${badAuth.body.slice(0, 120)}`);
check('伪造 token 返回 401', badAuth.status, 401);

// ── 3. 不存在的路由
console.log('\n── 3. 路由 ──');
const notFound = await call('/api/nope');
console.log(`     HTTP ${notFound.status}  ${notFound.body.slice(0, 120)}`);
check('未知路由返回 401 或 404', notFound.status, (s) => s === 401 || s === 404);

// ── 4. CORS 预检
console.log('\n── 4. CORS 预检 ──');
const opt = await call('/api/tasks/mine', {
  method: 'OPTIONS',
  headers: { Origin: 'https://www.foxsir.top', 'Access-Control-Request-Method': 'GET' },
});
console.log(`     HTTP ${opt.status}`);
check('OPTIONS 返回 204', opt.status, 204);

// ── 5. 真实登录用户调用（用测试账号）
console.log('\n── 5. 真实用户调用 ──');
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');
const email = `qa_task_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';

const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASS, data: { nickname: '任务测试', role: 'self' } }),
});
const suj = await su.json().catch(() => ({}));

let token = suj.access_token;
if (!token) {
  const li = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const lij = await li.json().catch(() => ({}));
  token = lij.access_token;
}

if (!token) {
  console.log('     ⚠️ 未能取得测试账号 token，跳过登录态验证');
} else {
  console.log(`     测试账号: ${email}`);

  const mine = await call('/api/tasks/mine', { headers: { Authorization: `Bearer ${token}` } });
  console.log(`     GET /api/tasks/mine → HTTP ${mine.status}  ${mine.body.slice(0, 160)}`);
  check('登录后可读任务列表', mine.status, 200);
  check('返回 tasks 数组', mine.body.includes('"tasks"'), true);

  // 接取一个任务
  const accept = await call('/api/tasks/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskSlug: 'zz-probe-task', taskTitle: '探针任务', taskType: 'task' }),
  });
  console.log(`     POST /api/tasks/accept → HTTP ${accept.status}  ${accept.body.slice(0, 200)}`);
  check('接取任务成功', accept.status, 200);
  check('返回任务记录', accept.body.includes('accepted'), true);

  // 重复接取应幂等
  const again = await call('/api/tasks/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskSlug: 'zz-probe-task', taskTitle: '探针任务', taskType: 'task' }),
  });
  console.log(`     重复接取 → HTTP ${again.status}  ${again.body.slice(0, 140)}`);
  check('重复接取幂等（already=true）', again.body.includes('"already":true'), true);

  // 再查列表应有一条
  const mine2 = await call('/api/tasks/mine?status=accepted', { headers: { Authorization: `Bearer ${token}` } });
  const cnt = (mine2.body.match(/"task_slug"/g) || []).length;
  console.log(`     GET ?status=accepted → 记录数 ${cnt}`);
  check('列表含 1 条已接取', cnt, 1);

  // 更新状态
  const upd = await call('/api/tasks/zz-probe-task', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'submitted', feedbackSlug: 'zz-probe-feedback' }),
  });
  console.log(`     PATCH /api/tasks/zz-probe-task → HTTP ${upd.status}  ${upd.body.slice(0, 160)}`);
  check('更新状态成功', upd.status, 200);
  check('状态变为 submitted', upd.body.includes('submitted'), true);

  // 清理：D1 无删除接口，探针记录留在库里（用 SQL 清理，见下）
  console.log(`\n     ⚠️ 探针记录已写入 D1，稍后用 SQL 清理`);
}

console.log(`\n───────────────────────────────`);
console.log(`  通过 ${pass}   失败 ${fails.length}`);
if (fails.length) fails.forEach((f) => console.log('   · ' + f));
console.log('═══════════════════════════════');
process.exit(fails.length ? 1 : 0);
