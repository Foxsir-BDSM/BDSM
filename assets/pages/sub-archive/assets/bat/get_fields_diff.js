// assets/js/get_fields_diff.js
// 对比本地 config.js 与远程 Fillout 字段，输出差异报告
// 白名单中的字段，标签差异将被忽略

import { fileURLToPath } from 'url';
import path from 'path';
import https from 'https';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. 配置
// ============================================================
const API_KEY =
  'sk_prod_RmLkIOzDydDVignk4sW3tsKKpYaZff4xGIEfgwGhFsrGvGEzte7hkAtAZKjvhypMWx8nPbPLpEEXbxPYwPy0CTj9qpsKOPFGVYx_80053';
const DATABASE_ID = '0019555500b60c58';
const TABLE_ID = 'taRmZxGFzF5';
const OUTPUT_FILE = path.resolve(__dirname, '../../field_diff.txt');

// ============================================================
// 2. 白名单：这些字段的标签差异将被忽略
//    你可以把系统字段、不想被报告差异的字段加到这里
// ============================================================
const WHITELIST_IDS = new Set([
  // --- 首页专用 ---
  'fgerzjJpBTF', // 公开问卷
  'feVJMAAnX7s', // 推荐指数
  'fwK2mQMoxto', // 认证
  'fxwUAnrwpaT', // ID

  // --- 附件字段（标签为空，差异无意义） ---
  'fpAFnqZh8XY', // 生活照
  'fvXfbzs1w7q', // 照片2
  'f2tp4pmcEer', // 照片3
  'feExminrRcK', // 照片4
  'f5FpfrTPvQh', // 乳
  'fbbFbn2c9TV', // 穴
  'f9Jhy6F4jXh', // 臀
  'fjiCLYCpyeJ', // 腿
  'fk1ywquw4y5', // 验证照

  // --- 隐私控制字段（标签差异不影响业务） ---
  'f1s9DJg4oLc', // 常住地址（隐私确认）
  'fgHLgfGRzy8', // 联系方式（隐私确认）
  'fgtX9QmBAM5', // 生活照片（隐私确认）
  'fwEcZvqiGvm', // 隐私照片（隐私确认）
  'f1i68ZWVLAD', // 我已知悉
  'fkw18M6UR5s', // 继续填写
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
    const configModule = await import('../js/config.js');
    const localAll = configModule.FIELD_LABELS || {};

    console.log(`✅ 成功读取 config.js，共 ${Object.keys(localAll).length} 个字段`);
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

    // 2) 远程独有
    for (const [id, label] of Object.entries(remoteAll)) {
      if (!localAll.hasOwnProperty(id)) {
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

    if (output === '') {
      output = '✅ 本地与远程完全一致，无任何差异。\n';
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
