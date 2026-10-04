#!/usr/bin/env node
// tools/fix-fields-ids.mjs —— 修正抄错的字段 ID 并补齐缺失字段
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src', 'shared', 'config', 'archive', 'fields.js');

let t = fs.readFileSync(FILE, 'utf8');
const before = t;

// ① 修正抄错的 ID：fhUrgTMzZbb → fhUrgTMzZnb（是否公开生活照片）
const wrongCount = (t.match(/fhUrgTMzZbb/g) || []).length;
t = t.split('fhUrgTMzZbb').join('fhUrgTMzZnb');

// ② 补「电子邮件」字段（URL 参数注入的账号绑定字段）
t = t.replace(
  `export const FIELD_LABELS = {
  // ---- 问卷控制 / 隐私公开（8）----`,
  `export const FIELD_LABELS = {
  // ---- 账号绑定（由表单 URL 参数自动注入）----
  fqqEWH7xiC9: '电子邮件',

  // ---- 问卷控制 / 隐私公开 ----`
);

// ③ 把「封面展示」加入基本信息分组（原漏放，导致它既不显示也不报错）
t = t.replace(
  `    fields: [
      'fkHpgmVVTg7',  // 姓名
      'fwz4nCDQfZH',  // 身份`,
  `    fields: [
      'f4bYfA5vsJ3',  // 封面展示
      'fkHpgmVVTg7',  // 姓名
      'fwz4nCDQfZH',  // 身份`
);

fs.writeFileSync(FILE, t, 'utf8');

console.log('✅ fields.js 已修正');
console.log(`   ① 抄错的 ID  fhUrgTMzZbb → fhUrgTMzZnb   共 ${wrongCount} 处`);
console.log('   ② 补入「电子邮件」fqqEWH7xiC9');
console.log('   ③ 「封面展示」f4bYfA5vsJ3 已加入基本信息分组');
console.log('   变更: ' + (t !== before ? '是' : '否'));
