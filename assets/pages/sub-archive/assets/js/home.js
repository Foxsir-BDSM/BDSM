import { CONFIG, SEARCH_FIELDS, PAGE_SIZE } from './config.js';
import { fetchRecordsPage, clearCache } from './api.js';
import { getFieldValue, getCardImage, getCardName, getCardAge, getCardInfo } from './utils.js';
import { getUserRole } from '@/js/identity.js';

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
// 判断记录是否公开
// ============================================================
function isPublic(record) {
  const value = getFieldValue(record, 'fgerzjJpBTF');
  if (value === true || value === '是' || value === 'true' || value === 1) return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}

// ============================================================
// ★★★ 前端排序（按 fxwUAnrwpaT 降序） ★★★
// ============================================================
function sortByLatest(records) {
  const idFieldId = 'fxwUAnrwpaT';
  return records.slice().sort((a, b) => {
    const idA = parseInt(getFieldValue(a, idFieldId)) || 0;
    const idB = parseInt(getFieldValue(b, idFieldId)) || 0;
    return idB - idA;
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
// ★★★ 渲染所有卡片（不再追加，每次全量重绘） ★★★
// ============================================================
function renderAllCards() {
  if (!allRecords || allRecords.length === 0) {
    grid.innerHTML = `<div class="state-message" style="grid-column:1/-1;"><p>😕 没有找到匹配的资料</p></div>`;
    return;
  }

  // 如果有搜索关键词，过滤
  let displayRecords = allRecords;
  if (searchKeyword.trim()) {
    const lower = searchKeyword.trim().toLowerCase();
    displayRecords = allRecords.filter(record => {
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
    grid.innerHTML = `<div class="state-message" style="grid-column:1/-1;"><p>😕 没有找到匹配的资料</p></div>`;
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
      <div class="card" data-id="${id}" onclick="location.href='detail.html?id=${id}'">
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
// 初始化
// ============================================================
async function init() {
  try {
    currentRole = await getUserRole();
  } catch (e) {
    console.warn('获取角色失败，使用 guest');
  }

  stateMsg.style.display = 'flex';
  grid.innerHTML = '';

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

  document.getElementById('btnFillForm').addEventListener('click', () => {
    window.open(CONFIG.FORM_URL, '_blank');
  });

  setupScrollListener();
}

window.clearArchiveCache = () => {
  clearCache();
  location.reload();
};

init();
