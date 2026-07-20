import"./modulepreload-polyfill-B5Qt9EMX.js";import{s as b,u as $,h as I}from"./assets_js_loading.js-BK0rGq7M.js";import{i as A}from"./assets_js_guard.js-DhVcGFdM.js";import{o as E,g as B,d as U,s as C}from"./assets_js_auth.js-BCXhz0hh.js";import{g as y}from"./assets_js_identity.js-bxn2ZtHW.js";import{g as H}from"./assets_js_registry.js-B-4mUpcU.js";import{c as M}from"./assets_js_level.js-C5bKf6bs.js";import{u as k}from"./assets_js_avatar.js-2sGlJM3R.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";b("唤醒欲研所","连接安全通道…");setTimeout(()=>$("正在准备庄园","加载你的专属空间"),1500);window.addEventListener("load",()=>setTimeout(()=>I(!1),300));setTimeout(()=>$("加载中，请稍候","网络较慢时可能需要多等一会"),5e3);A();const v=document.getElementById("topUserInfo"),p=document.getElementById("projectGrid"),P=document.getElementById("toastContainer");function i(e,a="info"){const n=document.createElement("div");n.className=`toast ${a}`,n.innerHTML=`<span class="toast-icon">${a==="error"?"✕":"✓"}</span> ${e}`,P.appendChild(n),setTimeout(()=>{n.classList.add("toast-out"),setTimeout(()=>n.remove(),300)},2800)}function h(e){if(!e)return null;const a=e.user_metadata?.nickname;return a&&a.trim()?a.trim():e.email}function W(e){const a=h(e);if(!a)return"👤";const n=a.charAt(0).toUpperCase();return/[A-Za-z]/.test(n)?n:"👤"}function x(){return window.innerWidth<=480}async function z(){const e=await B(),a=await y();if(!e){v.innerHTML=`
            <span class="guest-label">👤 未登录</span>
          `;return}const n=await U(),t=h(e),o=e.id,s=n?.avatarUrl||null,L=W(e);let d="";s?d=`<img src="${s}" alt="${t}" />`:d=`<span class="avatar-letter">${L}</span>`;let m="";if(n&&n.primaryId){const u=e.user_metadata?.points??0;m=`<span class="level-title">${M(n.primaryId,u).title}</span>`}else m='<span class="no-identity">—</span>';const T=["admin","subadmin"].includes(a)?'<a href="/admin.html" class="btn btn-secondary">⚙️ 管理</a>':"";v.innerHTML=`
          <div class="avatar-wrapper" id="topAvatarWrapper">
            ${d}
            <input type="file" id="topAvatarInput" accept="image/*" style="display:none;" />
          </div>
          <span class="uname">${t}</span>
          ${m}
          ${T}
          <button id="topLogoutBtn" class="btn btn-danger">登出</button>
        `;const g=document.getElementById("topAvatarWrapper"),r=document.getElementById("topAvatarInput");g&&r&&(g.addEventListener("click",()=>{r.click()}),r.addEventListener("change",async u=>{const l=u.target.files[0];if(l){if(!l.type.startsWith("image/")){i("请选择图片文件","error"),r.value="";return}if(l.size>5*1024*1024){i("图片大小请勿超过 5MB","error"),r.value="";return}try{i("上传中...","info");const c=await k(l,o);c.error?i("上传失败: "+c.error.message,"error"):(i("头像更新成功 🎉","success"),setTimeout(()=>f(),300))}catch(c){i("上传异常: "+c.message,"error")}finally{r.value=""}}})),document.getElementById("topLogoutBtn")?.addEventListener("click",async()=>{await C()})}async function w(){const e=await y(),a=H(e),n=x();if(a.length===0){p.innerHTML='<p style="color:rgba(255,255,255,0.2);grid-column:1/-1;text-align:center;padding:40px 0;">暂无可用项目</p>';return}n?p.innerHTML=a.map(t=>{const o=t.status==="maintenance"?"maintenance":"",s=t.status==="offline"||t.status==="maintenance";return`
              <a href="${t.url}" class="project-card ${s?"disabled":""}">
                ${t.status==="maintenance"?`<span class="status-tag ${o}">维护中</span>`:""}
                <div class="icon-wrap">${t.icon||"📦"}</div>
                <div class="text-group">
                  <h3>${t.name}</h3>
                  <p>${t.description}</p>
                </div>
                <span class="enter-hint">${s?"暂不可用":">"}</span>
              </a>
            `}).join(""):p.innerHTML=a.map(t=>{const o=t.status==="maintenance"?"maintenance":"",s=t.status==="offline"||t.status==="maintenance";return`
              <a href="${t.url}" class="project-card ${s?"disabled":""}">
                <span class="status-tag ${o}">${t.status==="maintenance"?"维护中":""}</span>
                <div class="icon-wrap">${t.icon||"📦"}</div>
                <h3>${t.name}</h3>
                <p>${t.description}</p>
                <span class="enter-hint">${s?"暂不可用":"进入"}</span>
              </a>
            `}).join("")}async function f(){try{await Promise.race([Promise.all([z(),w()]),new Promise((e,a)=>setTimeout(()=>a(new Error("数据加载超时")),8e3))])}catch(e){console.warn("renderAll 超时或失败:",e)}}window.addEventListener("resize",()=>w());E(()=>f());f();window.showToast=i;
