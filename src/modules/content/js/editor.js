// 职责    结构化内容编辑器主逻辑：表单生成、实时预览、提交。
// 归属页面 内容编辑器 /modules/content/post-editor.html
// 依赖    content-types.js 等
// 被依赖   入口模块，由 post-editor.html 加载
//
// 维护提示
//   · ★ 表单由 content-types.js 的定义驱动生成，不要在本文件硬编码字段。
import {
  POST_TYPES, RISK_LEVELS, VISIBILITY, TAG_GROUPS,
  getPostType, getRisk, blankData, blankItem,
  RISK_NEEDS_SAFETY, RISK_COLLAPSED, scanRiskHints, CONTENT_STORE,
  buildFileContent,
} from './content-types.js';

import { getCurrentUser } from '@/shared/js/auth.js';
import { getUserRole } from '@/shared/js/identity.js';
import { showLoading, hideLoading } from '@/shared/js/loading.js';
import { showToast } from '@/shared/js/ui-helpers.js';
import { createOrUpdateContent } from '@/admin/content-manager.js';
import { renderTypePreview } from './renderers.js';

// ────────────────────────────────────────────── 状态
const state = {
  typeId: 'task',
  data: blankData('task'),
  meta: {
    title: '', slug: '', summary: '', cover: '',
    risk: 'low', visibility: 'public', tags: [], anonymous: false,
  },
  editingSlug: '',
  user: null,
  role: 'guest',
};

// ────────────────────────────────────────────── 工具
const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

function generateSlug(title) {
  return String(title).toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50) || 'post-' + Date.now();
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// ────────────────────────────────────────────── 字段渲染
function renderField(field, value, path, ctx) {
  const id = `${path}__${field.key}`;
  const dep = field.dependsOn;
  const hidden = dep && ctx.data[dep.key] !== dep.value;
  const wrap = (inner) =>
    `<div class="fld${hidden ? ' hidden' : ''}" data-dep-key="${dep ? dep.key : ''}" data-dep-val="${dep ? dep.value : ''}">
       <label class="fld-label" for="${esc(id)}">${esc(field.label)}</label>
       ${inner}
     </div>`;

  switch (field.type) {
    case 'text':
      return wrap(`<input type="text" id="${esc(id)}" class="inp" data-path="${esc(path)}" data-key="${esc(field.key)}"
        value="${esc(value || '')}" placeholder="${esc(field.placeholder || '')}" />`);

    case 'number':
      return wrap(`<input type="number" id="${esc(id)}" class="inp" data-path="${esc(path)}" data-key="${esc(field.key)}"
        value="${esc(value ?? '')}" placeholder="${esc(field.placeholder || '')}" />`);

    case 'textarea':
      return wrap(`<textarea id="${esc(id)}" class="inp ta${field.big ? ' big' : ''}" rows="${field.big ? 12 : 3}"
        data-path="${esc(path)}" data-key="${esc(field.key)}"
        placeholder="${esc(field.placeholder || '')}">${esc(value || '')}</textarea>`);

    case 'select':
      return wrap(`<select id="${esc(id)}" class="inp" data-path="${esc(path)}" data-key="${esc(field.key)}">
        ${field.options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
        }).join('')}
      </select>`);

    case 'switch':
      return wrap(`<label class="sw">
        <input type="checkbox" data-path="${esc(path)}" data-key="${esc(field.key)}" ${value ? 'checked' : ''} />
        <span class="sw-track"><span class="sw-dot"></span></span>
        <span class="sw-text">${value ? '是' : '否'}</span>
      </label>`);

    case 'radio': {
      const opts = field.options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const d = o.desc ? `<span class="ro-desc">${esc(o.desc)}</span>` : '';
        return `<label class="ro${String(value) === String(v) ? ' on' : ''}">
          <input type="radio" name="${esc(id)}" value="${esc(v)}"
            data-path="${esc(path)}" data-key="${esc(field.key)}" ${String(value) === String(v) ? 'checked' : ''} />
          <span class="ro-label">${esc(l)}</span>${d}
        </label>`;
      }).join('');
      return wrap(`<div class="ro-group">${opts}</div>`);
    }

    case 'checkbox': {
      const arr = Array.isArray(value) ? value : [];
      const opts = field.options.map((o) => `<label class="cb${arr.includes(o) ? ' on' : ''}">
        <input type="checkbox" value="${esc(o)}" data-path="${esc(path)}" data-key="${esc(field.key)}"
          ${arr.includes(o) ? 'checked' : ''} /><span>${esc(o)}</span>
      </label>`).join('');
      return wrap(`<div class="cb-group">${opts}</div>`);
    }

    case 'list': {
      const list = Array.isArray(value) ? value : [];
      const rows = list.map((item, i) => renderListItem(field, item, i, path)).join('');
      return wrap(`
        <div class="list" data-list-key="${esc(field.key)}" data-path="${esc(path)}">
          <div class="list-rows">${rows}</div>
          <button type="button" class="btn-add" data-add="${esc(field.key)}" data-path="${esc(path)}">
            ${esc(field.addLabel || '＋ 添加一项')}
          </button>
        </div>`);
    }

    default:
      return wrap(`<div class="unsupported">未知字段类型：${esc(field.type)}</div>`);
  }
}

