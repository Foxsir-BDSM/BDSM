let t=null,a=null,d=!1,r=null;const u=1e4;function f(){if(t)return;const e=document.createElement("div");e.id="global-loading-overlay",e.style.cssText=`
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
  `,e.innerHTML=`
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
  `;const o=document.createElement("style");o.textContent=`
    @keyframes pulseGlow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.04); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,e.appendChild(o),document.body.appendChild(e),t=e,e.querySelector("#loading-retry-btn")?.addEventListener("click",()=>{window.location.reload()})}function b(e="正在加载",o="准备中…"){f();const i=t,n=i.querySelector("#loading-text"),s=i.querySelector("#loading-sub"),c=i.querySelector("#loading-bar"),p=i.querySelector("#loading-error");n&&(n.textContent=e),s&&(s.textContent=o),c&&(c.style.width="0%"),p&&(p.style.display="none"),i.style.display="flex",i.style.opacity="1",d=!0,r&&clearInterval(r);let l=0;r=setInterval(()=>{if(!d){clearInterval(r);return}const g=l<60?4+Math.random()*6:l<85?2+Math.random()*3:.5+Math.random()*1.5;l=Math.min(l+g,95),c&&(c.style.width=l+"%"),l>=95&&clearInterval(r)},350),a&&clearTimeout(a),a=setTimeout(()=>{d&&y(!0)},u)}function x(e,o){if(!t||!d)return;const i=t.querySelector("#loading-text"),n=t.querySelector("#loading-sub");i&&e&&(i.textContent=e),n&&o!==void 0&&(n.textContent=o)}function y(e=!1){if(d=!1,a&&(clearTimeout(a),a=null),r&&(clearInterval(r),r=null),!!t)if(e){const o=t.querySelector("#loading-error"),i=t.querySelector("#loading-bar"),n=t.querySelector("#loading-text"),s=t.querySelector("#loading-sub");o&&(o.style.display="block"),i&&(i.style.width="100%"),n&&(n.textContent="⏳ 加载超时"),s&&(s.textContent="请检查网络连接后重试")}else t.style.opacity="0",setTimeout(()=>{t&&(t.style.display="none")},350)}export{y as h,b as s,x as u};
