// 职责    按内容类型分发的渲染器实现。
// 归属页面 内容详情页
// 依赖    content-types.js
// 被依赖   render.js
//
// 维护提示
//   · 新增内容类型时在此加一个渲染分支。
import { getPostType, getRisk, RISK_COLLAPSED } from './content-types.js';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const chip = (t) => `<span class="chip">${esc(t)}</span>`;
const row = (k, v) => (v ? `<div class="pv-row"><span class="pv-k">${esc(k)}</span><span class="pv-v">${v}</span></div>` : '');
const sec = (t, body) => (body ? `<div class="pv-sec"><div class="pv-sec-t">${esc(t)}</div>${body}</div>` : '');
const listOf = (arr, fn) => (Array.isArray(arr) && arr.length
  ? `<ul>${arr.map((x, i) => `<li><b>${i + 1}.</b> ${fn(x, i)}</li>`).join('')}</ul>`
  : '');

// ────────────────────────────────────────────── 各类型的预览
const previewers = {
  // ⛓️ 玩法任务
  task(meta, d) {
    const parts = [];
    // 场景准备
    const setup = [
      row('适用场景', (d.scenes || []).map(esc).join('、')),
      row('建议时间', (d.times || []).map(esc).join('、')),
      row('预计时长', d.durationValue ? `${esc(d.durationValue)} ${esc(d.durationUnit || '分钟')}` : ''),
      row('环境要求', esc(d.env || '')),
      row('前置状态', esc(d.pre || '')),
      row('心理准备', esc(d.mental || '')),
    ].join('');
    parts.push(sec('场景准备', setup));

    // 道具清单
    parts.push(sec('道具清单', listOf(d.props, (p) => {
      const meta2 = [];
      if (p.required) meta2.push(esc(p.required));
      if (p.alt) meta2.push(`替代：${esc(p.alt)}`);
      if (p.safety) meta2.push(`⚠️ ${esc(p.safety)}`);
      return `${esc(p.name || '（未命名）')}${meta2.length ? ` <span class="dim">${meta2.join(' · ')}</span>` : ''}`;
    })));

    // 具体事项
    parts.push(sec('具体事项', listOf(d.steps, (s) => {
      const bits = [];
      if (s.measure) bits.push(esc(s.measure));
      let out = esc(s.text || '（未填）');
      if (bits.length) out += ` <span class="dim">${bits.join(' · ')}</span>`;
      if (s.caution) out += `<br><span class="pv-warn">⚠️ ${esc(s.caution)}</span>`;
      if (s.abort) out += `<br><span class="pv-abort">⛔ 中止：${esc(s.abort)}</span>`;
      return out;
    })));

    // 检查点
    parts.push(sec('检查点', listOf(d.checkpoints, (c) => {
      const bits = [];
      if (Array.isArray(c.proof) && c.proof.length) bits.push(c.proof.map(esc).join('/'));
      if (c.count) bits.push(`× ${esc(c.count)}`);
      if (c.required) bits.push('必交');
      return `${esc(c.text || '（未填）')}${bits.length ? ` <span class="dim">${bits.join(' · ')}</span>` : ''}`;
    })));

    // 后护理
    parts.push(sec('收尾与后护理', [
      row('收尾步骤', esc(d.cleanup || '')),
      row('身体护理', esc(d.body || '')),
      row('情绪护理', esc(d.emotion || '')),
      row('观察期', esc(d.observe || '')),
    ].join('')));

    return parts.join('');
  },

  // 🗂️ 主题合集
  collection(meta, d) {
    const parts = [];
    parts.push(sec('合集说明', d.intro ? `<div class="pv-row"><span class="pv-v">${esc(d.intro)}</span></div>` : ''));
    const groups = Array.isArray(d.groups) ? d.groups : [];
    parts.push(sec('分组与条目', groups.map((g, i) => {
      const items = Array.isArray(g.items) ? g.items : [];
      const inner = items.length
        ? `<ul>${items.map((it, j) => `<li><b>${j + 1}.</b> ${esc(it.text || '（未填）')}${it.safety ? ` <span class="pv-warn">⚠️ ${esc(it.safety)}</span>` : ''}</li>`).join('')}</ul>`
        : '<div class="dim">（本组还没有条目）</div>';
      return `<div class="pv-group"><div class="pv-group-t">${i + 1}. ${esc(g.name || '未命名分组')} <span class="dim">${items.length} 条</span></div>${inner}</div>`;
    }).join('')));
    parts.push(sec('安全总则', d.safetyRule ? `<div class="pv-warn-box">⚠️ ${esc(d.safetyRule)}</div>` : ''));
    return parts.join('');
  },

  // 📊 分级清单
  checklist(meta, d) {
    const parts = [];
    const isQuiz = d.mode === 'quiz';
    const SCALE_LABEL = {
      sss: 'SSS 非常喜欢 / SS 喜欢 / S 能接受 / N 无感 / × 不接受',
      num11: '-1 厌恶 → 0 无感 → 1-10 喜欢程度',
      star5: '★ 1 ~ 5 星',
    };
    parts.push(sec('清单模式', [
      row('模式', isQuiz ? '问答清单' : '程度量表'),
      !isQuiz ? row('量表类型', esc(SCALE_LABEL[d.scaleType] || d.scaleType || '')) : '',
      !isQuiz && d.allowUnsure ? row('不确定项', '包含「?」选项') : '',
    ].join('')));

    if (isQuiz) {
      const qs = Array.isArray(d.questions) ? d.questions : [];
      const byGroup = {};
      qs.forEach((q, i) => {
        const g = (q.group || '未分组').trim();
        (byGroup[g] = byGroup[g] || []).push({ q, i });
      });
      parts.push(sec('问答清单', Object.entries(byGroup).map(([g, arr]) =>
        `<div class="pv-group"><div class="pv-group-t">${esc(g)} <span class="dim">${arr.length} 题</span></div>
         <ul>${arr.map(({ q, i }) => `<li><b>${i + 1}.</b> ${esc(q.q || '（未填）')} <span class="dim">${esc(q.qtype || '')}${q.required ? ' · 必答' : ''}</span></li>`).join('')}</ul></div>`
      ).join('')));
    } else {
      const items = Array.isArray(d.items) ? d.items : [];
      const byCat = {};
      items.forEach((it, i) => {
        const c = (it.category || '未分类').trim();
        (byCat[c] = byCat[c] || []).push({ it, i });
      });
      parts.push(sec('量表条目', Object.entries(byCat).map(([c, arr]) =>
        `<div class="pv-group"><div class="pv-group-t">${esc(c)} <span class="dim">${arr.length} 项</span></div>
         <ul>${arr.map(({ it, i }) => `<li><b>${i + 1}.</b> ${esc(it.name || '（未填）')} <span class="dim">${[it.sub, it.note].filter(Boolean).map(esc).join(' · ')}</span></li>`).join('')}</ul></div>`
      ).join('')));
    }
    parts.push(sec('使用说明', d.usage ? `<div class="pv-row"><span class="pv-v">${esc(d.usage)}</span></div>` : ''));
    return parts.join('');
  },

  // ✍️ 任务反馈
  note(meta, d) {
    const body = String(d.body || '');
    if (!body.trim()) return sec('正文', '<div class="dim">（还没有内容）</div>');
    const html = esc(body)
      .replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
      .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n/g, '<br>');
    return sec('正文', `<div class="pv-md">${html}</div>`);
  },
};

