#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""比对：用户的筛选版 vs 我生成的版本（只看差异，只读）"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

MINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '超级问卷题库_四身份版.csv')
USER = r'E:\超级问卷题库.csv'

a = pd.read_csv(MINE, encoding='utf-8-sig', dtype=str).fillna('')
b = pd.read_csv(USER, encoding='utf-8-sig', dtype=str).fillna('')
a = a[a['题目ID'].str.strip() != '']
b = b[b['题目ID'].str.strip() != '']

ia = {r['题目ID']: r for _, r in a.iterrows()}
ib = {r['题目ID']: r for _, r in b.iterrows()}

print('=' * 78)
print('一、增删情况')
print('=' * 78)
print(f'  我的版本: {len(ia)} 题')
print(f'  你的版本: {len(ib)} 题')
print(f'  删除    : {len(set(ia) - set(ib))} 题')
print(f'  新增    : {len(set(ib) - set(ia))} 题（应为 0，若非 0 说明你加了题）')

added = set(ib) - set(ia)
if added:
    print('  新增题目:')
    for k in sorted(added):
        print(f'    + {k}  {ib[k]["题目"]}')

print()
print('=' * 78)
print('二、保留题的字段是否有改动')
print('=' * 78)
COLS = ['题目', '答题类型', '选项/范围', '适用身份', '显示条件（Fillout 逻辑）',
        '依赖题目', '否时跳转', '是否必填', '隐私级别', '是否入库', '备注']
changes = []
for k in sorted(set(ia) & set(ib)):
    for c in COLS:
        va, vb = str(ia[k][c]).strip(), str(ib[k][c]).strip()
        if va != vb:
            changes.append((k, c, va, vb))

if not changes:
    print('  ✅ 保留题目与我的版本逐字段一致，你只做了「删行」')
else:
    print(f'  共 {len(changes)} 处字段改动：')
    for k, c, va, vb in changes:
        print(f'\n  ▸ {k}  [{c}]')
        print(f'      原: {va[:90]}')
        print(f'      新: {vb[:90]}')

print()
print('=' * 78)
print('三、按模块看保留率')
print('=' * 78)
ma = a['模块'].value_counts()
mb = b['模块'].value_counts()
mods = sorted(set(ma.index) | set(mb.index), key=lambda x: str(x))
print(f'  {"模块":<26}{"原":>5}{"现":>5}{"保留率":>8}')
for m in mods:
    o, n = int(ma.get(m, 0)), int(mb.get(m, 0))
    rate = f'{n/o*100:.0f}%' if o else '—'
    flag = '  ← 已清空' if o and not n else ''
    print(f'  {m:<26}{o:>5}{n:>5}{rate:>8}{flag}')

print()
print('=' * 78)
print('四、空行情况')
print('=' * 78)
raw = pd.read_csv(USER, encoding='utf-8-sig', dtype=str, keep_default_na=False).fillna('')
blank = raw[raw['题目ID'].astype(str).str.strip() == '']
print(f'  总行数: {len(raw)}   空行: {len(blank)}')
if len(blank):
    idx = blank.index.tolist()
    # 找连续区间
    runs, start = [], idx[0]
    for i in range(1, len(idx)):
        if idx[i] != idx[i-1] + 1:
            runs.append((start, idx[i-1])); start = idx[i]
    runs.append((start, idx[-1]))
    print('  空行位置（0-based 行号区间）:')
    for s, e in runs:
        print(f'    行 {s}–{e}  （共 {e-s+1} 行）')
