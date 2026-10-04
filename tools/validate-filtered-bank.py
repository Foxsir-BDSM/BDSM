#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读：校验筛选后题库的依赖完整性与结构问题"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

df = pd.read_csv(r'E:\超级问卷题库.csv', encoding='utf-8-sig', dtype=str).fillna('')
q = df[df['题目ID'].str.strip() != ''].copy()
ids = set(q['题目ID'])

print('=' * 78)
print('一、依赖完整性（显示条件里引用的题号是否还存在）')
print('=' * 78)
broken = []
for _, r in q.iterrows():
    cond = r['显示条件（Fillout 逻辑）']
    refs = re.findall(r'Q-[A-Z0-9\-]+', cond)
    for ref in refs:
        if ref not in ids:
            broken.append((r['题目ID'], r['题目'], ref))
if broken:
    for qid, text, ref in broken:
        print(f'  ✗ {qid:<16} {text}')
        print(f'      依赖 {ref} —— 该题已被删除，此条件永远无法成立')
else:
    print('  ✅ 无断链依赖')

print()
print('=' * 78)
print('二、「依赖题目」列引用的题号是否还存在')
print('=' * 78)
broken2 = []
for _, r in q.iterrows():
    dep = str(r['依赖题目']).strip()
    if not dep:
        continue
    for ref in re.findall(r'Q-[A-Z0-9\-]+', dep):
        if ref not in ids:
            broken2.append((r['题目ID'], r['题目'], ref))
if broken2:
    for qid, text, ref in broken2:
        print(f'  ✗ {qid:<16} {text}  →  依赖 {ref}（已删除）')
else:
    print('  ✅ 无断链')

print()
print('=' * 78)
print('三、必定不显示的题（条件永假）')
print('=' * 78)
dead = set()
for qid, _, ref in broken + broken2:
    dead.add(qid)
for qid in sorted(dead):
    row = q[q['题目ID'] == qid].iloc[0]
    print(f'  ⚠ {qid:<16} {row["题目"]}')
if not dead:
    print('  无')

print()
print('=' * 78)
print('四、题干需要「随身份切换」的题（Fillout 单题无法自动改题干）')
print('=' * 78)
for _, r in q.iterrows():
    note = str(r['备注'])
    if '随身份' in note or '题干随' in note or '是否有奴' in str(r['题目']):
        print(f'  ⚠ {r["题目ID"]:<16} {r["题目"]}')
        print(f'      备注: {note[:80]}')
        print(f'      建议: 拆成 S/M 两题，或用条件显示两道不同题干的题')

print()
print('=' * 78)
print('五、题号连续性（原编号有跳号，来自被删题目）')
print('=' * 78)
for prefix in ['Q-B', 'Q-BD', 'Q-P', 'Q-REL', 'Q-EXP', 'Q-E', 'Q-EX', 'Q-CAP', 'Q-SAF',
               'Q-S', 'Q-PV', 'Q-F', 'Q-SM', 'Q-RELN', 'Q-COM', 'Q-PRV', 'Q-LIV']:
    nums = []
    for qid in ids:
        if qid.startswith(prefix) and qid != prefix:
            m = re.match(re.escape(prefix) + r'(\d+)$', qid)
            if m:
                nums.append(int(m.group(1)))
    if not nums:
        continue
    nums = sorted(nums)
    missing = [n for n in range(min(nums), max(nums) + 1) if n not in nums]
    if missing:
        print(f'  {prefix:<8} 有 {len(nums)} 题，缺号: {missing}')

print()
print('=' * 78)
print('六、语句重复或重叠的题（可能与「合并同类项」思路冲突）')
print('=' * 78)
seen = {}
for _, r in q.iterrows():
    t = str(r['题目']).strip()
    key = re.sub(r'[（(].*?[)）]', '', t).strip()
    seen.setdefault(key, []).append(r['题目ID'])
for k, v in seen.items():
    if len(v) > 1:
        print(f'  ⚠ 「{k}」出现 {len(v)} 次: {", ".join(v)}')

# 语义重叠的已知组
OVERLAP_HINTS = [
    ('身体敏感度', ['Q-BD06', 'Q-BD07', 'Q-BD08']),
    ('自慰话题', ['Q-E01', 'Q-E15', 'Q-E16', 'Q-E17', 'Q-E18']),
    ('难忘经历', ['Q-E11', 'Q-E12']),
    ('圈层经历重复', ['Q-EXP01', 'Q-EXP02', 'Q-EXP05', 'Q-EXP06']),
    ('调教时间/频率', ['Q-EXP03', 'Q-EXP04']),
]
for name, group in OVERLAP_HINTS:
    present = [g for g in group if g in ids]
    if len(present) > 1:
        titles = [q[q['题目ID'] == g].iloc[0]['题目'] for g in present]
        print(f'  ▸ {name}: {" | ".join(titles)}')

print()
print('=' * 78)
print('七、段落结构统计（供制定表单分节）')
print('=' * 78)
print(f'  模块数: {q["模块"].nunique()}')
print(f'  分组数: {q.groupby(["模块","分组"]).ngroups}')
print(f'  题目数: {len(q)}')
print()
print(f'  {"模块":<26}{"题数":>5}{"分组数":>7}')
for m, g in q.groupby('模块', sort=False):
    print(f'  {m:<26}{len(g):>5}{g["分组"].nunique():>7}')
