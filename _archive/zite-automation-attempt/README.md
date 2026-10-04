# Zite 自动化尝试（已终止）

2026-10-03 尝试用 CDP 驱动 Edge 自动录入 Zite 表单，结论：**不可行**，已放弃，改为手动录入。

## 失败原因

1. **Zite 无 `data-testid`**，只能用可见文本 + SVG path 定位元素，脆弱
2. **合成鼠标事件会被坐标错配**：画布滚动后固定坐标失效，
   我的"删除"点击反复落到左侧「Short answer」面板按钮上，**越删越多**
3. **删除按钮无法可靠触发**：`el.click()` 无反应；
   真实鼠标事件（mousedown/up）又会被编辑器当成"添加字段"
4. 唯一稳定可行的操作是 **`el.click()` 点击左侧字段类型按钮 = 添加字段**

## 已确认的可用事实（供日后参考）

- 添加字段：单击左侧字段类型面板按钮即可，**无需拖拽**
- 字段属性面板：右侧（Label / Caption / Placeholder / Default value / Required / Half width / Logic / Validation）
- 条件逻辑：属性面板 Logic 折叠区 + 底部 Logic 按钮
- 章节：底部 + Add page；标题可用 Heading / Paragraph / Divider / Section collapse
- 画布字段计数：`.fillout-field-container` 是**画布本身**而非字段；
  正确公式 = 画布内 `input/textarea/select` 数量 ÷ 2

## 教训

发现"操作后数量未减少"时就该立即停止，而不是继续循环 12 轮。
