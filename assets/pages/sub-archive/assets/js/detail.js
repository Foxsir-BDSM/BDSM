// ============================================================
// sub-archive/assets/js/detail.js
// 详情页 - 使用 DETAIL_GROUPS 排序（从 config.js 读取）
// ============================================================

import { CONFIG, DETAIL_GROUPS, FIELD_LABELS } from './config.js';
import { fetchRecordById } from './api.js';
import {
  isImageValue,
  getFieldValue,
  extractFileUrl,
  getImageUrls,
  filterFieldsByRoleAndPrivacy,
} from './utils.js';
import { getUserRole } from '/assets/js/identity.js';

// DOM
const container = document.getElementById('detailContainer');

// ===== 工具：HTML 转义 =====
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== 判断值是否为空（用于过滤） =====
function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

// ===== 从 URL 获取记录 ID =====
function getRecordIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ===== 本地视频判断 =====
function isVideoValue(value) {
  if (!value) return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return isVideoValue(value[0]);
  }
  const url = extractFileUrl(value);
  if (!url) return false;
  return (
    /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v)$/i.test(url) ||
    /^https?:\/\/[^\s]+\.(mp4|webm|mov|avi|mkv)/i.test(url)
  );
}

// ===== 生成星星 =====
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

// ===== 图片 Lightbox =====
function showLightbox(src, alt) {
  const existing = document.querySelector('.lightbox-overlay');
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', '关闭大图');

  const imgWrap = document.createElement('div');
  imgWrap.className = 'lightbox-image-wrap';

  const imgEl = document.createElement('img');
  imgEl.className = 'lightbox-image';
  imgEl.src = src + '?w=400&h=600&fit=crop';
  imgEl.alt = alt || '大图';

  let isZoomed = false;
  imgEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    isZoomed = !isZoomed;
    if (isZoomed) {
      imgEl.style.transform = 'scale(1.8)';
      imgEl.style.cursor = 'zoom-out';
    } else {
      imgEl.style.transform = 'scale(1)';
      imgEl.style.cursor = 'zoom-in';
    }
  });

  const loading = document.createElement('div');
  loading.className = 'lightbox-loading';
  loading.textContent = '加载中…';

  imgWrap.appendChild(loading);
  imgWrap.appendChild(imgEl);
  overlay.appendChild(closeBtn);
  overlay.appendChild(imgWrap);
  document.body.appendChild(overlay);

  imgEl.onload = () => {
    loading.style.display = 'none';
    imgEl.style.cursor = 'zoom-in';
  };
  imgEl.onerror = () => {
    loading.textContent = '❌ 图片加载失败';
    loading.style.color = '#ef4444';
  };

  let clickTimer = null;
  overlay.addEventListener('click', (e) => {
    if (e.target === imgEl || e.target.closest('.lightbox-image')) {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        return;
      }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        overlay.remove();
      }, 250);
    } else {
      overlay.remove();
    }
  });

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      document.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

// ===== 视频全屏播放器 =====
function showVideoLightbox(src) {
  const existing = document.querySelector('.lightbox-overlay');
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay lightbox-video';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', '关闭视频');

  const videoWrap = document.createElement('div');
  videoWrap.className = 'lightbox-video-wrap';

  const videoEl = document.createElement('video');
  videoEl.className = 'lightbox-video';
  videoEl.src = src;
  videoEl.controls = true;
  videoEl.autoplay = true;
  videoEl.preload = 'metadata';
  videoEl.setAttribute('playsinline', '');

  videoWrap.appendChild(videoEl);
  overlay.appendChild(closeBtn);
  overlay.appendChild(videoWrap);
  document.body.appendChild(overlay);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      videoEl.pause();
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === closeBtn) {
      videoEl.pause();
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }
  });

  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      document.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

// ===== 加载媒体信息 =====
function loadMediaInfo(url, type) {
  return new Promise((resolve) => {
    if (type === 'video') {
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve({
          url,
          type: 'video',
          width: video.videoWidth || 16,
          height: video.videoHeight || 9,
        });
        video.remove();
      };
      video.onerror = () => {
        resolve({ url, type: 'video', width: 16, height: 9 });
        video.remove();
      };
      setTimeout(() => {
        video.remove();
        resolve({ url, type: 'video', width: 16, height: 9 });
      }, 5000);
    } else {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({
          url,
          type: 'image',
          width: img.naturalWidth || 300,
          height: img.naturalHeight || 400,
        });
        img.remove();
      };
      img.onerror = () => {
        resolve({ url, type: 'image', width: 16, height: 9 });
        img.remove();
      };
      setTimeout(() => {
        img.remove();
        resolve({ url, type: 'image', width: 16, height: 9 });
      }, 5000);
    }
  });
}

