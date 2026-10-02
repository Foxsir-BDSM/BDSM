import {
  CONFIG,
  SYSTEM_FIELD_IDS,
  FIELD_LABELS,
  CARD_FIELDS,
  HOME_ONLY_FIELD_IDS,
  PRIVACY_RULES,
  isPrivacyApproved,
  EXTRA_EXCLUDED_FIELD_IDS,
  ROLE_FIELD_VISIBILITY,
  PRIVACY_DEPENDENCIES,
  DETAIL_GROUPS,
} from './config.js';

// ============================================================
// 基础取值函数
// ============================================================
export function getFieldValue(record, fieldId) {
  if (!record) return null;
  if (record.data && record.data[fieldId] !== undefined) {
    return record.data[fieldId];
  }
  if (record.fields && record.fields[fieldId] !== undefined) {
    return record.fields[fieldId];
  }
  return null;
}

// ============================================================
// 提取单个附件URL
// ============================================================
export function extractFileUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (Array.isArray(value) && value.length > 0) {
    return extractFileUrl(value[0]);
  }
  if (typeof value === 'object' && value !== null) {
    if (value.url && typeof value.url === 'string') {
      return value.url.trim() || null;
    }
    if (value.text && typeof value.text === 'string') {
      return value.text.trim() || null;
    }
    if (value.name && typeof value.name === 'string') {
      return value.name.trim() || null;
    }
  }
  return null;
}

// ============================================================
// 提取所有附件URL（返回数组）
// ============================================================
export function extractFileUrls(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    const results = [];
    for (const item of value) {
      const urls = extractFileUrls(item);
      results.push(...urls);
    }
    return results;
  }
  if (typeof value === 'object' && value !== null) {
    if (value.url && typeof value.url === 'string') {
      const trimmed = value.url.trim();
      return trimmed ? [trimmed] : [];
    }
    if (value.text && typeof value.text === 'string') {
      const trimmed = value.text.trim();
      return trimmed ? [trimmed] : [];
    }
    if (value.name && typeof value.name === 'string') {
      const trimmed = value.name.trim();
      return trimmed ? [trimmed] : [];
    }
  }
  return [];
}

// ============================================================
// 工具：判断值是否为空
// ============================================================
function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

// ============================================================
// 首页卡片专用函数
// ============================================================
export function getCardImage(record) {
  const privacyValue = getFieldValue(record, 'fgtX9QmBAM5');
  if (!isPrivacyApproved(privacyValue)) {
    return CONFIG.DEFAULT_IMAGE;
  }
  const photo = getFieldValue(record, CARD_FIELDS.photo);
  const url = extractFileUrl(photo);
  if (url) return url;
  const fallback = getFieldValue(record, CARD_FIELDS.photoFallback);
  const fallbackUrl = extractFileUrl(fallback);
  if (fallbackUrl) return fallbackUrl;
  return CONFIG.DEFAULT_IMAGE;
}

export function getCardName(record) {
  const name = getFieldValue(record, CARD_FIELDS.name);
  if (typeof name === 'string' && name.trim() !== '') return name;
  const fallback = getFieldValue(record, CARD_FIELDS.nameFallback);
  if (typeof fallback === 'string' && fallback.trim() !== '') return fallback;
  if (name && typeof name === 'object' && name.name) return name.name;
  return '未命名';
}

export function getCardAge(record) {
  const age = getFieldValue(record, CARD_FIELDS.age);
  if (age === null || age === undefined) return '';
  return String(age);
}

export function getCardInfo(record) {
  const areaPrivacy = getFieldValue(record, 'f1s9DJg4oLc');
  const areaValue = isPrivacyApproved(areaPrivacy)
    ? getFieldValue(record, CARD_FIELDS.area) || ''
    : '未公开';
  return {
    area: typeof areaValue === 'string' ? areaValue : String(areaValue || ''),
    height: String(getFieldValue(record, CARD_FIELDS.height) || ''),
    weight: String(getFieldValue(record, CARD_FIELDS.weight) || ''),
    recommend: String(getFieldValue(record, CARD_FIELDS.recommend) || ''),
    verified: getFieldValue(record, CARD_FIELDS.verified),
  };
}

// ============================================================
// 图片类型判断（支持多图数组）
// ============================================================
export function isImageValue(value) {
  if (!value) return false;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isImageValue(item)) return true;
    }
    return false;
  }
  const url = extractFileUrl(value);
  if (!url) return false;
  return /^https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(url);
}

// ============================================================
// 获取图片URL数组
// ============================================================
export function getImageUrls(value) {
  return extractFileUrls(value);
}

