const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/assets_js_supabase-client.js-CF0gWE4d.js","assets/assets_js_config.js-Bq3EMvTC.js","assets/assets_js_request.js-BophGKQa.js"])))=>i.map(i=>d[i]);
import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{_ as y}from"./preload-helper-CLcXU_4U.js";import{C as _}from"./assets_js_content-config.js-Bq1Nvs_5.js";import{g as $}from"./assets_js_auth.js-CORIovx3.js";import{s as k,h as w}from"./assets_js_loading.js-BK0rGq7M.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const x=new URLSearchParams(window.location.search),f=x.get("slug"),g=document.getElementById("taskContent");if(!f)throw g.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定任务</p></div>',new Error("No slug");let l=null,e=null,v=!1;function T(){const s=localStorage.getItem("foxsir_github_token");return s&&s.length>10?s:null}async function E(s){const u=_.branches.tasks,d=_.paths.tasks,m=_.getApiUrl(u,d),r=T();if(!r)throw new Error("未配置 GitHub Token");try{const n=await fetch(m,{headers:{Authorization:`token ${r}`}});if(!n.ok)throw new Error(`HTTP ${n.status}`);const t=await n.json();if(!Array.isArray(t))throw new Error("数据格式错误");const o=t.filter(c=>c&&c.name&&c.name.endsWith(".md")).find(c=>c.name.replace(".md","")===s);if(!o)throw new Error("任务不存在");const i=await(await fetch(o.download_url)).text();return H(i)}catch(n){return console.error("获取任务失败:",n),null}}function H(s){const u=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,d=s.match(u);if(!d)return{title:"未命名任务",slug:"",summary:"",category:"日常任务",content:s,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const m=d[1],r=d[2].trim(),n=m.split(`
`),t={};let a="",o="";for(const p of n){const i=p.trim();if(!i)continue;const c=i.indexOf(":");if(c===-1){a&&(o+=`
`+i);continue}const b=i.substring(0,c).trim();let h=i.substring(c+1).trim();if(h==="|"||h===">"){a=b,o="";continue}t[b]=h,a="",o=""}return a&&o&&(t[a]=o.trim()),{title:t.title||"未命名任务",slug:t.slug||"",summary:t.summary||"",category:t.category||"日常任务",content:r,is_public:t.is_public!=="false",reading_points:parseInt(t.reading_points)||0,created_at:t.created_at||new Date().toISOString(),cover_url:t.cover_url||""}}async function C(){k("加载任务","正在翻阅…");try{if(l=await $(),e=await E(f),!e){g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>任务不存在或加载失败</p></div>',w(!1);return}if(!e.is_public&&!l){g.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此任务仅限登录用户查看</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,w(!1);return}L()}catch(s){console.error("加载失败:",s),g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{w(!1)}}function L(){const s=e.cover_url?`<img src="${e.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let u=e.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(n,t)=>{const a=n.match(/^#+/)[0].length;return`<h${a} style="font-size:${a===1?"24px":a===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${t}</h${a}>`});const d=l&&e.reading_points>0?`
                <span class="points">📖 完成任务可得 ${e.reading_points} 积分</span>
            `:"",m=l&&e.reading_points>0&&!v?`
                <button class="btn-claim" id="claimBtn">领取积分</button>
            `:l&&e.reading_points>0&&v?`
                <span style="font-size:13px;color:rgba(255,255,255,0.15);">✅ 已领取积分</span>
            `:"";g.innerHTML=`
                <div class="task-header">
                    <span class="category">${e.category}</span>
                    <h1>${e.title}</h1>
                    <div class="meta">
                        <span>${new Date(e.created_at).toLocaleDateString("zh-CN")}</span>
                        ${e.is_public?"<span>公开</span>":"<span>🔒 私密</span>"}
                    </div>
                </div>
                ${s}
                <div class="task-body">
                    ${u}
                </div>
                <div class="task-footer">
                    ${d}
                    ${m}
                </div>
            `;const r=document.getElementById("claimBtn");r&&r.addEventListener("click",async()=>{r.disabled=!0,r.textContent="领取中…";try{const{supabase:n}=await y(async()=>{const{supabase:i}=await import("./assets_js_supabase-client.js-CF0gWE4d.js");return{supabase:i}},__vite__mapDeps([0,1,2])),{data:t}=await n.from("article_reads").select("id").eq("user_id",l.id).eq("article_id",f).maybeSingle();if(t){alert("你已经领取过这个任务的积分了！"),r.textContent="已领取",r.disabled=!0;return}const{error:a}=await n.from("article_reads").insert({user_id:l.id,article_id:f,points_claimed:!0});if(a)throw a;const o=(l.user_metadata?.points||0)+e.reading_points,{error:p}=await n.auth.updateUser({data:{points:o}});if(p)throw p;alert(`🎉 获得 ${e.reading_points} 积分！`),v=!0,r.textContent="已领取",r.disabled=!0,setTimeout(()=>location.reload(),500)}catch(n){console.error("领取失败:",n),alert("领取失败，请重试"),r.disabled=!1,r.textContent="领取积分"}})}C();
