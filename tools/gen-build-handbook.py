#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/gen-build-handbook.py
把 archive-form-spec.json 渲染成「照着手动录入」的清单文档

输出：表单搭建手册.md
"""
import sys, io, os, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPEC = os.path.join(ROOT, 'tools', 'archive-form-spec.json')
OUT = os.path.join(ROOT, '_dev', 'docs', '数据表', '表单搭建手册.md')

with open(SPEC, encoding='utf-8') as f:
    spec = json.load(f)

# Zite 字段类型中文名
TYPE_CN = {
    'single_select': 'Dropdown（下拉单选）',
    'multi_select': 'Multiselect（多选）',
    'short_answer': 'Short answer（单行文本）',
    'long_answer': 'Long answer（多行文本）',
    'number': 'Number（数字）',
    'date': 'Date picker（日期）',
    'linear_scale': 'Slider 或 Opinion scale（1–5）',
    'file_upload': 'File uploader（文件上传）',
}

COND_CN = {
    'top': '仅 S 可见',
    'bottom': '仅 M 可见',
    'female': '仅女性可见',
    'male': '仅男性可见',
    'broken': '⚠️ 条件永假（不显示）',
}

L = []
L.append('# 表单搭建手册 · 四身份综合档案表')
L.append('')
L.append('> 照此清单在 Zite 中逐段录入。每完成一章，建议先预览确认显隐无误再继续。')
L.append('')
L.append(f'**规模**：{spec["_meta"]["chapterCount"]} 章 / {spec["_meta"]["groupCount"]} 分组 / '
         f'{spec["_meta"]["fieldCount"]} 题（其中 {spec["_meta"]["conditionalCount"]} 题带条件）')
L.append('')

# ══════════════════════════════════════════════════
L.append('---')
L.append('')
L.append('# 零、开工前必读')
L.append('')
L.append('## 0.1 添加字段的方式')
L.append('')
L.append('**单击**左侧字段类型面板里的按钮即可添加，**不需要拖拽**。')
L.append('')
L.append('## 0.2 Zite 字段类型对照')
L.append('')
L.append('| 本表用到的类型 | Zite 里选什么 | 数量 |')
L.append('|:---|:---|---:|')
for t, n in sorted(((k, sum(1 for x in spec['fields'] if x['ziteType'] == k))
                    for k in {f['ziteType'] for f in spec['fields']}),
                   key=lambda x: -x[1]):
    L.append(f'| {t} | {TYPE_CN.get(t, t)} | {n} |')
L.append('')
L.append('## 0.3 章节标题怎么做')
L.append('')
L.append('每章开头放一个 **Heading**（章标题）+ 一个 **Paragraph**（章说明）。')
L.append('分组小标题用 **Paragraph** 加粗，或用 **Divider** 分隔。')
L.append('')
L.append('## 0.4 条件显示怎么设')
L.append('')
L.append('先建第 1 章第 1 题「你的身份是」（Dropdown，选项 男S/女S/男M/女M）。')
L.append('**它是所有条件规则的引用源**，必须先建好。之后每题在右侧属性面板 '
         '**Logic** 里设 Show if：')
L.append('')
L.append('| 条件 | Logic 表达式 | 题数 |')
L.append('|:---|:---|---:|')
for k, rule in spec['condRules'].items():
    n = sum(1 for f in spec['fields'] if f['condKey'] == k)
    L.append(f'| {COND_CN[k]} | `{rule["zite"]}` | {n} |')
L.append('')
L.append('## 0.5 本章提到的三处已知问题（按你的要求保留原样）')
L.append('')
for it in spec['_issues']['brokenCond']:
    L.append(f'- `{it["id"]}` {it["label"]} —— 条件指向已删除的 Q-E09，**不会显示**')
L.append(f'- 4 题多选选项待补：' + '、'.join(f'`{x["id"]}`' for x in spec['_issues']['optionless']))
L.append('- `Q-EX12` 题干为缩短版（按你的版本录入）')
L.append('')
L.append('---')
L.append('')

# ══════════════════════════════════════════════════
L.append('# 正文：逐章录入清单')
L.append('')

for ch in spec['chapters']:
    kind_tag = {'universal': '四身份通用', 'top': '⚠️ 仅 S 可见', 'bottom': '⚠️ 仅 M 可见'}[ch['kind']]
    L.append(f'## 第 {ch["no"]} 章　{ch["title"]}')
    L.append('')
    L.append(f'**{ch["fieldCount"]} 题**　·　{kind_tag}　·　{len(ch["groups"])} 个分组')
    L.append('')
    L.append('> **章说明（录入到 Paragraph）**：' + ch['desc'])
    L.append('')

    fields = [f for f in spec['fields'] if f['chapterNo'] == ch['no']]
    cur_group = None
    for f in fields:
        if f['group'] != cur_group:
            cur_group = f['group']
            L.append(f'### {cur_group}')
            L.append('')
            L.append('| # | 题干 | 字段类型 | 选项 | 条件 |')
            L.append('|:---|:---|:---|:---|:---|')
        opts = '、'.join(f['options']) if f['options'] else '—'
        if f['ziteType'] == 'linear_scale':
            opts = '1–5 分（左「不感兴趣」右「非常感兴趣」）'
        if f['ziteType'] == 'file_upload':
            opts = '上传文件' + ('（允许多张）' if f.get('multiple') else '')
        cond = COND_CN.get(f['condKey'], '—') if f['condKey'] else '—'
        L.append(f'| {f["seq"]} | {f["label"]} | {TYPE_CN.get(f["ziteType"], f["ziteType"])} | {opts} | {cond} |')
    L.append('')

# ══════════════════════════════════════════════════
L.append('---')
L.append('')
L.append('# 附录 A · 条件字段总清单（设 Logic 时照此核对）')
L.append('')
for key, rule in spec['condRules'].items():
    fs = [f for f in spec['fields'] if f['condKey'] == key]
    L.append(f'## {COND_CN[key]}（{len(fs)} 题）')
    L.append('')
    L.append(f'Logic：`{rule["zite"]}`')
    L.append('')
    for f in fs:
        L.append(f'- [ ] `{f["id"]}` {f["label"]}')
    L.append('')

L.append('---')
L.append('')
L.append('# 附录 B · 待补选项的 4 道多选题')
L.append('')
L.append('先建成空的多选框，选项待定：')
L.append('')
L.append('| 题号 | 题干 |')
L.append('|:---|:---|')
for x in spec['_issues']['optionless']:
    L.append(f'| `{x["id"]}` | {x["label"]} |')
L.append('')

L.append('---')
L.append('')
L.append('# 附录 C · 进度勾选表')
L.append('')
L.append('| 章 | 题数 | 已完成 |')
L.append('|:---|---:|:---:|')
for ch in spec['chapters']:
    L.append(f'| {ch["title"]} | {ch["fieldCount"]} | [ ] |')
L.append(f'| **合计** | **{spec["_meta"]["fieldCount"]}** | |')
L.append('')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(L))

print('=' * 74)
print('表单搭建手册已生成')
print('=' * 74)
print(f'  输出: {os.path.basename(OUT)}')
print(f'  章节: {len(spec["chapters"])}   字段: {len(spec["fields"])}')
print(f'  行数: {len(L)}')