function renderListItem(field, item, index, path) {
  const itemPath = `${path}.${field.key}[${index}]`;
  const label = field.numbered ? `#${index + 1}` : `第 ${index + 1} 项`;
  const inner = (field.item || []).map((sub) => {
    if (sub.type === 'list') {
      const nested = Array.isArray(item[sub.key]) ? item[sub.key] : [];
      const rows = nested.map((ni, j) => renderNestedItem(sub, ni, j, itemPath)).join('');
      return `<div class="fld nested">
        <label class="fld-label">${esc(sub.label)}</label>
        <div class="list" data-list-key="${esc(sub.key)}" data-path="${esc(itemPath)}">
          <div class="list-rows">${rows}</div>
          <button type="button" class="btn-add small" data-add="${esc(sub.key)}" data-path="${esc(itemPath)}">
            ${esc(sub.addLabel || '＋ 添加')}
          </button>
        </div>
      </div>`;
    }
    const id = `${itemPath}__${sub.key}`;
    let ctrl = '';
    if (sub.type === 'textarea') {
      ctrl = `<textarea id="${esc(id)}" class="inp ta" rows="2" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}" placeholder="${esc(sub.placeholder || '')}">${esc(item[sub.key] || '')}</textarea>`;
    } else if (sub.type === 'select') {
      ctrl = `<select class="inp" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}">
        ${sub.options.map((o) => `<option value="${esc(o)}"${item[sub.key] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}
      </select>`;
    } else if (sub.type === 'switch') {
      ctrl = `<label class="sw"><input type="checkbox" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}" ${item[sub.key] ? 'checked' : ''} />
        <span class="sw-track"><span class="sw-dot"></span></span><span class="sw-text">${item[sub.key] ? '是' : '否'}</span></label>`;
    } else if (sub.type === 'checkbox') {
      const arr = Array.isArray(item[sub.key]) ? item[sub.key] : [];
      ctrl = `<div class="cb-group">${sub.options.map((o) => `<label class="cb${arr.includes(o) ? ' on' : ''}">
        <input type="checkbox" value="${esc(o)}" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}" ${arr.includes(o) ? 'checked' : ''} /><span>${esc(o)}</span>
      </label>`).join('')}</div>`;
    } else {
      ctrl = `<input type="text" id="${esc(id)}" class="inp" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}" value="${esc(item[sub.key] || '')}" placeholder="${esc(sub.placeholder || '')}" />`;
    }
    return `<div class="fld"><label class="fld-label" for="${esc(id)}">${esc(sub.label)}</label>${ctrl}</div>`;
  }).join('');

  return `<div class="list-item" data-index="${index}">
    <div class="li-head">
      <span class="li-idx">${esc(label)}</span>
      <div class="li-tools">
        <button type="button" class="ico-btn" data-move="up" data-key="${esc(field.key)}" data-path="${esc(path)}" data-index="${index}" title="上移">↑</button>
        <button type="button" class="ico-btn" data-move="down" data-key="${esc(field.key)}" data-path="${esc(path)}" data-index="${index}" title="下移">↓</button>
        <button type="button" class="ico-btn danger" data-remove="${esc(field.key)}" data-path="${esc(path)}" data-index="${index}" title="删除">✕</button>
      </div>
    </div>
    <div class="li-body">${inner}</div>
  </div>`;
}