// ============================================================
// 详情页字段获取（包含隐私控制）
// ============================================================
export function getBusinessFields(record) {
  const data = record.data || record.fields || {};

  const systemIds = Array.isArray(SYSTEM_FIELD_IDS) ? Object.keys(SYSTEM_FIELD_IDS) : [];
  const homeIds = Array.isArray(HOME_ONLY_FIELD_IDS) ? HOME_ONLY_FIELD_IDS : [];
  const excludeIds = [...systemIds, ...homeIds];
  const extraExcluded = Array.isArray(EXTRA_EXCLUDED_FIELD_IDS) ? EXTRA_EXCLUDED_FIELD_IDS : [];
  const privacyRules = Array.isArray(PRIVACY_RULES) ? PRIVACY_RULES : [];

  const privacyStatus = {};
  privacyRules.forEach((rule) => {
    const controlValue = data[rule.controlId];
    privacyStatus[rule.controlId] = isPrivacyApproved(controlValue);
  });

  const allowedDisplayIds = new Set();
  privacyRules.forEach((rule) => {
    if (privacyStatus[rule.controlId]) {
      rule.displayIds.forEach((id) => allowedDisplayIds.add(id));
    }
  });

  const fieldMap = {};
  for (const [id, value] of Object.entries(data)) {
    if (excludeIds.includes(id)) continue;
    if (extraExcluded.includes(id)) continue;
    const isControlField = privacyRules.some((rule) => rule.controlId === id);
    if (isControlField) continue;
    const isDisplayField = privacyRules.some((rule) => rule.displayIds.includes(id));
    if (isDisplayField && !allowedDisplayIds.has(id)) continue;
    if (isEmptyValue(value)) continue;
    const label = FIELD_LABELS[id];
    if (label === undefined) continue;
    fieldMap[id] = { id, label, value };
  }

  const result = [];
  const usedIds = new Set();

  const detailGroups = Array.isArray(DETAIL_GROUPS) ? DETAIL_GROUPS : [];
  detailGroups.forEach((group) => {
    const fields = Array.isArray(group.fields) ? group.fields : [];
    fields.forEach((fieldId) => {
      if (fieldMap[fieldId]) {
        result.push(fieldMap[fieldId]);
        usedIds.add(fieldId);
      }
    });
  });

  for (const [id, field] of Object.entries(fieldMap)) {
    if (!usedIds.has(id)) {
      result.push(field);
      usedIds.add(id);
    }
  }

  return result;
}

// ============================================================
// 获取分组后的业务字段
// ============================================================
export function getGroupedBusinessFields(record) {
  const allFields = getBusinessFields(record);

  const fieldMap = {};
  allFields.forEach((field) => {
    fieldMap[field.id] = field;
  });

  const groupedResult = [];
  const usedFieldIds = new Set();

  const detailGroups = Array.isArray(DETAIL_GROUPS) ? DETAIL_GROUPS : [];
  detailGroups.forEach((group) => {
    const groupFields = [];
    const fields = Array.isArray(group.fields) ? group.fields : [];
    fields.forEach((fieldId) => {
      if (fieldMap[fieldId]) {
        groupFields.push(fieldMap[fieldId]);
        usedFieldIds.add(fieldId);
      }
    });
    if (groupFields.length > 0) {
      groupedResult.push({
        groupId: group.id,
        groupTitle: group.title,
        fields: groupFields,
      });
    }
  });

  const orphanFields = [];
  allFields.forEach((field) => {
    if (!usedFieldIds.has(field.id)) {
      orphanFields.push(field);
    }
  });
  if (orphanFields.length > 0) {
    groupedResult.push({
      groupId: 'other',
      groupTitle: '📎 其他信息',
      fields: orphanFields,
    });
  }

  return groupedResult;
}

// ============================================================
// 按角色过滤字段（保留兼容）
// ============================================================
export function filterFieldsByRole(fields, role) {
  const allowedIds = ROLE_FIELD_VISIBILITY[role] || ROLE_FIELD_VISIBILITY.guest;
  const allowedSet = new Set(allowedIds);
  return fields.filter((f) => allowedSet.has(f.id));
}

// ============================================================
// ★★★ 修复：按角色 + 隐私控制过滤字段 ★★★
// 隐私控制对所有角色生效，包括管理员
// ============================================================
export function filterFieldsByRoleAndPrivacy(fields, role, record) {
  // 1. 角色权限检查（admin 可查看所有字段）
  const allowedIds = ROLE_FIELD_VISIBILITY[role] || ROLE_FIELD_VISIBILITY.guest;
  const isAdmin = role === 'admin';

  return fields.filter((field) => {
    // 2. 如果非管理员，按角色白名单过滤
    if (!isAdmin && allowedIds !== '*' && !allowedIds.includes(field.id)) {
      return false;
    }

    // 3. ★★★ 核心修复：隐私控制检查（所有角色都生效） ★★★
    const depControlId = PRIVACY_DEPENDENCIES[field.id];
    if (depControlId) {
      // 获取控制字段的值
      const controlValue = record?.fields?.[depControlId] || record?.data?.[depControlId];
      // 只有控制字段为 true 时，才显示受控字段
      if (controlValue !== true) {
        return false; // 用户未公开，即使是管理员也不显示
      }
    }

    return true;
  });
}