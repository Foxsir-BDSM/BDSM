#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读分析：E:\超级问卷题库.csv（用户筛选后的版本）"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

F = r'E:\超级问卷题库.csv'
df = pd.read_csv(F, encoding='utf-8-sig', dtype=str).fillna('')

print('=' * 80)
print('一、整体')
print('=' * 80)
print(f'  总行数（含空行）: {len(df)}')
非空 = df[df['题目ID'].astype(str).str.strip() != ''].copy()
print(f'  有题目ID的行    : {len(非空)}')
空行 = df[df['题目ID'].astype(str).str.strip() == '']
print(f'  空行            : {len(空行)}')

print()
print('=' * 80)
print('二、模块分布（对照我生成的 13 模块）')
print('=' * 80)
mods = 非空['模块'].value_counts()
for m, n in mods.items():
    print(f'  {m:<24} {n:>4} 题')

print()
print('=' * 80)
print('三、分组分布')
print('=' * 80)
for m, g in 非空.groupby('模块', sort=False):
    groups = g['分组'].value_counts()
    print(f'\n  【{m}】{len(g)} 题')
    for name, n in groups.items():
        print(f'    · {name:<20} {n:>3} 题')

print()
print('=' * 80)
print('四、适用身份分布')
print('=' * 80)
print(非空['适用身份'].value_counts().to_string())

print()
print('=' * 80)
print('五、显示条件分布')
print('=' * 80)
print(非空['显示条件（Fillout 逻辑）'].value_counts().head(25).to_string())

print()
print('=' * 80)
print('六、答题类型分布')
print('=' * 80)
print(非空['答题类型'].value_counts().to_string())

print()
print('=' * 80)
print('七、是否必填 / 隐私级别 / 是否入库')
print('=' * 80)
for col in ['是否必填', '隐私级别', '是否入库']:
    print(f'\n  ── {col} ──')
    print(非空[col].value_counts().to_string())

print()
print('=' * 80)
print('八、是否保留了「兴趣体系」的 416 题')
print('=' * 80)
interest = 非空[非空['题目ID'].str.startswith('Q-INT-', na=False)]
print(f'  Q-INT-* 题目数: {len(interest)}')
if len(interest):
    print(interest[['题目ID', '分组', '题目', '显示条件（Fillout 逻辑）']].head(20).to_string(index=False))
else:
    print('  → 兴趣体系的 416 题已被整体删除')

print()
print('=' * 80)
print('九、是否保留了「上位者专项」的 41 题')
print('=' * 80)
s_side = 非空[非空['模块'].str.contains('上位者', na=False)]
print(f'  上位者专项题数: {len(s_side)}')
if len(s_side):
    print(s_side[['题目ID', '分组', '题目']].to_string(index=False))

print()
print('=' * 80)
print('十、全部保留的题目清单')
print('=' * 80)
for _, r in 非空.iterrows():
    cond = r['显示条件（Fillout 逻辑）']
    tag = '' if cond == '始终显示' else f'  [{cond}]'
    print(f"  {r['题目ID']:<16} {r['题目']}{tag}")
