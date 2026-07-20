import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{g as d}from"./assets_js_registry.js-B-4mUpcU.js";import{g as p}from"./assets_js_auth.js-DwBsfD0Z.js";import{g as m}from"./assets_js_identity.js-BoUU-mI8.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_supabase-client.js-DmiGq-Dk.js";import"./assets_js_request.js-BophGKQa.js";const g=new URLSearchParams(window.location.search),e=g.get("id"),n=document.getElementById("moduleDetail");async function f(){if(!e){n.innerHTML='<p style="color:rgba(255,255,255,0.3);">未指定模块</p>';return}const i=await m(),a=d(i).find(l=>l.id===e);if(!a){n.innerHTML='<p style="color:rgba(255,255,255,0.3);">模块不存在或暂无权限查看</p>';return}const t=!!await p(),o=a.status==="maintenance",r=a.status==="offline";let s="";o?s='<div class="status-badge maintenance">🔧 维护中</div>':r&&(s='<div class="status-badge" style="background:rgba(239,68,68,0.06);color:#ef4444;">⛔ 暂不可用</div>');const c=t?`<a href="${a.url}" class="btn btn-primary">进入 ${a.name}</a>`:`<a href="/landing.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}" class="btn btn-primary">登录后解锁</a>
           <a href="/landing.html" class="btn btn-secondary">返回首页</a>`;n.innerHTML=`
        <a href="/landing.html#modules-section" class="back-link">← 返回探索</a>
        <span class="icon-big">${a.icon||"📦"}</span>
        ${s}
        <h1>${a.name}</h1>
        <div class="sub">${a.id}</div>
        <p class="desc">${a.description||"该模块正在建设中，敬请期待。"}</p>
        <div class="features">
          <span class="tag">🔒 私密内容</span>
          <span class="tag">⚡ 实时互动</span>
          <span class="tag">📜 档案沉淀</span>
        </div>
        <div class="cta-area">
          ${c}
        </div>
        ${t?"":'<p style="font-size:12px;color:rgba(255,255,255,0.1);margin-top:16px;">登录后可解锁完整功能</p>'}
      `}f();
