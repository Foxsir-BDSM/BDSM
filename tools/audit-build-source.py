#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读：逐字段导出 172 题的完整录入信息，检查是否有截断/空标签/异常选项"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df = pd.read_csv(r'E:\超级问卷题库.csv', encoding='utf-8-sig', dtype=str).fillna('')
q = df[df['题目ID'].str.strip() != ''].copy()

print('=' * 78)
print('一、题干为空或过短（可能截断）')
print('=' * 78)
bad = q[q['题目'].str.strip().str.len() < 3]
if len(bad):
    for _, r in bad.iterrows():
        print(f'  ⚠ {r["题目ID"]:<16} 「{r["题目"]}」  备注: {r["备注"][:70]}')
else:
    print('  ✅ 无')

print()
print('=' * 78)
print('二、题干含截断痕迹（…、...、——结尾、括号未闭合）')
print('=' * 78)
found = False
for _, r in q.iterrows():
    t = str(r['题目'])
    if t.endswith('…') or t.endswith('...') or (t.count('（') != t.count('）')) or (t.count('(') != t.count(')')):
        print(f'  ⚠ {r["题目ID"]:<16} 「{t}」')
        print(f'      备注: {str(r["备注"])[:90]}')
        found = True
if not found:
    print('  ✅ 无')

print()
print('=' * 78)
print('三、题目ID 为「待确认 / 待定」或非 Q- 开头')
print('=' * 78)
odd = q[~q['题目ID'].str.startswith('Q-')]
if len(odd):
    for _, r in odd.iterrows():
        print(f'  ⚠ {r["题目ID"]:<16} {r["题目"]}')
else:
    print('  ✅ 全部以 Q- 开头')

print()
print('=' * 78)
print('四、答题类型 → 建议 Zite/ 字段类型 映射')
print('=' * 78)
MAP = {
    '单选': 'Single Select',
    '单选（必答）': 'Single Select',
    '多选': 'Multi Select',
    '多选（限2）': 'Multi Select（限 2 项）',
    '多选（限3）': 'Multi Select（限 3 项）',
    '多选 / 量表': 'Multi Select 或 Scale（二选一）',
    '量表': 'Linear Scale / Rating',
    '量表（兴趣程度）': 'Linear Scale 1–5',
    '文本': 'Short Answer',
    '文本（必答）': 'Short Answer（必填）',
    '文本 / 长文本': 'Long Answer',
    '文本 / 图片': 'File Upload + 备注',
    '长文本': 'Long Answer',
    '长文本（必答）': 'Long Answer（必填）',
    '数字': 'Number',
    '数字（必答）': 'Number（必填）',
    '日期': 'Date',
    '图片上传': 'File Upload（单张）',
    '图片上传（多张）': 'File Upload（多张）',
}
counts = q['答题类型'].value_counts()
unmapped = []
for t, n in counts.items():
    z = MAP.get(t)
    if not z:
        unmapped.append(t)
    print(f'  {t:<18} ×{n:<4} → {z or "⚠ 未映射"}')
if unmapped:
    print(f'\n  ⚠ 未映射的类型: {unmapped}')

print()
print('=' * 78)
print('五、选项字段为空的题（需要设计选项）')
print('=' * 78)
empty_opt = q[(q['选项/范围'].str.strip() == '')]
by_type = empty_opt.groupby('答题类型').size()
print(f'  共 {len(empty_opt)} 题选项为空：')
for t, n in by_type.items():
    print(f'    {t:<18} {n} 题')

print()
print('=' * 78)
print('六、需要条件逻辑的题（条件隐藏规则清单）')
print('=' * 78)
cond = q[~q['显示条件（Fillout 逻辑）'].str.startswith('始终显示')]
print(f'  共 {len(cond)} 题，按条件归并：')
rules = {}
for _, r in cond.iterrows():
    c = r['显示条件（Fillout 逻辑）']
    key = c.split(' 且 ')[0]
    rules.setdefault(key, []).append(r['题目ID'])
for k, v in sorted(rules.items(), key=lambda x: -len(x[1])):
    print(f'  · {k:<22} {len(v):>3} 题')

print()
print('=' * 78)
print('七、包含图片/文件上传的题（需确认存储）')
print('=' * 78)
for _, r in q.iterrows():
    if '图片' in str(r['答题类型']) or 'File' in str(r['选项/范围']):
        print(f'  {r["题目ID"]:<16} {r["题目"]:<28} [{r["答题类型"]}]  隐私: {r["隐私级别"]}')

print()
print('=' * 78)
print('八、单行长度最长的 5 题（题干较长的，录入时注意换行）')
print('=' * 78)
for _, r in q.assign(L=q['题目'].str.len()).nlargest(5, 'L').iterrows():
    print(f'  {r["L"]:>3} 字  {r["题目ID"]:<16} {r["题目"]}')
