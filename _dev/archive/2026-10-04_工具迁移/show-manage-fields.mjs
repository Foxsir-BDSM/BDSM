#!/usr/bin/env node
/**
 * tools/show-manage-fields.mjs —— 打印档案管理表格实际渲染的列
 */
const { getFieldsFor, labelOf } = await import('../src/shared/config/archive/fields.js');

const ids = getFieldsFor('manage');
console.log(`════ 档案管理可编辑字段（${ids.length} 项）════\n`);
ids.forEach((id, i) => {
  const label = String(labelOf(id) || '');
  console.log(`  ${String(i + 1).padStart(2)}. ${label.padEnd(14)} ${String(label.length).padStart(2)} 字   id=${id}`);
});
const max = Math.max(...ids.map((id) => String(labelOf(id) || '').length));
console.log(`\n  最长列名: ${max} 字`);
console.log(`  表格总列数: ${ids.length}（可编辑）+ 1（姓名）= ${ids.length + 1}`);
console.log(`  注：渲染时还会追加一列「状态」用于显示保存提示`);