function renderNestedItem(field, item, index, parentPath) {
  const itemPath = `${parentPath}.${field.key}[${index}]`;
  const inner = (field.item || []).map((sub) => {
    const id = `${itemPath}__${sub.key}`;
    if (sub.type === 'textarea') {
      return `<div class="fld"><label class="fld-label">${esc(sub.label)}</label>
        <textarea id="${esc(id)}" class="inp ta" rows="2" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}" placeholder="${esc(sub.placeholder || '')}">${esc(item[sub.key] || '')}</textarea></div>`;
    }
    return `<div class="fld"><label class="fld-label">${esc(sub.label)}</label>
      <input type="text" id="${esc(id)}" class="inp" data-path="${esc(itemPath)}" data-key="${esc(sub.key)}" value="${esc(item[sub.key] || '')}" placeholder="${esc(sub.placeholder || '')}" /></div>`;
  }).join('');
  return `<div class="list-item nested" data-index="${index}">
    <div class="li-head">
      <span class="li-idx">${index + 1}</span>
      <div class="li-tools">
        <button type="button" class="ico-btn danger" data-remove="${esc(field.key)}" data-path="${esc(parentPath)}" data-index="${index}" title="删除">✕</button>
      </div>
    </div>
    <div class="li-body">${inner}</div>
  </div>`;
}

// ────────────────────────────────────────────── 渲染主体
function renderTypeTabs() {
  const box = el('typeTabs');
  box.innerHTML = POST_TYPES.map((t) => `
    <button type="button" class="type-tab${t.id === state.typeId ? ' on' : ''}" data-type="${t.id}">
      <span class="tt-ico">${t.icon}</span>
      <span class="tt-label">${esc(t.label)}</span>
      <span class="tt-desc">${esc(t.desc)}</span>
    </button>`).join('');
  box.querySelectorAll('.type-tab').forEach((b) => {
    b.addEventListener('click', () => switchType(b.dataset.type));
  });
}

