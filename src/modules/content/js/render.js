// 职责    内容渲染入口与数据获取。
// 归属页面 内容列表、内容详情、我的页
// 依赖    renderers.js、content-types.js
// 被依赖   被 3 个页面共用
//
// 维护提示
//   · 改动输出结构要三处同查。
import {
  getPostType, getRisk, RISK_COLLAPSED,
  JSON_FENCE_RE, parsePayload,
} from './content-types.js';

export { parsePayload };

// ────────────────────────────────────────────── 工具
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN');
}

/**
 * 把一份文件（frontmatter 解析结果 + 原始正文）还原成统一的对象
 * @returns {{slug,type,meta,data,markdown,author,createdAt,riskInfo,typeInfo} | null}
 */
export function normalizePost(fileName, rawText, parsed) {
  const payload = parsePayload(rawText);
  if (!payload) return null;

  const type = payload.type || 'note';
  const meta = payload.meta || {};
  const data = payload.data || {};

  // 去掉 JSON 区块，剩下的是 markdown 正文
  const markdown = String(rawText || '').replace(JSON_FENCE_RE, '').trim();

  return {
    slug: meta.slug || parsed?.slug || fileName.replace(/\.md$/, ''),
    type,
    typeInfo: getPostType(type),
    risk: meta.risk || 'low',
    riskInfo: getRisk(meta.risk || 'low'),
    visibility: meta.visibility || 'public',
    meta,
    data,
    markdown,
    summary: meta.summary || parsed?.summary || '',
    cover: meta.cover || parsed?.cover_url || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    title: meta.title || parsed?.title || fileName.replace(/\.md$/, ''),
    author: meta.authorNickname || parsed?.author_nickname || '匿名',
    createdAt: meta.createdAt || parsed?.created_at || '',
  };
}