async function collectAndSortMedia(groupFields) {
  const mediaPromises = [];

  groupFields.forEach(({ id, label, value }) => {
    if (!value) return;
    const urls = getImageUrls(value);
    if (urls.length === 0) return;
    const isVideo = isVideoValue(value);
    urls.forEach((url) => {
      mediaPromises.push(
        loadMediaInfo(url, isVideo ? 'video' : 'image').then((info) => ({
          ...info,
          id,
          label,
        }))
      );
    });
  });

  const mediaList = await Promise.all(mediaPromises);
  const validMedia = mediaList.filter((m) => m.width > 0 && m.height > 0);

  validMedia.sort((a, b) => {
    if (a.type === 'video' && b.type !== 'video') return 1;
    if (b.type === 'video' && a.type !== 'video') return -1;
    return 0;
  });

  const portrait = validMedia.filter((m) => m.width < m.height);
  const landscape = validMedia.filter((m) => m.width >= m.height);
  return { portrait, landscape };
}

function renderMediaItem(media) {
  const { url, type, label } = media;
  const escapedUrl = escapeHtml(url);
  const escapedLabel = escapeHtml(label);

  if (type === 'video') {
    return `
      <div class="media-item" onclick="(function(e){ e.stopPropagation(); window.showVideoLightbox && window.showVideoLightbox('${escapedUrl}'); })(event)">
        <video src="${escapedUrl}" preload="metadata" muted></video>
        <div class="media-play-icon">▶</div>
      </div>
    `;
  } else {
    return `
      <div class="media-item" onclick="(function(e){ e.stopPropagation(); window.showLightbox && window.showLightbox('${escapedUrl}', '${escapedLabel}'); })(event)">
        <img src="${escapedUrl}?w=200&h=300&fit=crop" alt="${escapedLabel}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_IMAGE}'" />
      </div>
    `;
  }
}

function renderMediaGroup(groupTitle, groupId, portraitList, landscapeList) {
  const hasPortrait = portraitList && portraitList.length > 0;
  const hasLandscape = landscapeList && landscapeList.length > 0;

  if (!hasPortrait && !hasLandscape) {
    return ''; // ★★★ 完全隐藏空媒体分组 ★★★
  }

  let html = `
    <div class="detail-group" data-group="${groupId}">
      <div class="detail-group-title">${escapeHtml(groupTitle)}</div>
      <div class="media-grid">
  `;

  if (hasPortrait) {
    html += `<div class="media-row portrait-row">`;
    portraitList.forEach((media) => {
      html += renderMediaItem(media);
    });
    html += `</div>`;
  }

  if (hasLandscape) {
    html += `<div class="media-row landscape-row">`;
    landscapeList.forEach((media) => {
      html += renderMediaItem(media);
    });
    html += `</div>`;
  }

  html += `
      </div>
    </div>
  `;

  return html;
}

// ============================================================
// ★★★ 核心修复：优先使用 record.data（字段ID为key） ★★★
// ============================================================

// ---- 构建字段映射（id → { label, value }） ----
function buildFieldMap(record) {
  const map = {};
  const rawFields = record.data || record.fields || {};

  for (const [id, value] of Object.entries(rawFields)) {
    if (id === 'id' || id === 'createdAt' || id === 'updatedAt') continue;
    const label = FIELD_LABELS[id] || id;
    map[id] = { id, label, value };
  }
  return map;
}

// ---- 从 DETAIL_GROUPS 构建分组字段列表 ----
function buildGroupedFieldsFromConfig(record) {
  const fieldMap = buildFieldMap(record);
  const groups = [];

  for (const groupConfig of DETAIL_GROUPS) {
    const fields = [];
    for (const fieldId of groupConfig.fields) {
      if (fieldMap[fieldId]) {
        fields.push(fieldMap[fieldId]);
      }
    }
    if (fields.length > 0) {
      groups.push({
        groupId: groupConfig.id,
        groupTitle: groupConfig.title,
        fields: fields,
      });
    }
  }

  return groups;
}

