#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读：核对 Q-EX12 及同类字段的完整标签是否被截断"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

src = pd.read_csv(r'E:\新建文件夹\超级题库_完整CSV_V1.csv', encoding='utf-8-sig', dtype=str).fillna('')
q = pd.read_csv(r'E:\超级问卷题库.csv', encoding='utf-8-sig', dtype=str).fillna('')
q = q[q['题目ID'].str.strip() != '']

print('=' * 78)
print('一、源 L0 里「验证素材」相关的完整字段名')
print('=' * 78)
for _, r in src.iterrows():
    t = str(r['调查问题'])
    if '验证' in t or 'Foxsir' in t or '合照' in t:
        print(f'  {r["题目ID"]}  [{r["一级分类"]}/{r["二级分类"]}]')
        print(f'      完整题干: {t}')
        print(f'      长度: {len(t)} 字')
        print()

print('=' * 78)
print('二、源 L0 里「文件上传」相关的完整字段名')
print('=' * 78)
for _, r in src.iterrows():
    t = str(r['调查问题'])
    if 'FileUpload' in t or '上传' in t:
        print(f'  {r["题目ID"]}  「{t}」')

print()
print('=' * 78)
print('三、用户表里 Q-EX12 的当前值')
print('=' * 78)
row = q[q['题目ID'] == 'Q-EX12']
if len(row):
    r = row.iloc[0]
    print(f'  题目  : {r["题目"]}   （{len(str(r["题目"]))} 字）')
    print(f'  选项  : {r["选项/范围"]}')
    print(f'  笔记  : {r["备注"]}')
    print()
    print('  → 源字段长度为 60+ 字，用户表里只有 21 字，属于筛选时的截断')
    print('  → 录入前建议向用户确认完整题干')

print()
print('=' * 78)
print('四、其余「文本 / 图片」四题的题干（Q-BD09~12）')
print('=' * 78)
for qid in ['Q-BD09', 'Q-BD10', 'Q-BD11', 'Q-BD12']:
    row = q[q['题目ID'] == qid]
    if len(row):
        print(f'  {qid}  「{row.iloc[0]["题目"]}」')

print()
print('=' * 78)
print('五、需要设计选项但当前为空的多选/量表题')
print('=' * 78)
for _, r in q.iterrows():
    if '多选' in str(r['答题类型']) and str(r['选项/范围']).strip() == '':
        print(f'  ⚠ {r["题目ID"]:<16} {r["题目"]}   [{r["答题类型"]}]')
    if '量表' in str(r['答题类型']) and str(r['选项/范围']).strip() == '':
        print(f'  ⚠ {r["题目ID"]:<16} {r["题目"]}   [{r["答题类型"]}]')