function renderMeta() {
  const box = el('metaBox');
  const risk = getRisk(state.meta.risk);
  box.innerHTML = `
    <div class="fld">
      <label class="fld-label" for="mTitle">标题 <span class="req">*</span></label>
      <input type="text" id="mTitle" class="inp" maxlength="60" value="${esc(state.meta.title)}" placeholder="≤60 字" />
    </div>
    <div class="fld">
      <label class="fld-label" for="mSummary">一句话摘要</label>
      <input type="text" id="mSummary" class="inp" maxlength="80" value="${esc(state.meta.summary)}" placeholder="≤80 字，显示在卡片上" />
    </div>
    <div class="fld">
      <label class="fld-label" for="mCover">封面图 URL</label>
      <input type="text" id="mCover" class="inp" value="${esc(state.meta.cover)}" placeholder="可留空，之后补" />
    </div>

    <div class="fld">
      <label class="fld-label">风险等级 <span class="req">*</span></label>
      <div class="risk-group">
        ${RISK_LEVELS.map((r) => `
          <label class="risk${state.meta.risk === r.id ? ' on' : ''}" data-risk="${r.id}" style="--rc:${r.color}">
            <input type="radio" name="mRisk" value="${r.id}" ${state.meta.risk === r.id ? 'checked' : ''} />
            <span class="rk-ico">${r.icon}</span>
            <span class="rk-body"><b>${r.label}</b><span>${esc(r.desc)}</span></span>
          </label>`).join('')}
      </div>
    </div>

    <div class="fld">
      <label class="fld-label">可见性</label>
      <div class="ro-group">
        ${VISIBILITY.map((v) => `<label class="ro${state.meta.visibility === v.id ? ' on' : ''}">
          <input type="radio" name="mVis" value="${v.id}" ${state.meta.visibility === v.id ? 'checked' : ''} />
          <span class="ro-label">${esc(v.label)}</span><span class="ro-desc">${esc(v.desc)}</span>
        </label>`).join('')}
      </div>
    </div>

    <div class="fld">
      <label class="fld-label">标签</label>
      <div class="tag-groups">
        ${TAG_GROUPS.map((g) => `<div class="tag-group">
          <div class="tg-name">${esc(g.group)}</div>
          <div class="cb-group">${g.tags.map((t) => `<label class="cb${state.meta.tags.includes(t) ? ' on' : ''}">
            <input type="checkbox" class="tag-cb" value="${esc(t)}" ${state.meta.tags.includes(t) ? 'checked' : ''} /><span>${esc(t)}</span>
          </label>`).join('')}</div>
        </div>`).join('')}
      </div>
      <div class="sel-tags" id="selTags"></div>
    </div>

    <div class="fld">
      <label class="sw">
        <input type="checkbox" id="mAnon" ${state.meta.anonymous ? 'checked' : ''} />
        <span class="sw-track"><span class="sw-dot"></span></span>
        <span class="sw-text">匿名发布（不显示昵称）</span>
      </label>
    </div>`;

  // 绑定
  el('mTitle').addEventListener('input', (e) => {
    state.meta.title = e.target.value;
    state.meta.slug = generateSlug(e.target.value);
    scheduleDraft();
  });
  el('mSummary').addEventListener('input', (e) => { state.meta.summary = e.target.value; scheduleDraft(); });
  el('mCover').addEventListener('input', (e) => { state.meta.cover = e.target.value; scheduleDraft(); });
  el('mAnon').addEventListener('change', (e) => { state.meta.anonymous = e.target.checked; scheduleDraft(); });

  box.querySelectorAll('input[name="mRisk"]').forEach((r) =>
    r.addEventListener('change', () => {
      state.meta.risk = r.value;
      renderMeta(); renderSafety();
      scheduleDraft();
    }));
  box.querySelectorAll('input[name="mVis"]').forEach((r) =>
    r.addEventListener('change', () => { state.meta.visibility = r.value; renderMeta(); scheduleDraft(); }));
  box.querySelectorAll('.tag-cb').forEach((c) =>
    c.addEventListener('change', () => {
      const t = c.value;
      if (c.checked) { if (!state.meta.tags.includes(t)) state.meta.tags.push(t); }
      else state.meta.tags = state.meta.tags.filter((x) => x !== t);
      renderSelTags();
      c.closest('.cb').classList.toggle('on', c.checked);
      scheduleDraft();
    }));

  renderSelTags();
  void risk;
}

function renderSelTags() {
  const box = el('selTags');
  if (!box) return;
  box.innerHTML = state.meta.tags.length
    ? '已选：' + state.meta.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')
    : '<span class="dim">尚未选择标签</span>';
}

/** 高/极高风险时强制显示的「安全字段」区块 */
function renderSafety() {
  const box = el('safetyBox');
  const need = RISK_NEEDS_SAFETY.includes(state.meta.risk);
  if (!need) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  const r = getRisk(state.meta.risk);
  box.innerHTML = `
    <div class="safety-card" style="--rc:${r.color}">
      <div class="sc-head">${r.icon} 风险等级「${r.label}」要求补全安全字段</div>
      <div class="fld">
        <label class="fld-label">安全词 / 安全信号 <span class="req">*</span></label>
        <input type="text" id="sSafeWord" class="inp" value="${esc(state.data.safeWord || 'Red 立即停止 / Yellow 减缓 / Green 继续')}" />
      </div>
      <div class="fld">
        <label class="fld-label">中止条件 <span class="req">*</span></label>
        <textarea id="sAbort" class="inp ta" rows="2" placeholder="出现什么必须立刻停止">${esc(state.data.abortCond || '')}</textarea>
      </div>
      <div class="fld">
        <label class="fld-label">是否禁止独自执行</label>
        <label class="sw"><input type="checkbox" id="sNoSolo" ${state.data.noSolo ? 'checked' : ''} />
          <span class="sw-track"><span class="sw-dot"></span></span><span class="sw-text">禁止独自执行</span></label>
      </div>
      <div class="fld">
        <label class="fld-label">紧急预案 <span class="req">*</span></label>
        <textarea id="sEmergency" class="inp ta" rows="2" placeholder="联系方式、就近就医提示">${esc(state.data.emergency || '')}</textarea>
      </div>
      ${RISK_COLLAPSED.includes(state.meta.risk) ? `
      <label class="ack">
        <input type="checkbox" id="sAck" ${state.data.ack ? 'checked' : ''} />
        <span>我已了解该内容属于<b>极高风险</b>，发布后将以折叠形式展示，读者需主动确认才能查看</span>
      </label>` : ''}
    </div>`;

  el('sSafeWord')?.addEventListener('input', (e) => { state.data.safeWord = e.target.value; scheduleDraft(); });
  el('sAbort')?.addEventListener('input', (e) => { state.data.abortCond = e.target.value; scheduleDraft(); });
  el('sNoSolo')?.addEventListener('change', (e) => { state.data.noSolo = e.target.checked; scheduleDraft(); });
  el('sEmergency')?.addEventListener('input', (e) => { state.data.emergency = e.target.value; scheduleDraft(); });
  el('sAck')?.addEventListener('change', (e) => { state.data.ack = e.target.checked; scheduleDraft(); });
}

