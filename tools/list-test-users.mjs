#!/usr/bin/env node
/**
 * tools/list-test-users.mjs —— 列出疑似测试账号，供人工确认后再删
 *
 * 数据来源：Supabase RPC get_all_users()（管理面板用的同一个函数）
 *
 * 只读：不删除任何数据。
 *
 * 用法：
 *   node tools/list-test-users.mjs              列出疑似测试账号
 *   node tools/list-test-users.mjs --all        连其他账号一起列出
 *   node tools/list-test-users.mjs --role admin --email xxx  以指定管理员身份调用
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SHOW_ALL = argv.includes('--all');
const AS_EMAIL = getArg('--email', '');
const AS_PASS = getArg('--password', 'Qa!123456');

const env = {};
if (fs.existsSync('cloudflare/.dev.vars')) {
  fs.readFileSync('cloudflare/.dev.vars', 'utf8').split('\n').forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2]) env[m[1]] = m[2].trim();
  });
}
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

/** 测试账号识别规则 */
const PATTERNS = [
  { re: /@foxsir-test\.local$/i, why: '测试邮箱域 foxsir-test.local' },
  { re: /^qa[_-]/i, why: '以 qa_ / qa- 开头' },
  { re: /probe/i, why: '含 probe（探测账号）' },
  { re: /^zz[_-]/i, why: '以 zz_ 开头（探针）' },
];
const classify = (email) => {
  const e = String(email || '');
  for (const p of PATTERNS) if (p.re.test(e)) return p.why;
  return null;
};

console.log('════ 账号盘点 ════════\n');

const callRpc = async (token, extra = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(extra),
  });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, ok: r.ok, j, raw: t };
};

let token = SUPABASE_ANON_KEY;
let identity = '（匿名）';

if (AS_EMAIL) {
  const li = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: AS_EMAIL, password: AS_PASS }),
  });
  const j = await li.json().catch(() => ({}));
  if (!j.access_token) {
    console.log(`  ✗ 登录 ${AS_EMAIL} 失败: ${j.error_description || j.msg || li.status}`);
    console.log('     （用 --password 指定密码）');
    process.exit(1);
  }
  token = j.access_token;
  identity = AS_EMAIL;
}
console.log(`  调用身份: ${identity}\n`);

const res = await callRpc(token);
console.log(`  get_all_users() → HTTP ${res.status}`);

if (!res.ok) {
  console.log(`  ✗ 调用失败: ${String(res.raw).slice(0, 240)}`);
  console.log('');
  if (res.status === 401 || res.status === 403) {
    console.log('  该函数要求管理员身份。请用一个 admin 账号调用：');
    console.log('    node tools/list-test-users.mjs --email 你的管理员邮箱 --password 密码');
  } else if (/function|does not exist/i.test(String(res.raw))) {
    console.log('  RPC 不存在或参数不符 —— 请确认函数名与签名。');
  }
  process.exit(1);
}

const users = Array.isArray(res.j) ? res.j : (res.j?.users || []);
console.log(`  取到 ${users.length} 个账号\n`);

if (!users.length) {
  console.log('  （空）');
  process.exit(0);
}
console.log(`  字段: ${Object.keys(users[0]).join(', ')}\n`);

const test = [], real = [];
for (const u of users) {
  const email = u.email || u.user_email || '';
  const why = classify(email);
  (why ? test : real).push({ email, why, raw: u });
}

console.log(`── 疑似测试账号（${test.length}）──`);
if (!test.length) console.log('  （无）');
test.forEach((u, i) => {
  const when = (u.raw.created_at || u.raw.last_sign_in_at || '').slice(0, 19);
  console.log(`  ${String(i + 1).padStart(3)}. ${u.email.padEnd(46)} ${u.why}`);
  if (when) console.log(`        ${when}`);
});

if (SHOW_ALL) {
  console.log(`\n── 其他账号（${real.length}）──`);
  real.forEach((u, i) => console.log(`  ${String(i + 1).padStart(3)}. ${u.email}`));
} else {
  console.log(`\n  （其他 ${real.length} 个账号未列出，加 --all 查看）`);
}