// ────────────────────────────────────────────── 列表卡片
export function renderCard(post) {
  const t = post.typeInfo;
  const r = post.riskInfo;
  const collapsed = RISK_COLLAPSED.includes(post.risk);

  const coverHtml = post.cover
    ? `<div class="c-cover" style="background-image:url('${esc(post.cover)}')"></div>`
    : `<div class="c-cover c-cover-empty" style="--ac:${t.accent}">${t.icon}</div>`;

  // 按类型给出差异化元信息
  let facts = [];
  if (post.type === 'task') {
    const d = post.data || {};
    const dur = d.durationValue ? `${d.durationValue} ${d.durationUnit || '分钟'}` : '';
    const props = Array.isArray(d.props) ? d.props.length : 0;
    const steps = Array.isArray(d.steps) ? d.steps.length : 0;
    if (dur) facts.push(`⏱ ${esc(dur)}`);
    if (props) facts.push(`🧰 ${props} 件道具`);
    if (steps) facts.push(`📋 ${steps} 步`);
    if (Array.isArray(d.scenes) && d.scenes.length) facts.push(`📍 ${esc(d.scenes[0])}`);
  } else if (post.type === 'collection') {
    const g = Array.isArray(post.data?.groups) ? post.data.groups : [];
    const n = g.reduce((a, x) => a + (Array.isArray(x.items) ? x.items.length : 0), 0);
    if (g.length) facts.push(`🗂 ${g.length} 组`);
    if (n) facts.push(`📄 ${n} 条`);
  } else if (post.type === 'checklist') {
    const mode = post.data?.mode === 'quiz' ? '问答清单' : '程度量表';
    const n = post.data?.mode === 'quiz'
      ? (post.data?.questions?.length || 0)
      : (post.data?.items?.length || 0);
    facts.push(`📊 ${mode}`);
    if (n) facts.push(`${n} 项`);
  } else {
    const len = String(post.data?.body || '').length;
    if (len) facts.push(`✍️ ${len} 字`);
  }

  return `
  <a class="pcard${collapsed ? ' is-collapsed' : ''}" href="./post.html?slug=${encodeURIComponent(post.slug)}" data-type="${post.type}" data-risk="${post.risk}">
    ${coverHtml}
    <div class="c-body">
      <div class="c-badges">
        <span class="c-type" style="--ac:${t.accent}">${t.icon} ${esc(t.label)}</span>
        <span class="c-risk" style="--rc:${r.color}">${r.icon} ${esc(r.label)}</span>
        ${post.visibility !== 'public' ? `<span class="c-vis">${post.visibility === 'private' ? '🔒 仅自己' : '🔐 登录可见'}</span>` : ''}
      </div>
      <h3 class="c-title">${esc(post.title)}</h3>
      ${post.summary ? `<p class="c-sum">${esc(post.summary)}</p>` : ''}
      ${facts.length ? `<div class="c-facts">${facts.map((f) => `<span>${f}</span>`).join('')}</div>` : ''}
      ${post.tags.length ? `<div class="c-tags">${post.tags.slice(0, 5).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="c-foot">
        <span class="c-author">✍️ ${esc(post.author)}</span>
        <span class="c-date">${fmtDate(post.createdAt)}</span>
      </div>
    </div>
  </a>`;
}

// ────────────────────────────────────────────── 详情渲染
function valueCell(field, value) {
  if (field.type === 'list') {
    const arr = Array.isArray(value) ? value : [];
    if (!arr.length) return '';
    return arr.map((it, i) => {
      const head = it.text || it.name || it.q || '';
      const sub = [];
      if (it.measure) sub.push(`⏱ ${esc(it.measure)}`);
      if (it.required === true) sub.push('必需');
      if (it.required === false) sub.push('可选');
      if (it.category) sub.push(esc(it.category));
      if (it.sub) sub.push(esc(it.sub));
      if (it.qtype) sub.push(esc(it.qtype));
      const caution = it.caution ? `<div class="d-caution">⚠️ ${esc(it.caution)}</div>` : '';
      const abort = it.abort ? `<div class="d-abort">⛔ 中止条件：${esc(it.abort)}</div>` : '';
      const alt = it.alt ? `<div class="d-sub">替代：${esc(it.alt)}</div>` : '';
      const safety = it.safety ? `<div class="d-sub">安全：${esc(it.safety)}</div>` : '';
      const note = it.note ? `<div class="d-sub">${esc(it.note)}</div>` : '';
      const nested = Array.isArray(it.items) && it.items.length
        ? `<ul class="d-nested">${it.items.map((ni, j) => `<li><b>${j + 1}.</b> ${esc(ni.text || '')}${ni.safety ? ` <span class="d-sub-inline">（${esc(ni.safety)}）</span>` : ''}</li>`).join('')}</ul>`
        : '';
      return `<li class="d-li">
        <div class="d-li-head"><span class="d-li-idx">${i + 1}</span><span class="d-li-main">${esc(head)}</span></div>
        ${sub.length ? `<div class="d-li-meta">${sub.join(' · ')}</div>` : ''}
        ${alt}${safety}${note}${caution}${abort}${nested}
      </li>`;
    }).join('');
  }

  if (field.type === 'checkbox') {
    const arr = Array.isArray(value) ? value : [];
    return arr.length ? arr.map((x) => `<span class="chip">${esc(x)}</span>`).join(' ') : '';
  }
  if (field.type === 'switch') return value ? '✅ 是' : '';
  if (field.type === 'radio') {
    const hit = (field.options || []).find((o) => (typeof o === 'string' ? o : o.value) === String(value));
    return hit ? esc(typeof hit === 'string' ? hit : hit.label) : '';
  }
  if (value === '' || value === null || value === undefined) return '';
  if (field.key === 'body') return `<div class="d-markdown">${renderSimpleMarkdown(String(value))}</div>`;
  return esc(String(value)).replace(/\n/g, '<br>');
}

/** 简易 Markdown（与站内现有实现保持一致，仅 4 种语法） */
export function renderSimpleMarkdown(md) {
  return esc(md)
    .replace(/^###\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^/, '<p>').replace(/$/, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[234]>)/g, '$1')
    .replace(/(<\/h[234]>)<\/p>/g, '$1');
}

export function renderDetail(post) {
  const t = post.typeInfo;
  const r = post.riskInfo;
  const collapsed = RISK_COLLAPSED.includes(post.risk);

  const parts = [];

  // 头部
  parts.push(`
  <div class="d-head">
    <div class="d-badges">
      <span class="d-type" style="--ac:${t.accent}">${t.icon} ${esc(t.label)}</span>
      <span class="d-risk" style="--rc:${r.color}">${r.icon} ${esc(r.label)}风险</span>
      ${post.visibility !== 'public' ? `<span class="d-vis">${post.visibility === 'private' ? '🔒 仅自己' : '🔐 登录可见'}</span>` : ''}
    </div>
    <h1 class="d-title">${esc(post.title)}</h1>
    ${post.summary ? `<p class="d-sum">${esc(post.summary)}</p>` : ''}
    <div class="d-meta">
      <span>✍️ ${esc(post.author)}</span>
      <span>${fmtDate(post.createdAt)}</span>
      ${post.tags.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}
    </div>
  </div>`);

  // 风险警示条
  if (post.risk !== 'low') {
    parts.push(`
    <div class="d-alert" style="--rc:${r.color}">
      <div class="da-head">${r.icon} 风险等级：${esc(r.label)}</div>
      <div class="da-body">${esc(r.desc)}</div>
      ${post.data?.abortCond ? `<div class="da-row"><b>中止条件：</b>${esc(post.data.abortCond)}</div>` : ''}
      ${post.data?.safeWord ? `<div class="da-row"><b>安全信号：</b>${esc(post.data.safeWord)}</div>` : ''}
      ${post.data?.emergency ? `<div class="da-row"><b>紧急预案：</b>${esc(post.data.emergency)}</div>` : ''}
      ${post.data?.noSolo ? `<div class="da-row"><b>⛔ 禁止独自执行</b></div>` : ''}
    </div>`);
  }

  // 正文主体（极高风险默认折叠）
  const bodyParts = [];
  if (post.cover) {
    bodyParts.push(`<div class="d-cover" style="background-image:url('${esc(post.cover)}')"></div>`);
  }
  for (const sec of t.sections) {
    const rows = [];
    for (const f of sec.fields) {
      const html = valueCell(f, post.data?.[f.key]);
      if (!html) continue;
      const isList = f.type === 'list';
      rows.push(isList
        ? `<div class="d-block"><div class="d-block-t">${esc(f.label)}</div><ul class="d-list">${html}</ul></div>`
        : `<div class="d-row"><div class="d-k">${esc(f.label)}</div><div class="d-v">${html}</div></div>`);
    }
    if (rows.length) {
      bodyParts.push(`<section class="d-sec${sec.important ? ' important' : ''}">
        <h2 class="d-sec-t">${esc(sec.title)}</h2>${rows.join('')}</section>`);
    }
  }
  // 任务反馈：正文在 markdown 里
  if (post.markdown) {
    bodyParts.push(`<section class="d-sec"><div class="d-markdown">${renderSimpleMarkdown(post.markdown)}</div></section>`);
  }

  if (collapsed) {
    parts.push(`
    <div class="d-collapsed" id="collapsedBox">
      <div class="dc-inner">
        <div class="dc-ico">🔴</div>
        <div class="dc-title">该内容被标记为「极高风险」</div>
        <div class="dc-desc">可能涉及不可逆伤害。请确认你已充分了解风险后再展开。</div>
        <button type="button" class="btn btn-danger" id="expandBtn">我已了解风险，展开查看</button>
      </div>
    </div>
    <div class="d-body" id="bodyBox" style="display:none">${bodyParts.join('')}</div>`);
  } else {
    parts.push(`<div class="d-body">${bodyParts.join('')}</div>`);
  }

  return parts.join('');
}
