#!/usr/bin/env node
/**
 * tools/patch-auth-orientation.mjs
 * 把「取向」维度接入注册流程（src/launcher/auth.html）
 *
 * 改动：
 *   1. 注册表单在身份选择器之后插入取向选择器容器
 *   2. 导入取向选择器 API
 *   3. Tab 切换 / 初始化时一并渲染与重置
 *   4. 注册校验要求已选取向
 *   5. 写入 orientation / orientation_label 两个元数据字段
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'launcher', 'auth.html');

let t = fs.readFileSync(FILE, 'utf8');
const before = t;
const applied = [];

const apply = (label, from, to) => {
  if (!t.includes(from)) {
    console.log('  ✗ 未命中: ' + label);
    return;
  }
  t = t.split(from).join(to);
  applied.push(label);
  console.log('  ✓ ' + label);
};

// ① 表单：身份选择器之后插入取向容器
apply(
  '表单插入取向容器',
  `        <div class="form-group" id="identity-selector-container"></div>`,
  `        <div class="form-group" id="identity-selector-container"></div>
        <div class="form-group" id="orientation-selector-container"></div>`
);

// ② 导入
apply(
  '导入取向选择器 API',
  `import { renderIdentitySelector, getSelectedIdentityData, resetIdentitySelector } from '@/shared/js/identity-selector.js';`,
  `import {
            renderIdentitySelector,
            getSelectedIdentityData,
            resetIdentitySelector,
            renderOrientationSelector,
            getSelectedOrientation,
            resetOrientationSelector,
        } from '@/shared/js/identity-selector.js';`
);

// ③ Tab 切换时重置并渲染
apply(
  'Tab 切换渲染取向',
  `            resetIdentitySelector();
            renderIdentitySelector('identity-selector-container');`,
  `            resetIdentitySelector();
            renderIdentitySelector('identity-selector-container');
            resetOrientationSelector();
            renderOrientationSelector('orientation-selector-container');`
);

// ④ 初始化时渲染
apply(
  '初始化渲染取向',
  `        renderIdentitySelector('identity-selector-container');`,
  `        renderIdentitySelector('identity-selector-container');
        renderOrientationSelector('orientation-selector-container');`
);

// ⑤ 注册校验
apply(
  '注册校验取向必选',
  `            const identityData = getSelectedIdentityData();
            if (!identityData.valid) {
                return showMsg(identityData.error, 'error');
            }`,
  `            const identityData = getSelectedIdentityData();
            if (!identityData.valid) {
                return showMsg(identityData.error, 'error');
            }

            const orientationId = getSelectedOrientation();
            if (!orientationId) {
                return showMsg('请选择取向', 'error');
            }
            const orientationLabel = ({
                hetero: '异性', homo: '同性', bi: '双性', unsure: '未定',
            })[orientationId] || orientationId;`
);

// ⑥ 写入元数据
apply(
  '写入取向元数据',
  `                            secondary_identities: identityData.secondaryIds,
                            points: 0,`,
  `                            secondary_identities: identityData.secondaryIds,
                            orientation: orientationId,
                            orientation_label: orientationLabel,
                            points: 0,`
);

if (t === before) {
  console.log('\n⚠️ 未发生任何改动');
} else {
  fs.writeFileSync(FILE, t, 'utf8');
  console.log(`\n✅ 已更新 auth.html（${applied.length} 处）`);
}

const txt = fs.readFileSync(FILE, 'utf8');
console.log('  U+FFFD:', (txt.match(/\uFFFD/g) || []).length);
console.log('  含量表容器:', txt.includes('orientation-selector-container'));
console.log('  含取向元数据:', txt.includes('orientation: orientationId'));
