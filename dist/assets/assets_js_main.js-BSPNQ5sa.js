import{o as y,s as v,a as B,b as f}from"./assets_js_auth.js-BCXhz0hh.js";import{a as h,g as E}from"./assets_js_identity.js-bxn2ZtHW.js";import{r as I}from"./assets_js_launcher.js-CK3rn-27.js";import{s}from"./assets_js_ui-helpers.js-CEBwo3Z9.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";import"./assets_js_registry.js-B-4mUpcU.js";const w={guest:"访客",self:"普通用户",verified:"已认证用户",subadmin:"次级管理",admin:"根源管理"},b=document.getElementById("userSection"),A=document.getElementById("projectGrid");async function L(){const a=await h(),r=await E();if(!a)b.innerHTML=`
      <div class="guest-actions">
        <span class="user-info">👤 游客模式</span>
        <div>
          <button id="loginBtn" class="btn">登录</button>
          <button id="registerBtn" class="btn btn-outline">注册</button>
        </div>
      </div>
      <div id="authFormContainer" style="margin-top: 1rem; display: none;">
        <form id="authForm">
          <input type="email" id="emailInput" placeholder="邮箱" required autocomplete="email">
          <input type="password" id="passwordInput" placeholder="密码（至少6位）" required autocomplete="current-password">
          <button type="submit" class="btn" id="authSubmitBtn">提交</button>
          <button type="button" class="btn btn-outline" id="cancelAuthBtn">取消</button>
        </form>
      </div>
    `;else{const l=a.email,o=a.user_metadata?.avatar_url||"👤",t=w[r]||r,e=["admin","subadmin"].includes(r)?'<a href="/admin.html" class="btn btn-outline">⚙️ 管理面板</a>':"";b.innerHTML=`
      <div class="user-info">
        <div class="avatar">${o}</div>
        <div>
          <strong>${l}</strong>
          <span style="font-size:0.8rem; color:#64748b; margin-left:0.5rem;">角色: ${t}</span>
        </div>
      </div>
      <div class="user-actions">
        ${e}
        <button id="logoutBtn" class="btn btn-danger">登出</button>
      </div>
    `,document.getElementById("logoutBtn")?.addEventListener("click",async()=>{await v(),s("已登出"),i()})}const c=document.getElementById("loginBtn"),m=document.getElementById("registerBtn"),d=document.getElementById("authFormContainer"),p=document.getElementById("cancelAuthBtn"),n=document.getElementById("authForm"),g=document.getElementById("authSubmitBtn");c&&c.addEventListener("click",()=>{d.style.display="block",g.textContent="登录",n.dataset.mode="login"}),m&&m.addEventListener("click",()=>{d.style.display="block",g.textContent="注册",n.dataset.mode="register"}),p&&p.addEventListener("click",()=>{d.style.display="none"}),n&&n.addEventListener("submit",async l=>{l.preventDefault();const o=document.getElementById("emailInput").value.trim(),t=document.getElementById("passwordInput").value.trim(),u=n.dataset.mode;if(!o||!t){s("请输入邮箱和密码","error");return}if(t.length<6){s("密码至少6位","error");return}let e;u==="login"?e=await B(o,t):e=await f(o,t),e.error?s("操作失败: "+e.error.message,"error"):(s(u==="login"?"登录成功":"注册成功，请查收验证邮件（若需）"),d.style.display="none",i())})}async function i(){await L(),await I(A)}y((a,r)=>{i()});i();window.renderAll=i;
