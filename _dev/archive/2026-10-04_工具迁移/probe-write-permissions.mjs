#!/usr/bin/env node
/**
 * tools/probe-write-permissions.mjs —— 验证写权限边界
 *
 * 结论用于判定：媒体上传功能是否需要人工去 Supabase 后台配置。
 *   · 能否用 anon key 创建存储桶
 *   · 已登录用户能否向 avatars 上传（验证 RLS 是否放行）
 */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../src/shared/js/config.js');

const H = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

console.log('════════ 写权限边界验证 ════════\n');

// ── 1. 能否创建存储桶
console.log('── 1. anon key 创建存储桶 ──');
const createBucket = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ id: 'zz-probe-temp', name: 'zz-probe-temp', public: true }),
});
const bt = await createBucket.text();
console.log(`   HTTP ${createBucket.status}  ${bt.slice(0, 140)}`);
console.log(createBucket.status === 200 || createBucket.status === 201
  ? '   → 可以创建（但这不该被允许，是配置宽松的信号）'
  : '   → 不能创建，新桶需人工在 Supabase 后台建立');

// ── 2. 未登录用户直接上传到 avatars
console.log('\n── 2. 未登录（anon）直接上传 avatars ──');
const anonUp = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/zz-probe/anon.txt`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'text/plain' },
  body: 'probe',
});
const at = await anonUp.text();
console.log(`   HTTP ${anonUp.status}  ${at.slice(0, 130)}`);
console.log(anonUp.status === 200
  ? '   ⚠️ 未登录也能上传 —— RLS 过宽'
  : '   ✅ 被拒绝（符合预期，需登录）');

// ── 3. 登录用户上传
console.log('\n── 3. 已登录用户上传 avatars ──');
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = `qa_probe_${Date.now().toString().slice(-8)}@foxsir-test.local`;
const PASS = 'Qa!123456';
const su = await sb.auth.signUp({ email, password: PASS, options: { data: { role: 'self', nickname: 'probe' } } });
if (su.error) {
  console.log('   注册测试账号失败: ' + su.error.message);
} else {
  let session = su.data.session;
  if (!session) {
    const li = await sb.auth.signInWithPassword({ email, password: PASS });
    session = li.data?.session;
  }
  if (!session) {
    console.log('   未取得会话（可能需邮箱确认），跳过上传测试');
  } else {
    const userId = session.user.id;
    const path = `${userId}/probe.txt`;
    const up = await sb.storage.from('avatars').upload(path, new Blob(['probe'], { type: 'text/plain' }), {
      contentType: 'text/plain', upsert: true,
    });
    console.log(`   上传到 avatars/${path}`);
    console.log(`   ${up.error ? '✗ ' + up.error.message : '✅ 成功'}`);

    // 清理
    if (!up.error) {
      const rm = await sb.storage.from('avatars').remove([path]);
      console.log(`   清理: ${rm.error ? '✗ ' + rm.error.message : '✅ 已删除探针文件'}`);
    }

    // ── 4. 尝试向不存在的桶上传（验证桶不存在时的报错）
    console.log('\n── 4. 向 media 桶上传（验证该桶是否存在）──');
    const upMedia = await sb.storage.from('media').upload(`${userId}/probe.txt`, new Blob(['probe']), {
      contentType: 'text/plain', upsert: true,
    });
    if (upMedia.error) {
      console.log(`   ✗ ${upMedia.error.message}`);
      console.log(`   → 若为 "Bucket not found"，则 media 桶尚未创建`);
    } else {
      console.log('   ✅ 上传成功 —— media 桶存在且可写');
      await sb.storage.from('media').remove([`${userId}/probe.txt`]);
      console.log('   （已清理探针文件）');
    }

    await sb.auth.signOut();
  }
}

console.log('\n════════ 结论 ════════');