function renderSections() {
  const type = getPostType(state.typeId);
  const box = el('sectionBox');
  box.innerHTML = type.sections.map((sec) => `
    <section class="sec${sec.important ? ' important' : ''}">
      <div class="sec-head">
        <h3>${esc(sec.title)}${sec.important ? ' <span class="badge-imp">推荐填写</span>' : ''}</h3>
        ${sec.hint ? `<p class="sec-hint">${esc(sec.hint)}</p>` : ''}
      </div>
      <div class="sec-body">
        ${sec.fields.map((f) => renderField(f, state.data[f.key], 'root', { data: state.data })).join('')}
      </div>
    </section>`).join('');
  bindSectionEvents();
}

// ────────────────────────────────────────────── 事件绑定
function parsePath(path) {
  // 'root' -> []; 'root.props[2]' -> [{key:'props', idx:2}]
  if (!path || path === 'root') return [];
  const out = [];
  const re = /([A-Za-z0-9_]+)\[(\d+)\]/g;
  let m;
  while ((m = re.exec(path)) !== null) out.push({ key: m[1], idx: Number(m[2]) });
  return out;
}

function resolveObj(path) {
  let obj = state.data;
  for (const seg of parsePath(path)) {
    if (!Array.isArray(obj[seg.key])) obj[seg.key] = [];
    if (!obj[seg.key][seg.idx]) obj[seg.key][seg.idx] = {};
    obj = obj[seg.key][seg.idx];
  }
  return obj;
}

function bindSectionEvents() {
  // 文本 / 数字 / 多行 / 下拉
  el('sectionBox').querySelectorAll('input[data-path], textarea[data-path], select[data-path]').forEach((ctrl) => {
    const handler = () => {
      const target = resolveObj(ctrl.dataset.path);
      const k = ctrl.dataset.key;
      target[k] = ctrl.type === 'number' ? (ctrl.value === '' ? '' : Number(ctrl.value)) : ctrl.value;
      // 依赖联动
      if (ctrl.dataset.key === 'mode') refreshDependencies();
      scheduleDraft();
    };
    ctrl.addEventListener(ctrl.tagName === 'SELECT' ? 'change' : 'input', handler);
  });

  // 开关
  el('sectionBox').querySelectorAll('input[type="checkbox"][data-path]').forEach((c) => {
    c.addEventListener('change', () => {
      const target = resolveObj(c.dataset.path);
      const k = c.dataset.key;
      if (c.closest('.cb-group')) {
        const arr = Array.isArray(target[k]) ? target[k] : [];
        if (c.checked) { if (!arr.includes(c.value)) arr.push(c.value); }
        else target[k] = arr.filter((x) => x !== c.value);
        target[k] = arr;
        c.closest('.cb')?.classList.toggle('on', c.checked);
      } else {
        target[k] = c.checked;
        const sw = c.closest('.sw');
        if (sw) sw.querySelector('.sw-text').textContent = c.checked ? '是' : '否';
      }
      scheduleDraft();
    });
  });

  // 单选
  el('sectionBox').querySelectorAll('input[type="radio"][data-path]').forEach((r) => {
    r.addEventListener('change', () => {
      const target = resolveObj(r.dataset.path);
      target[r.dataset.key] = r.value;
      r.closest('.ro-group')?.querySelectorAll('.ro').forEach((x) => x.classList.remove('on'));
      r.closest('.ro')?.classList.add('on');
      refreshDependencies();
      scheduleDraft();
    });
  });

  // 添加
  el('sectionBox').querySelectorAll('[data-add]').forEach((b) => {
    b.addEventListener('click', () => addItem(b.dataset.add, b.dataset.path));
  });

  // 删除 / 移动
  el('sectionBox').querySelectorAll('[data-remove]').forEach((b) => {
    b.addEventListener('click', () => removeItem(b.dataset.remove, b.dataset.path, Number(b.dataset.index)));
  });
  el('sectionBox').querySelectorAll('[data-move]').forEach((b) => {
    b.addEventListener('click', () => moveItem(b.dataset.key, b.dataset.path, Number(b.dataset.index), b.dataset.move));
  });
}

