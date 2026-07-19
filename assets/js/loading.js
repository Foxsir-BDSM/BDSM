// ================================================================
// assets/js/loading.js
// 功能：全局 Loading 遮罩管理（含超时保护、进度动画）
// 全站统一 Logo：OIP-C.jpg
// ================================================================

let loadingOverlay = null;
let loadingTimeout = null;
let isVisible = false;
let progressInterval = null;

const DEFAULT_TIMEOUT = 10000; // 10 秒强制隐藏

/**
 * 创建 Loading 遮罩 DOM（首次调用时创建，复用）
 */
function createOverlay() {
  if (loadingOverlay) return;

  const overlay = document.createElement('div');
  overlay.id = 'global-loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 8, 12, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: none;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    z-index: 999999;
    color: #d4b896;
    font-family: 'Georgia', 'Inter', -apple-system, serif;
    transition: opacity 0.35s ease;
  `;

  overlay.innerHTML = `
    <div style="text-align: center; max-width: 440px; padding: 24px;">
      <!-- ===== 全站统一 Logo：OIP-C.jpg ===== -->
      <div style="margin-bottom: 16px; animation: pulseGlow 1.8s ease-in-out infinite;">
        <img src="/assets/images/OIP-C.jpg" alt="Foxsir Logo" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(212, 184, 150, 0.2); box-shadow: 0 0 30px rgba(212, 165, 116, 0.1);" />
      </div>
      <div id="loading-text" style="font-size: 22px; font-weight: 500; letter-spacing: 3px; margin-bottom: 10px; color: #e8ddd0;">正在加载</div>
      <div style="width: 100%; height: 2px; background: rgba(212, 184, 150, 0.15); border-radius: 4px; overflow: hidden; margin: 4px 0 12px;">
        <div id="loading-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #d4b896, #f0e0c0, #d4b896); background-size: 200% 100%; border-radius: 4px; transition: width 0.4s ease; animation: shimmer 1.2s linear infinite;"></div>
      </div>
      <div id="loading-sub" style="font-size: 13px; color: rgba(212, 184, 150, 0.5); letter-spacing: 1px;">身份验证中…</div>
      <div id="loading-error" style="display: none; margin-top: 24px;">
        <div style="font-size: 14px; color: #f87171; margin-bottom: 12px;">⏳ 加载超时，请检查网络</div>
        <button id="loading-retry-btn" style="background: rgba(212, 184, 150, 0.15); color: #d4b896; border: 1px solid rgba(212, 184, 150, 0.2); padding: 10px 32px; border-radius: 30px; cursor: pointer; font-size: 14px; font-weight: 500; font-family: inherit; transition: all 0.3s ease; backdrop-filter: blur(4px);">刷新重试</button>
      </div>
    </div>
  `;

  // 注入关键帧动画
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes pulseGlow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.04); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  overlay.appendChild(styleEl);

  document.body.appendChild(overlay);
  loadingOverlay = overlay;

  // 重试按钮
  overlay.querySelector('#loading-retry-btn')?.addEventListener('click', () => {
    window.location.reload();
  });
}

/**
 * 显示 Loading
 * @param {string} text - 主文案
 * @param {string} subText - 副文案
 */
export function showLoading(text = '正在加载', subText = '准备中…') {
  createOverlay();
  const overlay = loadingOverlay;
  const textEl = overlay.querySelector('#loading-text');
  const subEl = overlay.querySelector('#loading-sub');
  const barEl = overlay.querySelector('#loading-bar');
  const errorEl = overlay.querySelector('#loading-error');

  if (textEl) textEl.textContent = text;
  if (subEl) subEl.textContent = subText;
  if (barEl) barEl.style.width = '0%';
  if (errorEl) errorEl.style.display = 'none';

  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
  isVisible = true;

  // 进度条模拟（10 秒内逐步推进）
  if (progressInterval) clearInterval(progressInterval);
  let progress = 0;
  progressInterval = setInterval(() => {
    if (!isVisible) { clearInterval(progressInterval); return; }
    const increment = progress < 60 ? 4 + Math.random() * 6 : (progress < 85 ? 2 + Math.random() * 3 : 0.5 + Math.random() * 1.5);
    progress = Math.min(progress + increment, 95);
    if (barEl) barEl.style.width = progress + '%';
    if (progress >= 95) clearInterval(progressInterval);
  }, 350);

  // 超时保护
  if (loadingTimeout) clearTimeout(loadingTimeout);
  loadingTimeout = setTimeout(() => {
    if (isVisible) {
      hideLoading(true);
    }
  }, DEFAULT_TIMEOUT);
}

/**
 * 更新 Loading 文案
 */
export function updateLoadingText(text, subText) {
  if (!loadingOverlay || !isVisible) return;
  const textEl = loadingOverlay.querySelector('#loading-text');
  const subEl = loadingOverlay.querySelector('#loading-sub');
  if (textEl && text) textEl.textContent = text;
  if (subEl && subText !== undefined) subEl.textContent = subText;
}

/**
 * 隐藏 Loading
 * @param {boolean} showError - true=显示超时错误，false=正常隐藏
 */
export function hideLoading(showError = false) {
  isVisible = false;
  if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }

  if (!loadingOverlay) return;

  if (showError) {
    const errorEl = loadingOverlay.querySelector('#loading-error');
    const barEl = loadingOverlay.querySelector('#loading-bar');
    const textEl = loadingOverlay.querySelector('#loading-text');
    const subEl = loadingOverlay.querySelector('#loading-sub');
    if (errorEl) errorEl.style.display = 'block';
    if (barEl) barEl.style.width = '100%';
    if (textEl) textEl.textContent = '⏳ 加载超时';
    if (subEl) subEl.textContent = '请检查网络连接后重试';
  } else {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }, 350);
  }
}

/**
 * 强制关闭（用于异常场景）
 */
export function forceHideLoading() {
  isVisible = false;
  if (loadingTimeout) clearTimeout(loadingTimeout);
  if (progressInterval) clearInterval(progressInterval);
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
    loadingOverlay.style.opacity = '0';
  }
}