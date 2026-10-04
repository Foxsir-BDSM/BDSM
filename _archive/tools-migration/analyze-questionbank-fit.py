#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/analyze-questionbank-fit.py —— 四身份适用性缺口分析（只读）
判断现有 254 条 L0 原始字段中，哪些只因身份/性别而异，为重构提供依据
"""
import sys, io, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

CSV = r'E:\新建文件夹\超级题库_完整CSV_V1.csv'
df = pd.read_csv(CSV, encoding='utf-8-sig', dtype=str).fillna('')

l0 = df[df['记录类型'] == '原始题库映射'].copy()


def sep(t):
    print('\n' + '=' * 78)
    print(t)
    print('=' * 78)


# ─────────────────────────── 关键词判定
FEMALE_ONLY = r'罩杯|三围|乳|穴|扩阴|阴|经期|怀孕|哺乳|女'
MALE_ONLY = r'龟头|鸡巴|阳|睾丸|蛋|包皮|射精|精|男'
M_ONLY = r'开发进度|百人斩|被.*操|被.*玩|下贱|淫荡|有多骚|被几个|舔|承受|耐'
S_ONLY = r'调教|带过|掌控|支配|主导|支配者|主奴|训练过|经验.*主|擅长'

def classify(text):
    t = str(text)
    tags = []
    if re.search(FEMALE_ONLY, t):
        tags.append('F')
    if re.search(MALE_ONLY, t):
        tags.append('M性别')
    if re.search(M_ONLY, t):
        tags.append('M位')
    if re.search(S_ONLY, t):
        tags.append('S位')
    return ','.join(tags) if tags else '通用'


l0['适用性'] = l0['调查问题'].apply(classify)

sep('一、254 条 L0 字段的四身份适用性判定')
print(l0['适用性'].value_counts().to_string())

sep('二、仅女性相关（罩杯/三围/乳穴 等）—— 4 身份中共 2 个需要显示')
fem = l0[l0['适用性'].str.contains('F')]
print(f'  {len(fem)} 条：')
print(fem[['题目ID', '一级分类', '调查问题']].to_string(index=False))

sep('三、仅男性相关（龟头/阳 等）—— 另外 2 个身份需要显示')
mal = l0[l0['适用性'].str.contains('M性别')]
print(f'  {len(mal)} 条：')
print(mal[['题目ID', '一级分类', '调查问题']].to_string(index=False))

sep('四、仅下位者相关（开发进度/百人斩 等）—— S 侧不应出现')
monly = l0[l0['适用性'].str.contains('M位')]
print(f'  {len(monly)} 条：')
print(monly[['题目ID', '一级分类', '调查问题']].to_string(index=False))

sep('五、仅上位者相关 —— 需新增字段（现有题库几乎为空）')
sonly = l0[l0['适用性'].str.contains('S位')]
print(f'  {len(sonly)} 条：')
if len(sonly):
    print(sonly[['题目ID', '一级分类', '调查问题']].to_string(index=False))
else:
    print('  （无）→ 现有 254 条里几乎没有上位者专属字段，S 侧需要新建')

sep('六、通用字段（四身份都应显示）— 数量与样例')
common = l0[l0['适用性'] == '通用']
print(f'  {len(common)} 条，样例：')
print(common[['题目ID', '一级分类', '二级分类', '调查问题']].head(40).to_string(index=False))

# ─────────────────────────── L0 分类覆盖
sep('七、L0 的一级分类分布')
print(l0['一级分类'].value_counts().to_string())

# ─────────────────────────── 条件跳题结构（父题）
sep('八、条件跳题结构（父题 → 子题）')
parents = df[(df['父题'].astype(str).str.strip() != '') & (df['记录类型'] == '原始题库映射')]
uniq_parents = sorted(set(df[df['父题'].astype(str).str.strip() != '']['父题']))
print(f'  全部层级中有父题的记录: {len(df[df["父题"].astype(str).str.strip() != ""])}')
print(f'  不同父题（跳转锚点）数量: {len(uniq_parents)}')
print('  父题清单（前 40）：')
for p in uniq_parents[:40]:
    n = len(df[df['父题'] == p])
    print(f'    · {p[:56]}   →  {n} 个子题')

# ─────────────────────────── L2 超级扩展题结构（26 大类 × 15 维度）
sep('九、L2 超级扩展题结构（26 大类 × 15 维度）')
l2 = df[df['扩展层级'] == 'L2']
cats = l2['一级分类'].str.replace('F 兴趣体系 / ', '', regex=False)
dims = l2['二级分类']
print(f'  记录数: {len(l2)}')
print(f'  一级分类（玩法大类）: {cats.nunique()} 个')
print(f'  二级分类（评估维度）: {dims.nunique()} 个')
print('  维度清单:')
for d in sorted(dims.unique()):
    print(f'    · {d}')
print('  样例（同一大类下的维度展开）:')
sample = l2[l2['一级分类'].str.contains('01 束缚', na=False)]
print(sample[['题目ID', '二级分类', '调查问题']].head(15).to_string(index=False))

sep('十、结论摘要')
print(f'  L0 原始字段         : {len(l0)} 条（其中通用 {len(common)}，需按身份/性别分流 {len(l0)-len(common)}）')
print(f'  L1 标准题库         : {len(df[df["扩展层级"]=="L1"])} 条')
print(f'  L2 超级扩展题       : {len(l2)} 条（{cats.nunique()} 玩法大类 × {dims.nunique()} 维度）')
print(f'  L3 交叉扩展题       : {len(df[df["扩展层级"]=="L3"])} 条')
print(f'  L4 元数据题         : {len(df[df["扩展层级"]=="L4"])} 条')
print(f'  上位者专属字段      : {len(sonly)} 条 ← S 侧缺口')
