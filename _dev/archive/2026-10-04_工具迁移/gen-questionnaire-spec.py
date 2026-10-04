#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/gen-questionnaire-spec.py
由题库素材生成「四身份问卷规范」（question-bank.json）

输入：
  E:\新建文件夹\超级题库_完整CSV_V1.csv   （987 条，含父题/层级/分类/题型）
  E:\新建文件夹\问卷调查题库_重新梳理版.xlsx（146 条标准题）

输出：
  src/shared/config/questionnaire/question-bank.json

设计目标（用户要求）：
  · 四个身份（男S / 女S / 男M / 女M）均能使用同一份问卷
  · 依据身份与答案做题目显隐（Fillout 原生支持 conditional logic）

显隐维度：
  gender    male | female        —— 性别专属字段
  position  top  | bottom        —— 上下位专属字段
  interest  父题锚点             —— 「您喜欢X吗」为否时整块折叠
"""
import sys, io, os, re, json
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

SRC = r'E:\新建文件夹'
CSV = os.path.join(SRC, '超级题库_完整CSV_V1.csv')
XLSX = os.path.join(SRC, '问卷调查题库_重新梳理版.xlsx')
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'shared', 'config', 'questionnaire')
OUT = os.path.join(OUT_DIR, 'question-bank.json')

df = pd.read_csv(CSV, encoding='utf-8-sig', dtype=str).fillna('')

# ────────────────────────────────────────────────────────────
# 一、显隐规则
# ────────────────────────────────────────────────────────────

# 性别专属（只在对应性别显示）
RULES_GENDER = {
    'female': [
        ('罩杯', 'female'), ('三围', 'female'), ('乳', 'female'), ('穴', 'female'),
        ('扩阴', 'female'), ('乳环', 'female'), ('阴环', 'female'), ('阴道内窥镜', 'female'),
        ('乳夹', 'female'), ('阴唇', 'female'), ('踩阴', 'female'), ('舔阴', 'female'),
        ('怀孕', 'female'), ('经期', 'female'), ('淫穴', 'female'), ('母狗', 'female'),
    ],
    'male': [
        ('睾丸', 'male'), ('阳具崇拜', 'male'), ('龟头', 'male'), ('包皮', 'male'),
    ],
}

# 上下位专属（只在对应位置显示）
RULES_POSITION = {
    'bottom': [
        '身体开发进度', '百人斩', '都被什么人操过', '最淫荡的经历', '最下贱的过去',
        '舔舐', '舔精', '舔阴', '舔肛', '母畜', '母狗', '淫贱',
    ],
    'top': [
        '最长调教时间', '调教频率', '调教程度', '外出调教', '伴侣被他人调教',
    ],
}

# 四位身份都可回答的「身份门」题目（问卷最前面）
IDENTITY_GATE = [
    {
        'id': 'GATE_IDENTITY',
        'label': '身份',
        'type': 'single',
        'required': True,
        'options': ['男S', '女S', '男M', '女M'],
        'note': '决定后续题目的显隐；四个身份共用同一份问卷',
        'maps_to': {'gender': {'男S': 'male', '女S': 'female', '男M': 'male', '女M': 'female'},
                    'position': {'男S': 'top', '女S': 'top', '男M': 'bottom', '女M': 'bottom'}},
    },
    {
        'id': 'GATE_ORIENTATION',
        'label': '取向',
        'type': 'single',
        'required': True,
        'options': ['异性', '同性', '双性', '未定'],
        'note': '决定档案库默认展示谁',
    },
]


def rule_for(question_text, category=''):
    """返回该题的显隐条件"""
    t = str(question_text)
    cond = {}

    # 位置优先（上下位比性别更本质）
    for pos, keys in RULES_POSITION.items():
        if any(k in t for k in keys):
            cond['position'] = pos
            return cond

    # 性别
    for g, pairs in RULES_GENDER.items():
        if any(k in t for k in pairs):
            cond['gender'] = g
            return cond

    # 女装/伪娘类：男M 也可能需要（跨性别恋物），不按性别屏蔽
    if re.search(r'女装|伪娘|义乳|假阴|女仆装|女性内衣', t):
        return {'note': '跨性别恋物，男M/伪娘场景同样适用，故不按性别屏蔽'}

    return {}


# ────────────────────────────────────────────────────────────
# 二、构建题目记录
# ────────────────────────────────────────────────────────────

def qtype_of(raw_type, question):
    """题型归一化到可落地表单的 6 种"""
    rt = str(raw_type)
    if '图片' in rt or '文件' in rt:
        return 'file'
    if '长文本' in rt and '选择' in rt:
        return 'long_text'
    if '量表' in rt and '选择' in rt:
        return 'scale'
    if '开放' in rt or '长文本' in rt:
        return 'long_text'
    if '单选' in rt or '选择' in rt:
        return 'single'
    if '说明' in rt or '规则' in rt:
        return 'desc'
    # 待定 / 待确认：按题干猜测
    t = str(question)
    if re.search(r'照片|图片|截图|上传|素材|合照', t):
        return 'file'
    if re.search(r'介绍|描述|说说|讲一下|为什么|如何|经历', t):
        return 'long_text'
    if re.search(r'（cm）|（kg）|年纪|年龄|身高|体重|次数|几个|多久', t):
        return 'number'
    return 'single'


questions = []
seq = 0

for _, row in df.iterrows():
    qid = str(row['题目ID']).strip()
    text = str(row['调查问题']).strip()
    if not text:
        continue
    # 归档占位题跳过（素材中被索引化处理的原始内容）
    if text.startswith('成人亲密/兴趣相关调查项'):
        continue

    seq += 1
    cond = rule_for(text, row['一级分类'])
    parent = str(row['父题']).strip()

    questions.append({
        'no': seq,
        'id': qid,
        'text': text,
        'type': qtype_of(row['题型'], text),
        'cat1': str(row['一级分类']).strip(),
        'cat2': str(row['二级分类']).strip(),
        'layer': str(row['扩展层级']).strip(),
        'recordType': str(row['记录类型']).strip(),
        'source': str(row['来源']).strip(),
        'parent': parent,
        'safety': str(row['安全处理']).strip(),
        'showIf': cond,
    })

# ────────────────────────────────────────────────────────────
# 三、统计
# ────────────────────────────────────────────────────────────
def count(pred):
    return sum(1 for q in questions if pred(q))

stats = {
    'total': len(questions),
    'byLayer': {},
    'byType': {},
    'visibility': {
        'universal': count(lambda q: not q['showIf'] or 'note' in q['showIf']),
        'genderOnly': count(lambda q: 'gender' in q['showIf']),
        'positionOnly': count(lambda q: 'position' in q['showIf']),
    },
    'conditional': {
        'withParent': count(lambda q: q['parent']),
        'parentAnchors': len({q['parent'] for q in questions if q['parent']}),
    },
}
for q in questions:
    stats['byLayer'][q['layer']] = stats['byLayer'].get(q['layer'], 0) + 1
    stats['byType'][q['type']] = stats['byType'].get(q['type'], 0) + 1

# 兴趣块（父题锚点 → 子题数）
interest_blocks = []
for p in sorted({q['parent'] for q in questions if q['parent']}):
    interest_blocks.append({
        'anchor': p,
        'count': sum(1 for q in questions if q['parent'] == p),
        'kind': 'interest' if p.startswith('您喜欢') else 'category',
        'isGate': p.startswith('您喜欢'),
    })
interest_blocks.sort(key=lambda x: -x['count'])

# 上位者缺口：S 侧专属字段过少
s_only = [q for q in questions if q['showIf'].get('position') == 'top']
m_only = [q for q in questions if q['showIf'].get('position') == 'bottom']

spec = {
    '_meta': {
        'generatedAt': datetime.now().isoformat(timespec='seconds'),
        'source': '超级题库_完整CSV_V1.csv + 问卷调查题库_重新梳理版.xlsx',
        'purpose': '四身份统一问卷规范，供 Fillout 建表与前端渲染共用',
        'identities': ['male_S', 'female_S', 'male_M', 'female_M'],
        'identityLabels': ['男S', '女S', '男M', '女M'],
    },
    'gate': IDENTITY_GATE,
    'sectionOrder': [
        {'id': 'gate', 'title': '身份与取向', 'note': '四身份共用入口，决定后续显隐'},
        {'id': 'basic', 'title': '基础信息', 'note': '四身份通用'},
        {'id': 'body', 'title': '身体信息', 'note': '按性别显示对应字段'},
        {'id': 'relation', 'title': '关系与状态', 'note': '四身份通用'},
        {'id': 'experience', 'title': '经历与偏好', 'note': '按上下位显示对应字段'},
        {'id': 'interest', 'title': '兴趣体系', 'note': '按「您喜欢X吗」逐块显隐'},
        {'id': 'dimension', 'title': '玩法维度评估', 'note': '26 大类 × 15 维度'},
        {'id': 'safety', 'title': '安全与边界', 'note': '四身份通用，必填'},
    ],
    'questions': questions,
    'interestBlocks': interest_blocks,
    'stats': stats,
    'gaps': {
        'topSideMissing': {
            'found': len(s_only),
            'fields': [q['text'] for q in s_only],
            'note': '上位者专属字段严重不足，S 侧问卷需新建',
        },
        'bottomSideFields': len(m_only),
    },
}

os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(spec, f, ensure_ascii=False, indent=1)

# ────────────────────────────────────────────────────────────
# 四、控制台报告
# ────────────────────────────────────────────────────────────
print('=' * 78)
print('题库规范已生成')
print('=' * 78)
print(f'  输出: {os.path.relpath(OUT, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))}')
print(f'  题目总数: {stats["total"]}')
print(f'  按层级  : {stats["byLayer"]}')
print(f'  按题型  : {stats["byType"]}')
print()
print('  显隐分布：')
print(f'    四身份通用      : {stats["visibility"]["universal"]}')
print(f'    按性别显示      : {stats["visibility"]["genderOnly"]}')
print(f'    按上下位显示    : {stats["visibility"]["positionOnly"]}')
print()
print('  条件跳题：')
print(f'    带父题的记录    : {stats["conditional"]["withParent"]}')
print(f'    父题锚点        : {stats["conditional"]["parentAnchors"]}')
print()
print(f'  兴趣块数量: {len(interest_blocks)}（其中「您喜欢X吗」门题 {sum(1 for b in interest_blocks if b["isGate"])} 个）')
print()
print('  上位者缺口：')
print(f'    S 侧专属字段仅 {len(s_only)} 条：')
for q in s_only:
    print(f'      · {q["text"][:56]}')
print(f'    M 侧专属字段 {len(m_only)} 条')
