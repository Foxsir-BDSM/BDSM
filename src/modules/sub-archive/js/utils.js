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
  FILTER_FIELDS,
  ARCHIVE_TYPE,
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
// ★★★ 档案归属与筛选（身份 / 取向 / 馆别）★★★
// ------------------------------------------------------------
// 背景：档案表单目前尚未建立「身份」「取向」字段（FILTER_FIELDS 为占位），
// 因此这里做三层降级，保证字段补齐前后都能正常工作：
//
//   层级 1：表单有对应字段 → 直接读取，精确筛选
//   层级 2：无字段但记录归某馆 → 按馆别判定身份（当前 57 字段为女馆 → 女M）
//   层级 3：都判定不出 → 归入「未标注」，默认不过滤掉（避免看到空白）
//
// 表单补齐后，只需在 instances.js 里把 FILTER_FIELDS.*.filloutId 换成真实 ID。
// ============================================================

/** 从文本里宽松识别身份（用于表单字段值可能是「女M」「女m」「M」等情况） */
function parseIdentityText(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const isFemale = /女|female|f(?![a-z])/i.test(s);
  const isMale = /男|male|m(?![a-z])/i.test(s);
  const isTop = /s(?![a-z])|dom|主|上位|攻/i.test(s);
  const isBottom = /m(?![a-z])|sub|奴|下位|受|贝/i.test(s);
  if (!isTop && !isBottom) return null;
  const gender = isFemale ? 'female' : (isMale ? 'male' : null);
  if (!gender) return null;
  return isTop ? `${gender}_S` : `${gender}_M`;
}

/** 从文本里宽松识别取向 */
function parseOrientationText(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/双|bi/i.test(s)) return 'bi';
  if (/未定|不确定|unsure|\?/i.test(s)) return 'unsure';
  if (/异性|hetero|直/i.test(s)) return 'hetero';
  if (/同性|homo|同/i.test(s)) return 'homo';
  return null;
}

/** 馆别 → 默认身份（当前只有女馆；男馆配置好后在此登记） */
const ARCHIVE_TYPE_IDENTITY = {
  female: 'female_M',
  male: 'male_M',
};

/**
 * 解析一条记录的归属
 * @returns {{identity:string|null, orientation:string|null, source:string, archiveType:string}}
 */
export function getRecordAffiliation(record) {
  const idField = FILTER_FIELDS?.identity?.filloutId;
  const orField = FILTER_FIELDS?.orientation?.filloutId;

  let identity = idField ? parseIdentityText(getFieldValue(record, idField)) : null;
  let orientation = orField ? parseOrientationText(getFieldValue(record, orField)) : null;
  let source = 'form';

  if (!identity) {
    identity = ARCHIVE_TYPE_IDENTITY[ARCHIVE_TYPE] || null;
    source = identity ? 'archiveType' : 'unknown';
  }
  if (!orientation) source = source === 'form' ? 'form-no-orientation' : source;

  return { identity, orientation, source, archiveType: ARCHIVE_TYPE };
}

/** 记录的身份拆分：位置 + 性别 */
export function getRecordPositionGender(record) {
  const { identity } = getRecordAffiliation(record);
  if (!identity) return { position: null, gender: null, identity: null };
  const [gender, pos] = identity.split('_');
  return { position: pos === 'S' ? 'top' : 'bottom', gender, identity };
}

/**
 * 判断记录的身份是否来自真实表单字段（而非馆别推测）
 * 用于决定「位置筛选」是否可信
 */
export function hasRealIdentityData(records) {
  if (!records || !records.length) return false;
  const idField = FILTER_FIELDS?.identity?.filloutId;
  if (!idField) return false;
  return records.some((r) => !!parseIdentityText(getFieldValue(r, idField)));
}

/**
 * 按「访问者身份 + 取向」过滤记录
 *
 * 重要：位置筛选只在「档案带真实身份数据」时生效。
 * 原因：当身份来自馆别推测（单馆状态）时，位置维度没有区分度，
 *       若仍按其过滤，会出现「女M 看女馆 → 位置为上位者 → 空列表」的糟糕体验。
 *       表单补齐身份字段后，本函数自动启用位置筛选。
 *
 * @param {Array} records 记录数组
 * @param {{position:string|null, gender:string|null}} filter deriveArchiveFilter() 的结果
 * @returns {Array} 过滤后的记录（未标注的记录默认保留）
 */
export function filterRecordsByAffiliation(records, filter) {
  if (!filter || (!filter.position && !filter.gender)) return records;

  const trustPosition = hasRealIdentityData(records);
  const wantPosition = trustPosition ? filter.position : null;
  const wantGender = filter.gender;

  const apply = (pos, gen) => records.filter((r) => {
    const { position, gender } = getRecordPositionGender(r);
    // 判定不出归属 → 保留（避免因字段缺失造成空白）
    if (!position && !gender) return true;
    if (pos && position && position !== pos) return false;
    if (gen && gender && gender !== gen) return false;
    return true;
  });

  let out = apply(wantPosition, wantGender);

  // ★ 兜底：默认筛选绝不能把列表清空
  //   场景：女M+异性 → 找男性，但当前只有女馆 → 性别筛掉全部。
  //   此时放宽性别限制，改为「只按身份」，让用户先看到内容，再由筛选条自行收窄。
  if (out.length === 0) {
    const relaxed = apply(wantPosition, null);
    if (relaxed.length > 0) return relaxed;
  }
  return out;
}

/** 统计各归属的记录数（用于筛选条上的计数显示） */
export function countByAffiliation(records) {
  const out = { total: records.length, male: 0, female: 0, top: 0, bottom: 0, unknown: 0 };
  for (const r of records) {
    const { position, gender } = getRecordPositionGender(r);
    if (!position && !gender) { out.unknown++; continue; }
    if (gender === 'male') out.male++;
    if (gender === 'female') out.female++;
    if (position === 'top') out.top++;
    if (position === 'bottom') out.bottom++;
  }
  return out;
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