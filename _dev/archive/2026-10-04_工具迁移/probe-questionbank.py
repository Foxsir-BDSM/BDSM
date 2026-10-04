#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/probe-questionbank.py —— 题库素材结构分析（只读，不修改）
输出：字段分布、题型分布、层级关系、四身份适用性缺口
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

BASE = r'E:\新建文件夹'
CSV = os.path.join(BASE, '超级题库_完整CSV_V1.csv')
XLSX = os.path.join(BASE, '问卷调查题库_重新梳理版.xlsx')

pd.set_option('display.max_colwidth', 40)
pd.set_option('display.width', 200)


def sep(t):
    print('\n' + '=' * 78)
    print(t)
    print('=' * 78)


sep('一、超级题库_完整CSV_V1.csv')
df = pd.read_csv(CSV, encoding='utf-8-sig', dtype=str).fillna('')
print(f'  行数: {len(df)}   列数: {len(df.columns)}')
print(f'  列名: {list(df.columns)}')

sep('二、记录类型分布')
print(df['记录类型'].value_counts().to_string())

sep('三、扩展层级分布')
print(df['扩展层级'].value_counts().to_string())

sep('四、题型分布')
print(df['题型'].value_counts().to_string())

sep('五、一级分类分布')
print(df['一级分类'].value_counts().to_string())

sep('六、二级分类分布（前 30）')
print(df['二级分类'].value_counts().head(30).to_string())

sep('七、状态分布')
print(df['状态'].value_counts().to_string())

sep('八、关系标签分布')
print(df['关系标签'].value_counts().to_string())

sep('九、安全处理分布')
print(df['安全处理'].value_counts().to_string())

sep('十、来源分布')
print(df['来源'].value_counts().to_string())

sep('十一、有父题的记录（逻辑跳题依据）')
has_parent = df[df['父题'].astype(str).str.strip() != '']
print(f'  有父题的记录数: {len(has_parent)}')
if len(has_parent):
    print(has_parent[['题目ID', '父题', '扩展层级', '调查问题', '关系标签']].head(25).to_string(index=False))

sep('十二、原始题库映射（L0，对应现有 56 字段）')
l0 = df[df['记录类型'] == '原始题库映射']
print(f'  数量: {len(l0)}')
print(l0[['题目ID', '一级分类', '二级分类', '调查问题']].head(60).to_string(index=False))

sep('十三、XLSX 工作表')
try:
    xl = pd.ExcelFile(XLSX)
    print('  工作表:', xl.sheet_names)
    for s in xl.sheet_names:
        d = pd.read_excel(XLSX, sheet_name=s, dtype=str).fillna('')
        print(f'\n  ── [{s}] {len(d)} 行 × {len(d.columns)} 列 ──')
        print(f'  列名: {list(d.columns)}')
        print(d.head(6).to_string(index=False))
except Exception as e:
    print('  读取失败:', e)
