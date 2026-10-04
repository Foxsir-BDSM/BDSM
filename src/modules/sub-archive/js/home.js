import { CONFIG, SEARCH_FIELDS, PAGE_SIZE, VISIBILITY_FIELDS } from './config.js';
import { fetchRecordsPage, clearCache } from './api.js';
import {
  getFieldValue, getCardImage, getCardName, getCardAge, getCardInfo,
  filterRecordsByAffiliation, countByAffiliation, getRecordPositionGender,
  hasRealIdentityData,
} from './utils.js';
import { getUserRole } from '@/shared/js/identity.js';
import { getUserIdentity, getCurrentUser } from '@/shared/js/auth.js';
import { deriveArchiveFilter } from '@/shared/config/identity-config.js';

const grid = document.getElementById('gridContainer');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const searchStats = document.getElementById('searchStats');
const stateMsg = document.getElementById('stateMessage');
const loadMoreIndicator = document.getElementById('loadMoreIndicator');

let allRecords = [];
let currentPage = 1;
let totalRecords = 0;
let isLoading = false;
let hasMore = true;
let searchKeyword = '';
let currentRole = 'guest';

// ============================================================
// ★★★ 归属筛选状态 ★★★
//   position  top | bottom | all
//   gender    male | female | all
//   isDefault true 表示当前是「按身份推导的默认视图」
// ============================================================
const affFilter = {
  position: 'all',
  gender: 'all',
  isDefault: false,
  reason: '',
};

// ============================================================
// 判断记录是否公开
// ------------------------------------------------------------
// ★ 字段 ID 来自配置，不硬编码。
//   旧库用「公开问卷」fgerzjJpBTF；新库改用「是否公开问卷内容」
//   fkAEd2CE2gQ。迁库后若这里读旧 ID，会全部取到 null，
//   导致所有卡片被过滤掉（曾发生此故障）。
// ============================================================
function isPublic(record) {
  const fieldId = VISIBILITY_FIELDS.publicQuestionnaire;
  const value = getFieldValue(record, fieldId);
  if (value === true || value === '是' || value === 'true' || value === 1) return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}

// ============================================================
// 前端排序（最新在前）
// ------------------------------------------------------------
// 旧库按自增 ID 字段 fxwUAnrwpaT 降序；新库无该字段，
// 改用记录自带的 updatedAt / createdAt 时间戳。
// ============================================================
function sortByLatest(records) {
  // 旧库的自增序号字段。新库没有它，取到 null，此时走时间戳分支。
  // 保留这行是为了兼容仍带该字段的旧数据，不参与新库排序。
  const LEGACY_SEQ_FIELD = 'fxwUAnrwpaT';
  const ts = (r) => {
    const t = Date.parse(r.updatedAt || r.createdAt || '');
    return Number.isNaN(t) ? 0 : t;
  };
  return records.slice().sort((a, b) => {
    const idA = parseInt(getFieldValue(a, LEGACY_SEQ_FIELD), 10) || 0;
    const idB = parseInt(getFieldValue(b, LEGACY_SEQ_FIELD), 10) || 0;
    if (idA || idB) return idB - idA;
    return ts(b) - ts(a);
  });
}

// ============================================================
// 生成星级评分
// ============================================================
function generateStars(rating) {
  const num = parseInt(rating);
  if (isNaN(num) || num < 1 || num > 10) {
    return '<span class="no-rating">暂无评分</span>';
  }
  let stars = '';
  for (let i = 1; i <= 10; i++) {
    stars += i <= num ? '★' : '☆';
  }
  return stars;
}

// ============================================================
// 判断是否认证
// ============================================================
function isVerified(value) {
  if (value === true || value === 'true' || value === '是' || value === '认证' || value === 1) return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}