function findField(key, path) {
  const type = getPostType(state.typeId);
  const inSecs = type.sections.flatMap((s) => s.fields);
  // 顶层
  const top = inSecs.find((f) => f.key === key);
  if (top) return top;
  // 嵌套：从父字段的 item 里找
  for (const f of inSecs) {
    if (f.type !== 'list' || !f.item) continue;
    for (const sub of f.item) {
      if (sub.key === key) return sub;
      if (sub.type === 'list' && sub.item) {
        const deep = sub.item.find((x) => x.key === key);
        if (deep) return { ...sub, item: sub.item, _parentKey: f.key };
      }
    }
  }
  void path;
  return null;
}

function addItem(key, path) {
  const target = resolveObj(path);
  const isTop = !path || path === 'root';
  const field = isTop
    ? getPostType(state.typeId).sections.flatMap((s) => s.fields).find((f) => f.key === key && f.type === 'list')
    : findField(key, path);
  if (!field) return;
  if (!Array.isArray(target[key])) target[key] = [];
  target[key].push(blankItem(field));
  rerenderPreservingScroll();
}

function removeItem(key, path, index) {
  const target = resolveObj(path);
  if (!Array.isArray(target[key])) return;
  target[key].splice(index, 1);
  rerenderPreservingScroll();
}

function moveItem(key, path, index, dir) {
  const target = resolveObj(path);
  const arr = target[key];
  if (!Array.isArray(arr)) return;
  const to = dir === 'up' ? index - 1 : index + 1;
  if (to < 0 || to >= arr.length) return;
  [arr[index], arr[to]] = [arr[to], arr[index]];
  rerenderPreservingScroll();
}

/** 重渲染字段区，但保留滚动位置与聚焦元素（避免输入时跳顶） */
function rerenderPreservingScroll() {
  const scrollY = window.scrollY;
  const active = document.activeElement;
  const info = active && active.dataset && active.dataset.key
    ? { path: active.dataset.path, key: active.dataset.key, pos: active.selectionStart }
    : null;
  renderSections();
  window.scrollTo(0, scrollY);
  if (info) {
    const sel = `[data-path="${info.path}"][data-key="${info.key}"]`;
    const next = el('sectionBox').querySelector(sel);
    if (next) { next.focus(); try { next.setSelectionRange(info.pos, info.pos); } catch { /* 非文本控件 */ } }
  }
  scheduleDraft();
}

function refreshDependencies() {
  const type = getPostType(state.typeId);
  const fields = type.sections.flatMap((s) => s.fields);
  el('sectionBox').querySelectorAll('.fld[data-dep-key]').forEach((node) => {
    const k = node.dataset.depKey;
    if (!k) return;
    const v = node.dataset.depVal;
    const f = fields.find((x) => x.key === k) || findField(k, 'root');
    void f;
    const cur = state.data[k];
    node.classList.toggle('hidden', String(cur) !== String(v));
  });
}

function switchType(id) {
  if (id === state.typeId) return;
  const hasContent = JSON.stringify(state.data) !== JSON.stringify(blankData(state.typeId));
  if (hasContent && !confirm('切换类型会重置已填写的类型专属字段，确定继续？')) return;
  state.typeId = id;
  state.data = blankData(id);
  renderTypeTabs(); renderSections(); renderSafety(); renderPreview();
  scheduleDraft();
}

// ────────────────────────────────────────────── 草稿
let draftTimer = null;
function scheduleDraft() {
  renderPreviewDebounced();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 800);
}

