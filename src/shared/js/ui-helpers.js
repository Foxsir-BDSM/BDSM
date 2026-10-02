// 显示提示消息
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.background = type === 'error' ? '#b22222' : '#4a6fa5';
  toast.style.color = '#fff';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  toast.style.zIndex = '9999';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// 显示加载中
export function showLoading(container) {
  container.innerHTML = '<p style="color:#94a3b8;">加载中...</p>';
}