// ============================================================
// 渲染详情
// ============================================================
async function renderDetail(record) {
  if (!record) {
    container.innerHTML = `<div class="state-message"><p>❌ 未找到该记录</p><a href="index.html" class="btn-back">返回列表</a></div>`;
    return;
  }

  const role = await getUserRole();

  // 使用 DETAIL_GROUPS 构建分组
  const groupedFields = buildGroupedFieldsFromConfig(record);

  // 应用角色权限和隐私过滤
  const filteredGroups = groupedFields
    .map(group => ({
      ...group,
      // ★★★ 在过滤前先移除空值字段 ★★★
      fields: group.fields.filter(f => !isEmptyValue(f.value)),
    }))
    .map(group => ({
      ...group,
      fields: filterFieldsByRoleAndPrivacy(group.fields, role, record),
    }))
    .filter(g => g.fields.length > 0);

  const name = getFieldValue(record, 'fqidTsBW5js') || '详情';
  const titleText = `👤 ${name}の档案`;

  // 如果没有任何分组显示，提示用户
  if (filteredGroups.length === 0) {
    console.warn('[detail.js] 没有可显示的字段');
    container.innerHTML = `
      <div class="state-message">
        <p>🔒 当前角色无权查看此档案内容</p>
        <p style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:8px;">角色: ${role}</p>
        <a href="index.html" class="btn-back">返回列表</a>
      </div>
    `;
    return;
  }

  let html = `
    <div class="detail-record">
      <div class="detail-title">${escapeHtml(titleText)}</div>
      <div class="detail-groups">
  `;

  for (const group of filteredGroups) {
    const groupId = group.groupId;
    // 媒体分组特殊处理（生活写照、私密影像）
    if (groupId === 'photos_life' || groupId === 'photos_private') {
      const { portrait, landscape } = await collectAndSortMedia(group.fields);
      const mediaHtml = renderMediaGroup(group.groupTitle, groupId, portrait, landscape);
      if (mediaHtml) {
        html += mediaHtml;
      }
      continue;
    }

    html += `
      <div class="detail-group" data-group="${groupId}">
        <div class="detail-group-title">${escapeHtml(group.groupTitle)}</div>
        <div class="detail-field-grid">
    `;

    group.fields.forEach(({ id, label, value }) => {
      let displayValue = '';
      
      // ★★★ 这里不再需要检查空值，因为前面已经过滤掉了 ★★★
      
      if (isImageValue(value)) {
        const imageUrls = getImageUrls(value);
        if (imageUrls.length === 0) {
          return; // 跳过
        } else if (imageUrls.length === 1) {
          displayValue = `<img src="${escapeHtml(imageUrls[0])}?w=400&h=600&fit=crop" alt="${escapeHtml(label)}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_IMAGE}'" />`;
        } else {
          let imagesHtml = '<div class="image-gallery">';
          imageUrls.forEach((url) => {
            imagesHtml += `<img src="${escapeHtml(url)}?w=400&h=600&fit=crop" alt="${escapeHtml(label)}" loading="lazy" onerror="this.src='${CONFIG.DEFAULT_IMAGE}'" />`;
          });
          imagesHtml += '</div>';
          displayValue = imagesHtml;
        }
      } else if (Array.isArray(value)) {
        displayValue = escapeHtml(value.join(', '));
      } else if (typeof value === 'boolean') {
        displayValue = value ? '是' : '否';
      } else {
        const strValue = String(value);
        if (id === 'f99RpESRNBX' || id === 'fb483ZvPoMH') {
          displayValue = generateStars(strValue);
        } else {
          switch (id) {
            case 'ffcCmCH3kSE':
              displayValue = `${escapeHtml(strValue)} cm`;
              break;
            case 'fgSKHPJhFhb':
              displayValue = `${escapeHtml(strValue)} kg`;
              break;
            case 'ffgthuczFyn':
            case 'fjptYmcfYNC':
            case 'f5Wk3u2aCfh':
              displayValue = `${escapeHtml(strValue)} cm`;
              break;
            default:
              displayValue = escapeHtml(strValue);
          }
        }
      }

      html += `
        <div class="detail-field-item">
          <div class="detail-field-label">${escapeHtml(label)}</div>
          <div class="detail-field-value">${displayValue}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // 挂载全局函数供 onclick 调用
  window.showVideoLightbox = showVideoLightbox;
  window.showLightbox = showLightbox;

  // 为所有图片绑定点击事件（Lightbox）
  container.querySelectorAll('.detail-field-value img').forEach((img) => {
    img.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showLightbox(this.src, this.alt);
    });
  });
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  const id = getRecordIdFromUrl();
  if (!id) {
    container.innerHTML = `<div class="state-message"><p>⚠️ 缺少记录 ID</p><a href="index.html" class="btn-back">返回列表</a></div>`;
    return;
  }

  try {
    container.innerHTML = `<div class="loading-spinner"></div><p>加载详情…</p>`;
    const record = await fetchRecordById(id);
    await renderDetail(record);
  } catch (error) {
    console.error('详情加载失败:', error);
    container.innerHTML = `<div class="state-message"><p>❌ 加载失败：${escapeHtml(error.message)}</p><a href="index.html" class="btn-back">返回列表</a></div>`;
  }
}

init();