function saveDraft() {
  try {
    const all = JSON.parse(localStorage.getItem(CONTENT_STORE.draftKey) || '{}');
    all[state.editingSlug || '__new__'] = {
      typeId: state.typeId, data: state.data, meta: state.meta, at: Date.now(),
    };
    localStorage.setItem(CONTENT_STORE.draftKey, JSON.stringify(all));
    const box = el('draftTip');
    if (box) { box.textContent = '草稿已自动保存 ' + new Date().toLocaleTimeString('zh-CN'); box.classList.add('show'); setTimeout(() => box.classList.remove('show'), 1800); }
  } catch (e) {
    console.warn('草稿保存失败:', e);
  }
}

function loadDraft() {
  try {
    const all = JSON.parse(localStorage.getItem(CONTENT_STORE.draftKey) || '{}');
    return all[state.editingSlug || '__new__'] || null;
  } catch { return null; }
}

// ────────────────────────────────────────────── 预览
let previewTimer = null;
function renderPreviewDebounced() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 300);
}

function renderPreview() {
  const box = el('previewBox');
  if (!box) return;
  const type = getPostType(state.typeId);
  const risk = getRisk(state.meta.risk);
  const parts = [];
  parts.push(`<div class="pv-title">${esc(state.meta.title || '（未填标题）')}</div>`);
  parts.push(`<div class="pv-meta">
    <span class="pv-type" style="--ac:${type.accent}">${type.icon} ${esc(type.label)}</span>
    <span class="pv-risk" style="--rc:${risk.color}">${risk.icon} ${esc(risk.label)}风险</span>
    ${state.meta.tags.slice(0, 6).map((t) => `<span class="chip sm">${esc(t)}</span>`).join('')}
  </div>`);
  if (state.meta.summary) parts.push(`<p class="pv-sum">${esc(state.meta.summary)}</p>`);

  // 类型专属预览：由 renderers.js 按类型分发
  parts.push(renderTypePreview(state.typeId, state.meta, state.data));

  box.innerHTML = parts.join('');
  el('pvLen').textContent = String(box.textContent.length);
}

