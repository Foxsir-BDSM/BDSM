import{g as i}from"./assets_js_registry.js-B-4mUpcU.js";import{g as t}from"./assets_js_identity.js-bxn2ZtHW.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_request.js-BophGKQa.js";async function d(n){const e=await t(),s=i(e);if(s.length===0){n.innerHTML='<p style="color:#94a3b8;">当前没有可访问的项目，请稍后查看。</p>';return}n.innerHTML=s.map(a=>`
    <div class="project-card" data-status="${a.status}">
      <div class="icon">${a.icon||"📦"}</div>
      <h3>${a.name}</h3>
      <p>${a.description}</p>
      ${a.status==="maintenance"?'<span class="badge badge-maintenance">维护中</span>':""}
      <a href="${a.url}" class="enter-btn" 
         ${a.status==="maintenance"?'onclick="return false;"':""}>
         进入
      </a>
    </div>
  `).join("")}export{d as r};
