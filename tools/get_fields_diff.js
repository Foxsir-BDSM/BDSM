// tools/get_fields_diff.js
// 对比本地 config.js 与远程 Fillout 字段，输出差异报告
// 白名单中的字段，标签差异将被忽略
//
// 用法：node tools/get_fields_diff.js
// 输出：field_diff.txt（按「字段id: '名称'」格式，可直接粘贴回 FIELD_LABELS）

import { fileURLToPath } from 'url';
import path from 'path';
import https from 'https';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. 配置
// ------------------------------------------------------------
// 数据源不再硬编码：从 src/shared/config/archive/api.js 读取，
// 避免数据库迁移后本工具仍在对比旧库（曾因此产出错误报告）。
// ============================================================
const { BASE_ID, TABLE_ID, API_KEY } = await import('../src/shared/config/archive/api.js');
const DATABASE_ID = BASE_ID;
const OUTPUT_FILE = path.resolve(__dirname, '../field_diff.txt');

// ============================================================
// 2. 白名单：这些字段的标签差异将被忽略
//    你可以把系统字段、不想被报告差异的字段加到这里
//
// 变更（2026-10-04）：数据库已迁移，旧白名单全是旧库 ID，已清空。
//    新库若出现「远程标签与本地不同但无业务影响」的字段，再加到这里。
// ============================================================
const WHITELIST_IDS = new Set([
  // 本地有意改名的字段：远程名带换行或为默认占位名，不适合展示。
  // 如希望本地跟随远程，删掉下面三行即可。
  'f2GdxJp7zxb', // 本地「验证素材」  ← 远程是带换行的说明文字
  'fbrzqgWKxKj', // 本地「素材附件 1」← 远程是 Untitled FileUpload field
  'f2PfcBcVByU', // 本地「素材附件 2」← 远程是 Untitled FileUpload field (1)
]);

// ============================================================
// 3. 从远程获取字段
// ============================================================
function fetchRemoteFields() {
  return new Promise((resolve, reject) => {
    const url = `https://tables.fillout.com/api/v1/bases/${DATABASE_ID}`;
    const req = https.get(
      url,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const table = json.tables.find((t) => t.id === TABLE_ID);
            if (!table) {
              reject(new Error(`未找到表 ${TABLE_ID}`));
              return;
            }
            const remote = {};
            table.fields.forEach((f) => {
              remote[f.id] = f.name;
            });
            resolve(remote);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ============================================================
// 4. 主函数
// ============================================================
async function run() {
  try {
    const configModule = await import('../src/modules/sub-archive/js/config.js');
    const localAll = configModule.FIELD_LABELS || {};

    // 系统字段（如 Source）已在 SYSTEM_FIELD_IDS 中登记，
    // 它们本就不进 FIELD_LABELS，不应被报为「远程有本地没有」
    const systemIds = Object.keys(configModule.SYSTEM_FIELD_IDS || {});
    systemIds.forEach((id) => WHITELIST_IDS.add(id));

    console.log(`✅ 成功读取 config.js，共 ${Object.keys(localAll).length} 个字段`);
    if (systemIds.length) console.log(`   另有系统字段 ${systemIds.length} 个（自动豁免）: ${systemIds.join(', ')}`);
    console.log('📡 正在获取远程字段...');
    const remoteAll = await fetchRemoteFields();

    console.log(`📊 本地字段数: ${Object.keys(localAll).length}`);
    console.log(`📊 远程字段数: ${Object.keys(remoteAll).length}`);

    // ============================================================
    // 分类对比
    // ============================================================
    const onlyLocal = {};
    const onlyRemote = {};
    const diffLabel = {};
    const diffId = {};

    // 1) 本地独有
    for (const [id, label] of Object.entries(localAll)) {
      if (!remoteAll.hasOwnProperty(id)) {
        onlyLocal[id] = label;
      }
    }

    // 2) 远程独有（排除已登记的系统字段）
    for (const [id, label] of Object.entries(remoteAll)) {
      if (!localAll.hasOwnProperty(id) && !WHITELIST_IDS.has(id)) {
        onlyRemote[id] = label;
      }
    }

    // 3) 标签不同（排除白名单）
    for (const [id, label] of Object.entries(localAll)) {
      if (remoteAll.hasOwnProperty(id) && remoteAll[id] !== label) {
        if (!WHITELIST_IDS.has(id)) {
          diffLabel[id] = { localLabel: label, remoteLabel: remoteAll[id] };
        }
      }
    }

    // 4) ID不同但标签相同
    const labelToRemoteId = {};
    for (const [id, label] of Object.entries(remoteAll)) {
      if (!labelToRemoteId[label]) labelToRemoteId[label] = [];
      labelToRemoteId[label].push(id);
    }
    for (const [id, label] of Object.entries(localAll)) {
      if (labelToRemoteId[label] && labelToRemoteId[label].length > 0) {
        for (const remoteId of labelToRemoteId[label]) {
          if (remoteId !== id && !diffLabel[id] && !diffLabel[remoteId]) {
            if (!diffId[label]) {
              diffId[label] = { localId: id, remoteId: remoteId };
            }
          }
        }
      }
    }

    // ============================================================
    // 生成输出报告
    // ============================================================
    let output = '';
    output += `📋 字段对比报告\n`;
    output += `生成时间: ${new Date().toLocaleString()}\n\n`;

    if (Object.keys(onlyLocal).length > 0) {
      output += '// ============================================================\n';
      output += '// 本地有，远程没有（可能已废弃或需要删除）\n';
      output += '// ============================================================\n';
      for (const [id, label] of Object.entries(onlyLocal)) {
        output += `  '${id}': '${label}',\n`;
      }
      output += '\n';
    }

    if (Object.keys(onlyRemote).length > 0) {
      output += '// ============================================================\n';
      output += '// 远程有，本地没有（需要新增到 FIELD_LABELS）\n';
      output += '// ============================================================\n';
      for (const [id, label] of Object.entries(onlyRemote)) {
        output += `  '${id}': '${label}',\n`;
      }
      output += '\n';
    }

    if (Object.keys(diffLabel).length > 0) {
      output += '// ============================================================\n';
      output += '// ID相同，但标签不同（需要更新本地标签）\n';
      output += '// 格式: ID | 远程标签 | 本地标签\n';
      output += '// ============================================================\n';
      for (const [id, { localLabel, remoteLabel }] of Object.entries(diffLabel)) {
        output += `  ${id} | ${remoteLabel} | ${localLabel}\n`;
      }
      output += '\n';
    }

    if (Object.keys(diffId).length > 0) {
      output += '// ============================================================\n';
      output += '// 标签相同，但ID不同（需要用远程ID替换本地ID）\n';
      output += '// 格式: "标签": "远程ID", //本地ID\n';
      output += '// ============================================================\n';
      for (const [label, { localId, remoteId }] of Object.entries(diffId)) {
        output += `  '${label}': '${remoteId}', // ${localId}\n`;
      }
      output += '\n';
    }

    // 无差异判定：四个差异桶全空即为一致
    // （原实现判断 output === ''，但 output 开头已写标题，条件永不成立 —— 已修）
    const noDiff = Object.keys(onlyLocal).length === 0
      && Object.keys(onlyRemote).length === 0
      && Object.keys(diffLabel).length === 0
      && Object.keys(diffId).length === 0;
    if (noDiff) {
      output += '✅ 本地与远程完全一致，无任何差异。\n';
    }

    fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
    console.log(`\n✅ 对比完成！结果已保存到 ${OUTPUT_FILE}`);
    console.log('\n' + output);
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
