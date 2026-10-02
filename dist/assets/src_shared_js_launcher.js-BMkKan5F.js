import{g as i}from"./src_shared_js_registry.js-Qvna3JrO.js";import{g as t}from"./src_shared_js_identity.js-DN2yExvZ.js";import"./src_shared_js_config.js-tFVY60rS.js";import"./src_shared_js_supabase-client.js-DHt-ePtr.js";import"./src_shared_js_request.js-BophGKQa.js";async function d(n){const e=await t(),s=i(e);if(s.length===0){n.innerHTML='<p style="color:#94a3b8;">当前没有可访问的项目，请稍后查看。</p>';return}n.innerHTML=s.map(a=>`
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