// ────────────────────────────────────────────── 校验
function collectPlainText() {
  const chunks = [state.meta.title, state.meta.summary, state.data.body || ''];
  const walk = (v) => {
    if (typeof v === 'string') chunks.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(state.data);
  return chunks.filter(Boolean).join('\n');
}

function validate() {
  const errs = [];
  if (!state.meta.title.trim()) errs.push('请填写标题');
  if (!state.meta.risk) errs.push('请选择风险等级');
  if (!state.meta.visibility) errs.push('请选择可见性');

  if (RISK_NEEDS_SAFETY.includes(state.meta.risk)) {
    if (!String(state.data.abortCond || '').trim()) errs.push('当前风险等级要求填写「中止条件」');
    if (!String(state.data.emergency || '').trim()) errs.push('当前风险等级要求填写「紧急预案」');
    if (RISK_COLLAPSED.includes(state.meta.risk) && !state.data.ack) {
      errs.push('极高风险内容需要勾选「我已了解风险」确认');
    }
  }

  const type = getPostType(state.typeId);
  if (type.id === 'note' && !String(state.data.body || '').trim()) errs.push('请填写正文');
  if (type.id === 'task') {
    const steps = state.data.steps || [];
    if (!steps.length || !steps.some((s) => String(s.text || '').trim())) errs.push('玩法任务至少需要 1 个步骤');
  }
  return errs;
}

// ────────────────────────────────────────────── 序列化
function buildPostBody() {
  const type = getPostType(state.typeId);
  const payload = {
    type: state.typeId,
    title: state.meta.title.trim(),
    slug: state.meta.slug || generateSlug(state.meta.title),
    summary: state.meta.summary.trim(),
    cover: state.meta.cover.trim(),
    risk: state.meta.risk,
    visibility: state.meta.visibility,
    tags: state.meta.tags,
    data: state.data,
  };
  // D 类正文单独放入 markdown 正文，其余走 frontmatter JSON
  if (type.id === 'note') {
    return { payload, markdown: String(state.data.body || '') };
  }
  return { payload, markdown: '' };
}

// ────────────────────────────────────────────── 初始化
export async function initEditor() {
  showLoading('打开编辑器', '准备中…');
  try {
    state.user = await getCurrentUser();
    state.role = await getUserRole();

    if (!state.user) {
      el('guestCard').style.display = 'block';
      el('editorArea').style.display = 'none';
      return;
    }
    el('guestCard').style.display = 'none';
    el('editorArea').style.display = 'block';

    // 载入草稿
    const draft = loadDraft();
    if (draft) {
      state.typeId = draft.typeId || 'task';
      state.data = draft.data || blankData(state.typeId);
      state.meta = { ...state.meta, ...(draft.meta || {}) };
    }

    renderTypeTabs();
    renderMeta();
    renderSections();
    renderSafety();
    renderPreview();

    el('publishBtn').addEventListener('click', onPublish);
    el('clearDraftBtn').addEventListener('click', onClearDraft);

    refreshDependencies();
  } catch (err) {
    console.error('[editor] 初始化失败:', err);
    showToast('初始化失败：' + err.message, 'error');
  } finally {
    hideLoading(false);
  }
}

function onClearDraft() {
  if (!confirm('确定清空当前内容？此操作不可撤销。')) return;
  state.data = blankData(state.typeId);
  state.meta = { title: '', slug: '', summary: '', cover: '', risk: 'low', visibility: 'public', tags: [], anonymous: false };
  try {
    const all = JSON.parse(localStorage.getItem(CONTENT_STORE.draftKey) || '{}');
    delete all[state.editingSlug || '__new__'];
    localStorage.setItem(CONTENT_STORE.draftKey, JSON.stringify(all));
  } catch { /* 忽略 */ }
  renderMeta(); renderSections(); renderSafety(); renderPreview();
  showToast('已清空');
}

async function onPublish() {
  const errs = validate();
  if (errs.length) {
    el('pubMsg').className = 'pub-msg err show';
    el('pubMsg').innerHTML = '还有 ' + errs.length + ' 项需要处理：<br>· ' + errs.map(esc).join('<br>· ');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // 高风险提示（决策 1：不拦截，仅建议）
  const hints = scanRiskHints(collectPlainText());
  if (hints.length) {
    const list = [...new Set(hints.map((h) => h.note))].join('\n· ');
    const ok = confirm(
      `⚠️ 检测到内容可能涉及以下情形：\n· ${list}\n\n` +
      `建议把风险等级调为「极高」并补全安全字段。\n\n` +
      `点击「确定」仍要发布，点击「取消」返回调整。`
    );
    if (!ok) return;
  }

  const { payload, markdown } = buildPostBody();
  const path = `${CONTENT_STORE.path}/${payload.slug}.md`;

  payload.meta = {
    title: payload.title,
    slug: payload.slug,
    summary: payload.summary,
    cover: payload.cover,
    risk: payload.risk,
    visibility: payload.visibility,
    tags: payload.tags,
    authorNickname: state.meta.anonymous
      ? '匿名'
      : (state.user.user_metadata?.nickname || state.user.email?.split('@')[0] || '未知'),
    authorEmail: state.meta.anonymous ? '' : (state.user.email || ''),
    createdAt: new Date().toISOString(),
  };

  const fileBody = buildFileContent(payload, markdown);

  el('publishBtn').disabled = true;
  el('publishBtn').textContent = '发布中…';
  el('pubMsg').className = 'pub-msg info show';
  el('pubMsg').textContent = '正在写入内容仓库…';

  try {
    await createOrUpdateContent(CONTENT_STORE.branch, path, fileBody, `📝 发布: ${payload.title}`);
    el('pubMsg').className = 'pub-msg ok show';
    el('pubMsg').innerHTML = `✅ 发布成功！<a href="./post.html?slug=${encodeURIComponent(payload.slug)}">查看详情 →</a>`;
    showToast('发布成功 🎉');
  } catch (err) {
    el('pubMsg').className = 'pub-msg err show';
    el('pubMsg').textContent = '发布失败：' + err.message + '（未配置 GitHub Token 时无法写入）';
    showToast('发布失败', 'error');
  } finally {
    el('publishBtn').disabled = false;
    el('publishBtn').textContent = '🚀 发布';
  }
}

export { state as editorState };
