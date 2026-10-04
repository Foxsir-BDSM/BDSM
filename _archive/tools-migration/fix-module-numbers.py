#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/fix-module-numbers.py
统一 12 个模块的编号与常量名：
  一 身份门              M1
  二 基础信息            M2
  三 身体信息            M3
  四 个人形象与状态       M4
  五 上位者专项           M5
  六 性经历与偏好         M6
  七 露出与影像           M7
  八 兴趣体系            M8
  九 兴趣体系·具体玩法条目  M9
  十 安全与边界           M10
  十一 对上位者的确认      M11
  十二 隐私与公开         M12
  十三 问卷体验           M13
"""
import io, os, re, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILE = os.path.join(ROOT, 'tools', 'gen-questionnaire-table.py')
s = io.open(FILE, encoding='utf-8').read()

# ── 1. 常量声明改为目标形态
DECLS = {
    'M1': "M1 = '一、身份门'",
    'M2': "M2 = '二、基础信息'",
    'M3': "M3 = '三、身体信息'",
    'M4': "M4 = '四、个人形象与状态'",
    'M5': "M5 = '五、上位者专项'",
    'M6': "M6 = '六、性经历与偏好'",
    'M7': "M7 = '七、露出与影像'",
    'M8': "M8 = '八、兴趣体系'",
    'M9': "M9 = '九、兴趣体系 · 具体玩法条目'",
    'M10': "M10 = '十、安全与边界'",
    'M11': "M11 = '十一、对上位者的确认'",
    'M12': "M12 = '十二、隐私与公开'",
    'M13': "M13 = '十三、问卷体验'",
}

# 先删掉所有旧声明行（含新增的 MS / MM / M7B）
s = re.sub(r"^(?:M\d+B?|MS|MM) = '[^']*'\n", '', s, flags=re.M)
s = s.replace("# 「上位者专项」的题目写在下方 M4 段落之后，此处仅声明模块名\n", '')

# ── 2. 调用点改名（用占位符两阶段替换，避免连锁覆盖）
#  现有调用：M1 M2 M3 M4 MS M5 M6 M7 M7B M8 M10 M12 MM
CALL_MAP = {
    'MS': 'M5',      # 上位者专项
    'M5': 'M6',      # 性经历与偏好
    'M6': 'M7',      # 露出与影像
    'M7B': 'M9',     # 具体玩法条目（先于 M7 处理）
    'M7': 'M8',      # 兴趣体系
    'M8': 'M10',     # 安全与边界
    'MM': 'M11',     # 对上位者的确认
    'M10': 'M12',    # 隐私与公开
    'M12': 'M13',    # 问卷体验
}
# 两阶段：先全部替换成 @TOKEN@
for old, new in CALL_MAP.items():
    s = re.sub(r'\badd\(' + re.escape(old) + r', ', f'add(@{new}@, ', s)
s = re.sub(r'add\(@(M\d+)@, ', r'add(\1, ', s)

# ── 3. 把声明插到第一次使用之前（文件顶部常量区）
ANCHOR = "rows = []"
decl_block = '\n'.join(DECLS[k] for k in
                       ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7',
                        'M8', 'M9', 'M10', 'M11', 'M12', 'M13']) + '\n'
s = s.replace(ANCHOR, decl_block + '\n' + ANCHOR, 1)

io.open(FILE, 'w', encoding='utf-8').write(s)

print('✅ 模块编号已统一')
print()
for k in sorted(DECLS, key=lambda x: int(x[1:])):
    print(f'  {DECLS[k]}')
print()
# 校验调用点
calls = sorted(set(re.findall(r'add\((M\d+),', s)), key=lambda x: int(x[1:]))
print('  调用点使用的模块:', ' '.join(calls))
missing = [k for k in DECLS if k not in calls]
print('  未使用的模块常量:', ' '.join(missing) if missing else '无')
