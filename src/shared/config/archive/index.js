// 职责    档案馆配置的统一导出入口（re-export schema 与 instances）。
// 归属页面 （无）
// 依赖    archive/schema.js、archive/instances.js
// 被依赖   无
//
// 维护提示
//   · ⚠️ 当前没有任何文件引用本文件（消费方都直连 instances.js）。保留作兼容，确认无用后可删。
export * from './schema.js';
export * from './instances.js';