// ============================================================
// ★★★ 渲染所有卡片（归属筛选 + 搜索，每次全量重绘） ★★★
// ============================================================
function renderAllCards() {
  if (!allRecords || allRecords.length === 0) {
    grid.innerHTML = `<div class="state-message" style="grid-column:1/-1;"><p>😕 没有找到匹配的资料</p></div>`;
    return;
  }

  // ① 归属筛选（按身份）
  let displayRecords = filterRecordsByAffiliation(allRecords, {
    position: affFilter.position === 'all' ? null : affFilter.position,
    gender: affFilter.gender === 'all' ? null : affFilter.gender,
  });

  // ② 搜索关键词过滤
  if (searchKeyword.trim()) {
    const lower = searchKeyword.trim().toLowerCase();
    displayRecords = displayRecords.filter((record) => {
      for (const fieldId of SEARCH_FIELDS) {
        const value = getFieldValue(record, fieldId);
        if (value && String(value).toLowerCase().includes(lower)) {
          return true;
        }
      }
      return false;
    });
  }

  if (displayRecords.length === 0) {
    const tip = affFilter.isDefault
      ? '当前是按你的身份推导的默认视图，可点击上方「全部」查看所有档案'
      : '试试清空筛选条件或换个关键词';
    grid.innerHTML = `<div class="state-message" style="grid-column:1/-1;">
      <p>😕 没有找到匹配的资料</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:6px;">${tip}</p>
    </div>`;
    updateStats(0);
    return;
  }

  let html = '';
  displayRecords.forEach((record) => {
    const id = record.id;
    const img = getCardImage(record);
    const name = getCardName(record);
    const age = getCardAge(record);
    const info = getCardInfo(record);

    const area = info.area || '—';
    const height = info.height || '—';
    const weight = info.weight || '—';
    const recommend = info.recommend || '';
    const verified = isVerified(info.verified);

    const badgeHtml = verified ? '<div class="verified-badge">✅</div>' : '';

    html += `
      <div class="card" data-id="${id}" onclick="location.href='./detail.html?id=${id}'">
        <div class="card-image-wrap">
          <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_IMAGE}'" />
          ${badgeHtml}
          <div class="card-image-caption">
            <span class="card-name">${name}</span>
            ${age ? `<span class="card-age">${age}岁</span>` : ''}
          </div>
        </div>
        <div class="card-footer">
          <div class="info-row">
            <span class="icon">📍</span>
            <span class="value">${area}</span>
          </div>
          <div class="info-row row-height-weight">
            <span class="height-item"><span class="icon">📏</span><span class="value">${height}cm</span></span>
            <span class="weight-item"><span class="icon">⚖</span><span class="value">${weight}kg</span></span>
          </div>
          <div class="info-row stars-row">
            <div class="stars-container">${generateStars(recommend)}</div>
          </div>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
  updateStats(displayRecords.length);
}

function updateStats(count) {
  searchStats.innerHTML = `共 <strong>${count}</strong> 位`;
}

// ============================================================
// 加载一页（重置或追加）
// ============================================================
async function loadPage(page, reset = false) {
  if (isLoading) return;
  isLoading = true;

  if (loadMoreIndicator) {
    loadMoreIndicator.textContent = '⏳ 加载中...';
    loadMoreIndicator.style.display = 'block';
  }

  try {
    const result = await fetchRecordsPage(page);
    let records = result.records || [];
    totalRecords = result.total || records.length;

    records = records.filter(isPublic);

    if (reset) {
      allRecords = records;
    } else {
      // 追加并去重（防止重复）
      const existingIds = new Set(allRecords.map(r => r.id));
      const newRecords = records.filter(r => !existingIds.has(r.id));
      allRecords = allRecords.concat(newRecords);
    }

    // ★★★ 前端排序 ★★★
    allRecords = sortByLatest(allRecords);

    // 更新分页状态
    hasMore = allRecords.length < totalRecords;
    currentPage = page;
    renderAllCards(); // 全量重绘
    renderFilterBar(); // 计数随数据更新

    stateMsg.style.display = 'none';

    // 更新加载更多指示器
    if (loadMoreIndicator) {
      if (hasMore && allRecords.length > 0) {
        loadMoreIndicator.textContent = '⬇ 滚动加载更多...';
        loadMoreIndicator.style.display = 'block';
      } else if (!hasMore && allRecords.length > 0) {
        loadMoreIndicator.textContent = '✅ 已加载全部';
        loadMoreIndicator.style.display = 'block';
      } else {
        loadMoreIndicator.style.display = 'none';
      }
    }

  } catch (error) {
    console.error('加载失败:', error);
    if (reset) {
      stateMsg.innerHTML = `<p>❌ 加载失败：${error.message}</p>`;
      stateMsg.style.display = 'flex';
    }
    if (loadMoreIndicator) {
      loadMoreIndicator.textContent = '❌ 加载失败，请刷新重试';
    }
  } finally {
    isLoading = false;
  }
}

// ============================================================
// 加载更多（下一页）
// ============================================================
function loadMore() {
  if (!hasMore || isLoading) return;
  loadPage(currentPage + 1, false);
}

// ============================================================
// 搜索（重置分页）
// ============================================================
function handleSearch(keyword) {
  searchKeyword = keyword.trim();
  if (!searchKeyword) {
    // 清空搜索，重置分页
    currentPage = 1;
    allRecords = [];
    loadPage(1, true);
    return;
  }
  // 搜索时直接基于当前 allRecords 过滤并重新渲染，但不再加载新数据
  // 因为搜索关键词变化时，应该重置数据
  // 简单做法：重置分页，重新从第一页加载
  currentPage = 1;
  allRecords = [];
  loadPage(1, true);
}

// ============================================================
// 清除搜索
// ============================================================
function clearSearch() {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  searchKeyword = '';
  currentPage = 1;
  allRecords = [];
  loadPage(1, true);
  searchInput.focus();
}

// ============================================================
// 滚动监听
// ============================================================
function setupScrollListener() {
  const main = document.querySelector('.main-content');
  if (!main) {
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (documentHeight - scrollTop - windowHeight < 200) {
        loadMore();
      }
    });
    return;
  }

  let scrollTimer = null;
  main.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const { scrollTop, scrollHeight, clientHeight } = main;
      if (scrollHeight - scrollTop - clientHeight < 150) {
        loadMore();
      }
    }, 100);
  });
}

// ============================================================
// ★★★ 归属筛选条 ★★★
// ============================================================

/** 依据「用户身份」推导默认筛选（取向维度已取消） */
async function applyDefaultFilter() {
  let identity = null;
  try {
    identity = await getUserIdentity();
  } catch {
    /* 未登录或读取失败 → 保持全部 */
  }

  const d = deriveArchiveFilter(identity?.primaryId || null);

  affFilter.position = d.position || 'all';
  affFilter.gender = 'all';   // 性别维度已取消，恒为全部
  affFilter.isDefault = !!d.position;
  affFilter.reason = d.reason || '';
}

/** 渲染筛选条 */
function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  if (!bar) return;

  const c = countByAffiliation(allRecords);
  // 身份筛选是否生效：取决于档案是否带真实身份字段
  const identityTrusted = hasRealIdentityData(allRecords);

  const active = (k, v) => (affFilter[k] === v ? ' active' : '');
  const notes = [];
  if (!identityTrusted) {
    notes.push('档案尚未填写身份字段，身份筛选暂不可用（表单补齐后自动生效）');
  } else if (c.unknown) {
    notes.push(`${c.unknown} 条未标注归属，默认一并展示`);
  }

  bar.innerHTML = `
    <div class="fb-row">
      <span class="fb-label">身份</span>
      <button class="fb-btn${active('position', 'all')}" data-dim="position" data-val="all">全部 <i>${c.total}</i></button>
      <button class="fb-btn${active('position', 'top')}" data-dim="position" data-val="top">S <i>${c.top}</i></button>
      <button class="fb-btn${active('position', 'bottom')}" data-dim="position" data-val="bottom">M <i>${c.bottom}</i></button>
    </div>
    <div class="fb-row fb-meta">
      ${affFilter.isDefault
        ? `<span class="fb-default">默认视图：${affFilter.reason} <button class="fb-reset" id="fbReset">看全部</button></span>`
        : `<span class="fb-note">当前为手动筛选</span>`}
      ${notes.length ? `<span class="fb-note">${notes.join('；')}</span>` : ''}
    </div>
  `;

  bar.querySelectorAll('.fb-btn').forEach((b) => {
    b.addEventListener('click', () => {
      affFilter[b.dataset.dim] = b.dataset.val;
      affFilter.isDefault = false;
      affFilter.reason = '';
      renderFilterBar();
      renderAllCards();
    });
  });

  const reset = document.getElementById('fbReset');
  if (reset) {
    reset.addEventListener('click', () => {
      affFilter.position = 'all';
      affFilter.gender = 'all';
      affFilter.isDefault = false;
      affFilter.reason = '';
      renderFilterBar();
      renderAllCards();
    });
  }
  void identityTrusted;
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  try {
    currentRole = await getUserRole();
  } catch (e) {
    console.warn('获取角色失败，使用 guest');
  }

  // 先按身份推导默认筛选，再加载数据
  try {
    await applyDefaultFilter();
  } catch (e) {
    console.warn('默认筛选推导失败，使用全部', e);
  }

  stateMsg.style.display = 'flex';
  grid.innerHTML = '';
  renderFilterBar();

  await loadPage(1, true);

  // 绑定事件
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.trim()) {
      searchClear.classList.add('visible');
    } else {
      searchClear.classList.remove('visible');
    }
    handleSearch(val);
  });

  searchClear.addEventListener('click', clearSearch);

  document.getElementById('btnFillForm').addEventListener('click', openFillForm);

  setupScrollListener();
}

// ============================================================
// ★ 档案表单入口（带账号参数，实现内容与用户绑定）
// ------------------------------------------------------------
// 机制：把登录用户的信息拼进 URL，表单侧用 URL parameters 预填
//   参数名须与 Fillout 表单 Settings → URL parameters 中登记的一致：
//     email / name / uid
//
// 为什么先开空窗口再跳转：
//   window.open 必须由用户点击同步触发，否则会被浏览器拦截弹窗。
//   而取邮箱是异步的，所以先同步开一个占位窗口，拿到数据后再改它的地址。
// ============================================================
async function buildFormUrl() {
  const base = CONFIG.FORM_URL;
  try {
    const user = await getCurrentUser();
    if (!user?.email) return base; // 未登录 → 原样打开，走后台补录兜底

    const params = new URLSearchParams({
      email: user.email,
      name: user.user_metadata?.nickname || '',
      uid: (user.id || '').slice(0, 8),
    });
    return `${base}?${params.toString()}`;
  } catch (err) {
    console.warn('[archive] 拼装表单 URL 失败，改为裸开:', err);
    return base;
  }
}

async function openFillForm() {
  // ① 同步开占位窗口，避免被弹窗拦截
  const win = window.open('', '_blank');
  if (win) {
    try {
      win.document.write(
        '<!doctype html><meta charset="utf-8">' +
        '<title>正在准备表单…</title>' +
        '<body style="font-family:system-ui,sans-serif;padding:48px;color:#475569">' +
        '<p>正在准备表单…</p></body>'
      );
    } catch { /* 忽略：部分浏览器限制写入 */ }
  }

  // ② 取账号信息并跳转
  const url = await buildFormUrl();
  if (win) {
    win.location.href = url;
  } else {
    // 占位窗口被拦（极少见）→ 退回直接跳转
    window.open(url, '_blank');
  }
}

window.clearArchiveCache = () => {
  clearCache();
  location.reload();
};

init();
