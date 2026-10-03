// ================================================================
// assets/js/content-config.js
// 配置：GitHub 内容仓库信息
// ================================================================

const OWNER = 'Foxsir-BDSM';
const REPO = 'foxsir-content';

export const CONTENT_CONFIG = {
  owner: OWNER,
  repo: REPO,
  
  branches: {
    // ★ 欲炼之途（统一内容板块）—— 当前唯一在用的分支
    content: 'content',
    // 以下为旧板块留档分支，代码已不再引用，保留配置便于日后取回
    knowledge: 'knowledge',
    tasks: 'tasks'
  },
  
  paths: {
    content: 'posts',
    knowledge: 'articles',
    tasks: 'tasks'
  },
  
  // 前台 CDN 读取地址（公开仓库可用，速度快）
  getCdnUrl: (branch, filePath) => {
    return `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${branch}/${filePath}`;
  },
  
  // 管理后台 GitHub API 地址
  getApiUrl: (branch, filePath) => {
    return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${branch}`;
  }
};