/**
 * 生成编辑器实时预览的主体（不含标题与元信息）
 */
export function renderTypePreview(typeId, meta, data) {
  const fn = previewers[typeId] || previewers.note;
  return fn(meta || {}, data || {});
}

// ────────────────────────────────────────────── 卡片元信息
export function renderCardFacts(post) {
  const d = post.data || {};
  const out = [];
  if (post.type === 'task') {
    const dur = d.durationValue ? `${d.durationValue} ${d.durationUnit || '分钟'}` : '';
    if (dur) out.push(`⏱ ${esc(dur)}`);
    if (Array.isArray(d.props) && d.props.length) out.push(`🧰 ${d.props.length} 件道具`);
    if (Array.isArray(d.steps) && d.steps.length) out.push(`📋 ${d.steps.length} 步`);
    if (Array.isArray(d.scenes) && d.scenes.length) out.push(`📍 ${esc(d.scenes[0])}`);
  } else if (post.type === 'collection') {
    const g = Array.isArray(d.groups) ? d.groups : [];
    const n = g.reduce((a, x) => a + (Array.isArray(x.items) ? x.items.length : 0), 0);
    if (g.length) out.push(`🗂 ${g.length} 组`);
    if (n) out.push(`📄 ${n} 条`);
  } else if (post.type === 'checklist') {
    out.push(`📊 ${d.mode === 'quiz' ? '问答清单' : '程度量表'}`);
    const n = d.mode === 'quiz' ? (d.questions?.length || 0) : (d.items?.length || 0);
    if (n) out.push(`${n} 项`);
  } else {
    const len = String(d.body || '').length;
    if (len) out.push(`✍️ ${len} 字`);
  }
  return out;
}

/** 卡片徽章行 */
export function renderBadges(post) {
  const t = getPostType(post.type);
  const r = getRisk(post.risk);
  const collapsed = RISK_COLLAPSED.includes(post.risk);
  return [
    `<span class="c-type" style="--ac:${t.accent}">${t.icon} ${esc(t.label)}</span>`,
    `<span class="c-risk" style="--rc:${r.color}">${r.icon} ${esc(r.label)}</span>`,
    post.visibility !== 'public' ? `<span class="c-vis">${post.visibility === 'private' ? '🔒 仅自己' : '🔐 登录可见'}</span>` : '',
    collapsed ? '<span class="c-vis">需确认展开</span>' : '',
  ].join('');
}

/** 「我的」页用的紧凑列表行 */
export function renderListRow(post, hrefBase = '/modules/content/post.html?slug=') {
  return `<a class="list-row" href="${hrefBase}${encodeURIComponent(post.slug)}" style="text-decoration:none;color:inherit">
    <div class="thumb">${post.typeInfo ? post.typeInfo.icon : '📄'}</div>
    <div class="body">
      <div class="t">${esc(post.title)}</div>
      <div class="m">${esc(post.typeInfo ? post.typeInfo.label : post.type)} ｜ ${post.riskInfo ? post.riskInfo.icon + ' ' + esc(post.riskInfo.label) : ''} ｜ ${new Date(post.createdAt || Date.now()).toLocaleDateString('zh-CN')}</div>
    </div>
    <div style="color:rgba(255,255,255,0.2);font-size:12px">→</div>
  </a>`;
}

export { chip, row, sec, listOf };
