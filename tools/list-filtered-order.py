#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读：按用户行序输出 172 题的模块/分组结构，供制定表单段落使用"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df = pd.read_csv(r'E:\超级问卷题库.csv', encoding='utf-8-sig', dtype=str).fillna('')
q = df[df['题目ID'].str.strip() != '']

cur_m = cur_g = None
n = 0
for _, r in q.iterrows():
    n += 1
    m, g = r['模块'], r['分组']
    if m != cur_m:
        print(f'\n【{m}】')
        cur_m, cur_g = m, None
    if g != cur_g:
        print(f'   -- {g} --')
        cur_g = g
    cond = r['显示条件（Fillout 逻辑）']
    mark = '' if cond.startswith('始终显示') else f'   <<{cond}>>'
    print(f'   {n:>3}. {r["题目ID"]:<16} {r["题目"]}{mark}')
print(f'\n合计 {n} 题')
