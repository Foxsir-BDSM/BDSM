#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读：列出 L1 标准题库的分类与题目，作为问卷表骨架"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

CSV = r'E:\新建文件夹\超级题库_完整CSV_V1.csv'
df = pd.read_csv(CSV, encoding='utf-8-sig', dtype=str).fillna('')

l1 = df[df['扩展层级'] == 'L1']
print(f'L1 标准题库: {len(l1)} 条')
print('=' * 70)
for cat, g in l1.groupby('一级分类', sort=False):
    print(f'\n【{cat}】{len(g)} 题')
    for _, r in g.iterrows():
        print(f"  {r['题目ID']:>10}  {str(r['调查问题'])[:52]:<54} | {r['题型']}")
