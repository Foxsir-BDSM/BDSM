#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/gen-archive-form-spec.py
从筛选后的题库生成 Zite 表单构建规格（build spec）

输入：E:\超级问卷题库.csv            （用户筛选后的 172 题）
输出：tools/archive-form-spec.json   （插入脚本的唯一数据源）

包含：
  · 12 个章节（含标题、说明、来源模块）
  · 39 个分组（章节内的小标题）
  · 172 个字段（建造序号、题目ID、章节、分组、题干、Zite字段类型、选项、条件）
  · 85 条条件显示规则（已归并为 5 类）

设计取舍见文件末尾 _notes。
"""
import sys, io, os, re, json
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

SRC = r'E:\超级问卷题库.csv'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'tools', 'archive-form-spec.json')

# ══════════════════════════════════════════════════════════════
# 一、章节定义（12 章，含分流提示）
# ══════════════════════════════════════════════════════════════
# src = 用户表中的「模块」名；title/desc 为录入 Zite 的展示文本
CHAPTERS = [
    {
        'no': 1, 'src': '一、身份门', 'title': '一、身份门',
        'desc': '本表四个身份共用。第 1 题决定后续所有题目的显隐，请如实选择。',
        'kind': 'universal',
    },
    {
        'no': 2, 'src': '二、基础信息', 'title': '二、基础信息',
        'desc': '用于建立档案与联系。地址与联系方式受隐私开关控制，可在第 11 章选择是否公开。',
        'kind': 'universal',
    },
    {
        'no': 3, 'src': '三、身体信息', 'title': '三、身体信息',
        'desc': '部分字段仅对应性别显示；开发程度相关仅下位者显示。',
        'kind': 'universal',
    },
    {
        'no': 4, 'src': '四、个人形象与状态', 'title': '四、个人形象与状态',
        'desc': '自我描述、情感状态、关系意向与圈层经历。',
        'kind': 'universal',
    },
    {
        'no': 5, 'src': '五、上位者专项', 'title': '五、上位者专项',
        'desc': '⚠️ 本章仅「男S / 女S」可见，共 41 题；下位者可跳过本章。'
                '内容涵盖经历可验证性、能力边界、安全习惯、关系形态、隐私承诺与现实条件。',
        'kind': 'top',
    },
    {
        'no': 6, 'src': '六、性经历与偏好', 'title': '六、性经历与偏好',
        'desc': '经历回顾与偏好；部分字段仅下位者或对应性别显示。',
        'kind': 'universal',
    },
    {
        'no': 7, 'src': '七、露出与影像', 'title': '七、露出与影像',
        'desc': '露出倾向、影像意愿与素材提交。照片受隐私开关控制。',
        'kind': 'universal',
    },
    {
        'no': 8, 'src': '九、兴趣体系 · 具体玩法条目', 'title': '八、玩法偏好',
        'desc': '逐项标注兴趣程度（1–5 分 / 未接触）。部分条目仅特定身份可见。',
        'kind': 'universal',
    },
    {
        'no': 9, 'src': '十、安全与边界', 'title': '九、安全与边界',
        'desc': '安全协议与红线声明。本章为必填核心，请如实填写。',
        'kind': 'universal',
    },
    {
        'no': 10, 'src': '十一、对上位者的确认', 'title': '十、对上位者的确认',
        'desc': '⚠️ 本章仅「男M / 女M」可见，共 6 题。'
                '这是第 5 章「上位者专项」的镜像——一份入场前的自我确认清单。',
        'kind': 'bottom',
    },
    {
        'no': 11, 'src': '十二、隐私与公开', 'title': '十一、隐私与公开',
        'desc': '逐项选择哪些内容可以公开。未选择公开的字段在档案中显示为「未公开」。',
        'kind': 'universal',
    },
    {
        'no': 12, 'src': '十三、问卷体验', 'title': '十二、问卷体验',
        'desc': '最后两个问题，帮助我们改进问卷。',
        'kind': 'universal',
    },
]

# ══════════════════════════════════════════════════════════════
# 二、字段类型映射（19 种 → Zite 字段类型）
# ══════════════════════════════════════════════════════════════
TYPE_MAP = {
    '单选':            ('single_select', False),
    '单选（必答）':      ('single_select', True),
    '多选':            ('multi_select', False),
    '多选（限2）':       ('multi_select', False),
    '多选（限3）':       ('multi_select', False),
    '多选 / 量表':       ('multi_select', False),
    '量表':            ('linear_scale', False),
    '量表（兴趣程度）':    ('linear_scale', False),
    '文本':            ('short_answer', False),
    '文本（必答）':       ('short_answer', True),
    '文本 / 长文本':     ('long_answer', False),
    '长文本':           ('long_answer', False),
    '长文本（必答）':      ('long_answer', True),
    '文本 / 图片':       ('file_upload', False),
    '图片上传':          ('file_upload', False),
    '图片上传（多张）':    ('file_upload', True),
    '数字':            ('number', False),
    '数字（必答）':       ('number', True),
    '日期':            ('date', False),
}

# 量表默认档位
SCALE_DEFAULT = {'min': 1, 'max': 5, 'minLabel': '不感兴趣', 'maxLabel': '非常感兴趣'}

# ══════════════════════════════════════════════════════════════
# 三、条件规则（5 类，归并到 Zite 的 Show if 表达式）
# ══════════════════════════════════════════════════════════════
GATE_ID = 'Q-GATE-01'   # 身份题，所有条件的引用源

COND_RULES = {
    'top': {
        'label': '上下位 = S',
        'expr': f'{GATE_ID} is any of 男S, 女S',
        'zite': 'Show if Q-GATE-01 is 男S OR 女S',
    },
    'bottom': {
        'label': '上下位 = M',
        'expr': f'{GATE_ID} is any of 男M, 女M',
        'zite': 'Show if Q-GATE-01 is 男M OR 女M',
    },
    'female': {
        'label': '性别 = 女',
        'expr': f'{GATE_ID} is any of 女S, 女M',
        'zite': 'Show if Q-GATE-01 is 女S OR 女M',
    },
    'male': {
        'label': '性别 = 男',
        'expr': f'{GATE_ID} is any of 男S, 男M',
        'zite': 'Show if Q-GATE-01 is 男S OR 男M',
    },
}

# 把用户表中的中文条件串映射到规则键
def cond_key(cond_text):
    c = str(cond_text)
    if c.startswith('始终显示'):
        return None
    if '上下位 = S' in c:
        return 'top'
    if '上下位 = M' in c:
        return 'bottom'
    if '性别 = 女' in c:
        return 'female'
    if '性别 = 男' in c:
        return 'male'
    # Q-E09 = 是 → 依赖已删除的题，标记为 broken 但仍原样保留
    if 'Q-E09' in c:
        return 'broken'
    return 'unknown'


# ══════════════════════════════════════════════════════════════
# 四、构建
# ══════════════════════════════════════════════════════════════
df = pd.read_csv(SRC, encoding='utf-8-sig', dtype=str).fillna('')
q = df[df['题目ID'].str.strip() != ''].copy()

src_to_chapter = {c['src']: c for c in CHAPTERS}

fields = []
chapters_out = []
seq = 0
unknown_types = []
unknown_conds = []
optionless = []

for ch in CHAPTERS:
    grp = q[q['模块'] == ch['src']]
    if grp.empty:
        print(f'  ⚠ 章节「{ch["src"]}」在题库中无对应题目')
        continue

    ch_entry = {
        'no': ch['no'],
        'title': ch['title'],
        'desc': ch['desc'],
        'kind': ch['kind'],
        'srcModule': ch['src'],
        'groups': [],
        'fieldCount': 0,
    }

    cur_group = None
    for _, r in grp.iterrows():
        g = str(r['分组']).strip()
        if g != cur_group:
            ch_entry['groups'].append({'title': g, 'fieldCount': 0})
            cur_group = g

        seq += 1
        raw_type = str(r['答题类型']).strip()
        mapping = TYPE_MAP.get(raw_type)
        if not mapping:
            unknown_types.append((r['题目ID'], raw_type))
            ztype, required = 'short_answer', False
        else:
            ztype, required = mapping

        ck = cond_key(r['显示条件（Fillout 逻辑）'])
        if ck == 'unknown':
            unknown_conds.append((r['题目ID'], r['显示条件（Fillout 逻辑）']))

        options = [o.strip() for o in str(r['选项/范围']).split('/') if o.strip()]
        cond_expr = str(r['显示条件（Fillout 逻辑）'])
        # 选项为空且是选择类 → 待补
        if ztype in ('single_select', 'multi_select') and not options and cond_expr != '始终显示（问卷第 1 题）':
            pass
        if ztype in ('single_select', 'multi_select') and not options:
            optionless.append((r['题目ID'], r['题目'], ztype))

        fld = {
            'seq': seq,
            'id': r['题目ID'],
            'chapterNo': ch['no'],
            'chapter': ch['title'],
            'group': g,
            'label': str(r['题目']).strip(),
            'rawType': raw_type,
            'ziteType': ztype,
            'required': required,
            'options': options,
            'condKey': ck,
            'condRaw': cond_expr,
            'condZite': COND_RULES[ck]['zite'] if ck in COND_RULES else (
                'BROKEN: 依赖已删除的 Q-E09，条件永假' if ck == 'broken' else None
            ),
            'note': str(r['备注']).strip(),
            'privacy': str(r['隐私级别']).strip(),
        }
        if ztype == 'linear_scale':
            fld['scale'] = dict(SCALE_DEFAULT)
        if raw_type in ('多选（限2）', '多选（限3）'):
            fld['maxSelect'] = int(raw_type[-2])
        if ztype == 'file_upload':
            fld['multiple'] = bool(mapping[1])

        fields.append(fld)
        ch_entry['fieldCount'] += 1
        ch_entry['groups'][-1]['fieldCount'] += 1

    chapters_out.append(ch_entry)

spec = {
    '_meta': {
        'generatedAt': datetime.now().isoformat(timespec='seconds'),
        'source': SRC,
        'target': 'https://app.zite.com/editor/nGXmc3thXsus/edit/uwj2',
        'purpose': 'Zite 表单构建规格：12 章 / 39 分组 / 172 字段 / 85 条条件',
        'fieldCount': len(fields),
        'chapterCount': len(chapters_out),
        'groupCount': sum(len(c['groups']) for c in chapters_out),
        'conditionalCount': sum(1 for f in fields if f['condKey']),
    },
    'identityGate': {
        'fieldId': GATE_ID,
        'label': '你的身份是',
        'options': ['男S', '女S', '男M', '女M'],
        'why': '所有条件显示规则的引用源，必须第一个创建',
    },
    'typeMap': {k: v[0] for k, v in TYPE_MAP.items()},
    'condRules': COND_RULES,
    'chapters': chapters_out,
    'fields': fields,
    '_issues': {
        'optionless': [{'id': i, 'label': l, 'type': t} for i, l, t in optionless],
        'unknownTypes': [{'id': i, 'type': t} for i, t in unknown_types],
        'unknownConds': [{'id': i, 'cond': c} for i, c in unknown_conds],
        'brokenCond': [{'id': f['id'], 'label': f['label'], 'cond': f['condRaw']}
                       for f in fields if f['condKey'] == 'broken'],
    },
    '_notes': [
        '章节顺序按计划第十部分：第 5 章（上位者专项）与第 10 章（对上位者的确认）相邻呼应。',
        '原「九、兴趣体系 · 具体玩法条目」改名为「八、玩法偏好」——模块八已清空，沿用旧编号会误导。',
        'Q-E10 的显示条件指向已删除的 Q-E09，条件永假，按用户要求原样保留。',
        '172 题在原表中全部标记「是否必填 = 是」；本规格仅对原表标注（必答）的题置 required=true。',
        '章节与分组的标题/说明用 Zite 的说明型字段承载，不收集数据。',
    ],
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(spec, f, ensure_ascii=False, indent=1)

# ══════════════════════════════════════════════════════════════
# 五、报告
# ══════════════════════════════════════════════════════════════
print('=' * 78)
print('Zite 表单构建规格已生成')
print('=' * 78)
print(f'  输出: tools/archive-form-spec.json')
print(f'  章节: {len(chapters_out)}   分组: {spec["_meta"]["groupCount"]}   字段: {len(fields)}')
print(f'  条件字段: {spec["_meta"]["conditionalCount"]}')
print()
print('  章节结构：')
for c in chapters_out:
    tag = {'universal': '四身份通用', 'top': '仅 S 可见', 'bottom': '仅 M 可见'}[c['kind']]
    print(f'    {c["no"]:>2}. {c["title"]:<22} {c["fieldCount"]:>3} 题  ({len(c["groups"])} 分组)  [{tag}]')
print()
print('  字段类型分布：')
from collections import Counter
for t, n in Counter(f['ziteType'] for f in fields).most_common():
    print(f'    {t:<16} {n:>3}')
print()
print('  条件分布：')
for k, n in Counter(f['condKey'] or '无条件' for f in fields).most_common():
    print(f'    {k:<12} {n:>3}')
print()
if optionless:
    print(f'  ⚠ 选择题但选项为空（需后补）: {len(optionless)} 题')
    for i, l, t in optionless:
        print(f'      {i:<16} {l}  [{t}]')
if unknown_types:
    print(f'  ⚠ 未映射类型: {unknown_types}')
if unknown_conds:
    print(f'  ⚠ 未识别条件: {unknown_conds}')
print()
print(f'  永假条件（Q-E09 已删）: {[f["id"] for f in fields if f["condKey"] == "broken"]}')
