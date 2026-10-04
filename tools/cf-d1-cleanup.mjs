#!/usr/bin/env node
/**
 * tools/cf-d1-cleanup.mjs —— 清理探针数据 / 查看 D1 内容
 *
 * 用法：
 *   node tools/cf-d1-cleanup.mjs --show          查看两表内容
 *   node tools/cf-d1-cleanup.mjs --purge-probe   删除 task_slug 以 zz- 开头的探针记录
 */
import fs from 'node:fs';
import path from 'node:path';

const env = {};
fs.readFileSync(path.join(process.cwd(), 'cloudflare', '.dev.vars'), 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && m[2]) env[m[1]] = m[2].trim();
});

const toml = fs.readFileSync(path.join(process.cwd(), 'cloudflare', 'wrangler.toml'), 'utf8');
const DB_ID = toml.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
const ACCT = env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = env.CLOUDFLARE_API_TOKEN;

const q = async (sql) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${DB_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    console.error('  ✗ SQL 失败:', JSON.stringify(j.errors || j).slice(0, 300));
    return null;
  }
  return j.result?.[0]?.results || [];
};

const args = process.argv.slice(2);

if (args.includes('--show') || args.length === 0) {
  console.log('════════ D1 内容 ════════\n');
  const tasks = await q('SELECT id, user_id, task_slug, task_title, status, accepted_at, submitted_at, feedback_slug FROM task_acceptances ORDER BY accepted_at DESC LIMIT 50;');
  console.log(`── task_acceptances（${tasks?.length ?? 0} 行）──`);
  (tasks || []).forEach((r) => {
    console.log(`   ${r.task_slug}  [${r.status}]  user=${String(r.user_id).slice(0, 8)}  ${r.task_title || ''}`);
    console.log(`      accepted=${r.accepted_at}  submitted=${r.submitted_at || '—'}  feedback=${r.feedback_slug || '—'}`);
  });

  const media = await q('SELECT id, user_id, r2_key, url, size FROM media_objects ORDER BY created_at DESC LIMIT 20;');
  console.log(`\n── media_objects（${media?.length ?? 0} 行）──`);
  (media || []).forEach((r) => console.log(`   ${r.r2_key}  ${r.size || 0} B`));
  console.log('');
}

if (args.includes('--purge-probe')) {
  console.log('════════ 清理探针记录 ════════\n');
  const before = await q("SELECT COUNT(*) AS n FROM task_acceptances;");
  console.log(`  清理前: ${before?.[0]?.n ?? '?'} 行`);

  const probe = await q("SELECT task_slug, task_title, status FROM task_acceptances WHERE task_slug LIKE 'zz-%';");
  console.log(`  待删探针记录: ${probe?.length ?? 0} 条`);
  (probe || []).forEach((r) => console.log(`     · ${r.task_slug}  [${r.status}]  ${r.task_title || ''}`));

  if (probe?.length) {
    await q("DELETE FROM task_acceptances WHERE task_slug LIKE 'zz-%';");
    const after = await q("SELECT COUNT(*) AS n FROM task_acceptances;");
    console.log(`\n  清理后: ${after?.[0]?.n ?? '?'} 行`);
  } else {
    console.log('  （无探针记录）');
  }
  console.log('');
}

if (args.includes('--purge-test')) {
  console.log('════════ 清理测试期间产生的记录 ════════\n');
  console.log('  规则：删除 task_slug 以 demo- 或 zz- 开头的记录');
  console.log('        （演示内容与探针内容，均为测试用途）\n');

  const before = await q('SELECT COUNT(*) AS n FROM task_acceptances;');
  console.log(`  清理前: ${before?.[0]?.n ?? '?'} 行`);

  const rows = await q("SELECT task_slug, task_title, status FROM task_acceptances WHERE task_slug LIKE 'demo-%' OR task_slug LIKE 'zz-%' ORDER BY accepted_at DESC;");
  console.log(`  待删: ${rows?.length ?? 0} 条`);
  (rows || []).forEach((r) => console.log(`     · ${r.task_slug}  [${r.status}]  ${r.task_title || ''}`));

  if (rows?.length) {
    await q("DELETE FROM task_acceptances WHERE task_slug LIKE 'demo-%' OR task_slug LIKE 'zz-%';");
    const after = await q('SELECT COUNT(*) AS n FROM task_acceptances;');
    console.log(`\n  清理后: ${after?.[0]?.n ?? '?'} 行`);

    const remain = await q('SELECT task_slug, status FROM task_acceptances ORDER BY accepted_at DESC LIMIT 20;');
    if (remain?.length) {
      console.log('  剩余记录:');
      remain.forEach((r) => console.log(`     · ${r.task_slug}  [${r.status}]`));
    }
  } else {
    console.log('  （无需清理）');
  }
  console.log('');
}
