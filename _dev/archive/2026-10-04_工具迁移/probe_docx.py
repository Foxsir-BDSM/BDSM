#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/probe_docx.py —— 扫描参考目录中的 docx，输出其结构大纲
用途：了解现有问卷/任务/家规模板的结构，作为编辑器字段设计的参考。
不复制内容，只提取「结构」（标题层级、表格数、字段名）。
"""
import sys, io, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

BASE = r'E:\新建文件夹'

TARGETS = [
    r'家规及玩法\家规----.docx',
    r'家规及玩法\档案二.docx',
    r'文档\档案一.docx',
    r'文档\文件\M自评报告.docx',
    r'文档\文件\M自评报告（女版）.docx',
    r'文档\文件\M自评报告（男版）.docx',
    r'BDSM核心玩法分类.docx',
]


def outline(path, max_paras=60, max_tables=3):
    print('=' * 74)
    print('文件:', os.path.relpath(path, BASE))
    try:
        doc = Document(path)
    except Exception as e:
        print('  读取失败:', e)
        return

    paras = [p for p in doc.paragraphs]
    print(f'  段落数: {len(paras)}   表格数: {len(doc.tables)}')

    # 标题层级
    heads = [(p.style.name, p.text.strip()) for p in paras
             if p.style and p.style.name.lower().startswith('heading') and p.text.strip()]
    if heads:
        print('  ── 标题层级 ──')
        for st, tx in heads[:40]:
            lvl = ''.join(ch for ch in st if ch.isdigit()) or '?'
            print(f'    H{lvl}  {tx[:66]}')

    # 前若干非空段落（看是否有「字段名：」模式）
    print('  ── 段落样例（前 %d 条非空）──' % max_paras)
    cnt = 0
    for p in paras:
        t = p.text.strip()
        if not t:
            continue
        print('    ·', t[:88])
        cnt += 1
        if cnt >= max_paras:
            break

    # 表格结构（只列尺寸与前两行）
    for i, tb in enumerate(doc.tables[:max_tables]):
        print(f'  ── 表格{i+1}: {len(tb.rows)} 行 × {len(tb.columns)} 列 ──')
        for r in tb.rows[:4]:
            cells = [c.text.strip().replace('\n', ' ')[:22] for c in r.cells]
            print('    | ' + ' | '.join(cells) + ' |')


for rel in TARGETS:
    p = os.path.join(BASE, rel)
    if os.path.exists(p):
        outline(p)
    else:
        print('=' * 74)
        print('缺失:', rel)

# 目录扫描：是否还有别的 docx
print('=' * 74)
print('目录内全部 docx：')
for f in glob.glob(os.path.join(BASE, '**', '*.docx'), recursive=True):
    print('  ', os.path.relpath(f, BASE), f'({os.path.getsize(f)//1024} KB)')
