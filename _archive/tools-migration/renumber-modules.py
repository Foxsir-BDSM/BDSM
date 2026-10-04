#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/renumber-modules.py
把生成器里的模块重新编排：
  · S 侧题目（Q-EXP05~10 / Q-CAP / Q-SAF / Q-RELN / Q-COM / Q-PRV / Q-LIV）
    从「四、个人形象与状态」抽出 → 新模块「五、上位者专项」
  · 原「八、安全与边界」里的 M 侧镜像题（Q-SM*）→ 抽出到「九、对上位者的确认」
  · 其余模块顺次重新编号（共 12 个模块）
"""
import io, os, re, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILE = os.path.join(ROOT, 'tools', 'gen-questionnaire-table.py')
src = io.open(FILE, encoding='utf-8').read()

# ── 1. S 侧题目的 key 前缀集合
S_PREFIX = ('Q-EXP05', 'Q-EXP06', 'Q-EXP07', 'Q-EXP08', 'Q-EXP09', 'Q-EXP10',
            'Q-CAP', 'Q-SAF', 'Q-RELN', 'Q-COM', 'Q-PRV', 'Q-LIV')

lines = src.split('\n')
out = []
in_s_block = False
declared_ms = False

for ln in lines:
    # ── 插入新模块常量声明（在 M5 定义之前）
    if ln.startswith("M5 = '五、性经历与偏好'"):
        out.append("MS = '五、上位者专项'")
        out.append("")
        out.append("# 「上位者专项」的题目写在下方 M4 段落之后，此处仅声明模块名")
        out.append("")
        declared_ms = True

    # ── 判断当前行是否属于 S 侧题目/分组
    is_s_question = any(('' + p) in ln for p in S_PREFIX)
    is_s_group = re.search(r"add\(M4, '(圈层经历|能力与风格|安全习惯|关系形态|沟通方式|隐私与影像|现实条件)'", ln)

    # S 侧补充层起始/结束标记
    if 'S 侧补充层 A' in ln:
        in_s_block = True
    if ln.strip().startswith('# ═══') and in_s_block:
        # 向下看是否已脱离 S 块（遇到 M5 段落的注释）
        pass

    if is_s_question or is_s_group:
        # 把 M4 换成 MS（仅对 S 侧专属题目）
        # 注意：Q-EXP01~04 与 Q-REL01~05 属于 M4 通用/圈层，需排除
        new = ln
        if is_s_question:
            new = new.replace('add(M4, ', 'add(MS, ', 1)
        elif is_s_group:
            # 圈层经历分组里混有 Q-EXP01~04（通用）；只搬 Q-EXP05 起的行
            new = ln  # 保持不动，逐行判断由 is_s_question 处理
        out.append(new)
    else:
        out.append(ln)

src2 = '\n'.join(out)

# ── 2. 模块重命名（倒序替换，避免编号冲突）
RENAMES = [
    ("M10 = '十、问卷体验'", "M12 = '十二、问卷体验'"),
    ("M9 = '九、隐私与公开'", "M10 = '十、隐私与公开'"),
    ("M8 = '八、安全与边界'", "M8 = '八、安全与边界'"),
    ("M7B = '七、兴趣体系 · 具体玩法条目'", "M7B = '七、兴趣体系 · 具体玩法条目'"),
    ("M6 = '六、露出与影像'", "M6 = '六、露出与影像'"),
    ("M5 = '五、性经历与偏好'", "MM = '九、对上位者的确认'\nM5 = '五、性经历与偏好'"),
]
for old, new in RENAMES:
    if old in src2:
        src2 = src2.replace(old, new, 1)

# ── 3. add(M10, ...) / add(M9, ...) 调用同步改名
src2 = src2.replace('add(M10, ', 'add(M12, ')
src2 = src2.replace('add(M9, ', 'add(M10, ')

# ── 4. Q-SM* 系列从 M8 搬到 MM
src2 = re.sub(r"add\(M8, '对上位者的确认'", "add(MM, '对上位者的确认'", src2)

io.open(FILE, 'w', encoding='utf-8').write(src2)

print('✅ 模块重排完成')
print('  新增模块常量: MS（五、上位者专项） / MM（九、对上位者的确认）')
print('  S 侧题目已从 M4 迁至 MS')
print('  Q-SM* 已从 M8 迁至 MM')
print()
for m in re.finditer(r"^(M\d+B?|MS|MM) = '([^']+)'", src2, re.M):
    print(f'  {m.group(1):<5} {m.group(2)}')
