// 职责    档案馆通用工具：字段取值、卡片信息提取、归属解析与筛选、计数、媒体收集、隐私判定辅助。
// 归属页面 档案列表页、档案详情页
// 依赖    config.js
// 被依赖   home.js、detail.js
//
// 维护提示
//   · ★ getFieldValue() 同时兼容 record.data 与 record.fields 两种结构 —— 换数据源导致 API 返回结构变化时，这里是第一道防线。
//   · 归属筛选会把「未标注身份」的记录一律保留，不会因筛选而丢数据。
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
  VISIBILITY_FIELDS,
  PRIVACY_CONTROL_IDS,
  getFieldsFor,
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
  const privacyValue = getFieldValue(record, PRIVACY_CONTROL_IDS.lifePhotos);
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

/**
 * 卡片信息（按 FIELD_VISIBILITY.home_card 的字段集）
 * 说明：旧库的「推荐指数」已随迁移移除，故不再返回 recommend。
 *       受隐私开关控制的字段（常住地址）未公开时返回「未公开」。
 */
export function getCardInfo(record) {
  const areaPrivacy = getFieldValue(record, PRIVACY_CONTROL_IDS.address);
  const areaValue = isPrivacyApproved(areaPrivacy)
    ? getFieldValue(record, CARD_FIELDS.area) || ''
    : '未公开';
  return {
    area: typeof areaValue === 'string' ? areaValue : String(areaValue || ''),
    height: String(getFieldValue(record, CARD_FIELDS.height) || ''),
    weight: String(getFieldValue(record, CARD_FIELDS.weight) || ''),
    verified: getFieldValue(record, CARD_FIELDS.verified),   // 首页认证标签
  };
}

// ============================================================
// ★★★ 档案归属与筛选（按身份）★★★
// ------------------------------------------------------------
// 统一档案库不再区分馆别：每条记录的身份由表单的「身份」字段标明。
//
// 字段尚未建立时（FILTER_FIELDS 为占位），做两层降级：
//
//   层级 1：表单有「身份」字段 → 直接读取，精确筛选
//   层级 2：无字段 → 归属未知，默认不过滤掉（避免看到空白）
//
// 与旧版差异：删除了「按馆别推测身份」这一层。
// 档案已合并为单一库，馆别概念不存在，因此不再做任何推测；
// 表单补齐身份字段后，筛选立即生效。
// ============================================================

/** 从文本里宽松识别身份（容错「女M」「女m」「M」「female_M」等写法） */
function parseIdentityText(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const isFemale = /女|female/i.test(s);
  const isMale = /男|male/i.test(s);
  const isTop = /S(?!ub)/i.test(s) || /dom|主|上位|攻/i.test(s);
  const isBottom = /M(?!ale)/i.test(s) || /sub|奴|下位|受|贝/i.test(s);
  if (!isTop && !isBottom) return null;
  const gender = isFemale ? 'female' : (isMale ? 'male' : null);
  if (!gender) return null;
  return isTop ? `${gender}_S` : `${gender}_M`;
}

/**
 * 解析一条记录的归属
 * 说明：取向维度已取消（2026-10-04），归属仅看身份
 * @returns {{identity:string|null, source:string}}
 *   source: 'form' 表示来自表单字段；'unknown' 表示字段缺失、无法判定
 */
export function getRecordAffiliation(record) {
  const idField = FILTER_FIELDS?.identity?.filloutId;
  const identity = idField ? parseIdentityText(getFieldValue(record, idField)) : null;

  return {
    identity,
    source: identity ? 'form' : 'unknown',
  };
}

/** 记录的身份拆分：位置 + 性别 */
export function getRecordPositionGender(record) {
  const { identity } = getRecordAffiliation(record);
  if (!identity) return { position: null, gender: null, identity: null };
  const [gender, pos] = identity.split('_');
  return { position: pos === 'S' ? 'top' : 'bottom', gender, identity };
}

/**
 * 判断记录的身份是否来自真实表单字段
 * 用于决定「身份筛选」是否可信 —— 字段未建时应明示不可用而非静默失效
 */
export function hasRealIdentityData(records) {
  if (!records || !records.length) return false;
  const idField = FILTER_FIELDS?.identity?.filloutId;
  if (!idField) return false;
  return records.some((r) => !!parseIdentityText(getFieldValue(r, idField)));
}

/**
 * 按「访问者身份」过滤记录
 *
 * 身份筛选（位置 + 性别）只在档案带真实身份字段时生效。
 * 字段未建时不按身份过滤，避免出现空白页；
 * 界面上会明确提示「档案尚未填写身份字段」。
 *
 * @param {Array} records 记录数组
 * @param {{position:string|null, gender:string|null}} filter deriveArchiveFilter() 的结果
 * @returns {Array} 过滤后的记录（归属未知的记录默认保留）
 */
export function filterRecordsByAffiliation(records, filter) {
  if (!filter || (!filter.position && !filter.gender)) return records;

  const trust = hasRealIdentityData(records);
  const wantPosition = trust ? filter.position : null;
  const wantGender = trust ? filter.gender : null;

  const apply = (pos, gen) => records.filter((r) => {
    const { position, gender } = getRecordPositionGender(r);
    // 归属未知 → 保留（避免因字段缺失造成空白）
    if (!position && !gender) return true;
    if (pos && position && position !== pos) return false;
    if (gen && gender && gender !== gen) return false;
    return true;
  });

  const out = apply(wantPosition, wantGender);

  // ★ 兜底：默认筛选绝不能把列表清空
  //   若筛选后为空，放宽为「只按位置」，让用户先看到内容，再由筛选条自行收窄。
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
// ★★★ 详情页字段过滤（可见性白名单 + 隐私开关）★★★
// ------------------------------------------------------------
// 两层过滤，是「与」的关系：
//
//   第一层 · 可见性白名单
//     字段必须登记在 FIELD_VISIBILITY.detail 内才会出现在详情页。
//     想加字段 → 改 fields.js 的 FIELD_VISIBILITY.detail 即可。
//
//   第二层 · 隐私开关（5 个）
//     受控字段的开关不为 true 时隐藏，**对所有角色生效，包括管理员**。
//     依据：是否公开是用户的私人选择，不是权限层级问题。
//
// 返回按分组与白名单双重过滤后的字段列表。
// ============================================================
export function getVisibleDetailFields(fields, role, record) {
  // 可见性白名单：详情页只认这一份
  const allowed = new Set(getFieldsFor('detail'));
  // 角色白名单（当前配置为「一视同仁」，保留以支持后续按角色收紧）
  const roleAllowed = ROLE_FIELD_VISIBILITY[role] || ROLE_FIELD_VISIBILITY.guest;
  const isAdmin = role === 'admin';

  return fields.filter((field) => {
    // 第一层 A：必须登记在详情页白名单内
    if (!allowed.has(field.id)) return false;

    // 第一层 B：角色白名单（管理员不受限）
    if (!isAdmin && roleAllowed !== '*' && !roleAllowed.includes(field.id)) {
      return false;
    }

    // 第二层：隐私开关 —— 未公开则连管理员也看不到
    const controlId = PRIVACY_DEPENDENCIES[field.id];
    if (controlId) {
      const controlValue = getFieldValue(record, controlId);
      if (controlValue !== true) return false;
    }

    return true;
  });
}

/** @deprecated 旧名，保留兼容；请改用 getVisibleDetailFields */
export const filterFieldsByRoleAndPrivacy = getVisibleDetailFields;