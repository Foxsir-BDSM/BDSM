const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/assets_js_supabase-client.js-CF0gWE4d.js","assets/assets_js_config.js-Bq3EMvTC.js","assets/assets_js_request.js-BophGKQa.js"])))=>i.map(i=>d[i]);
import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{_ as y}from"./preload-helper-CLcXU_4U.js";import{C as _}from"./assets_js_content-config.js-Bq1Nvs_5.js";import{g as $}from"./assets_js_auth.js-BCXhz0hh.js";import{s as k,h as w}from"./assets_js_loading.js-BK0rGq7M.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const x=new URLSearchParams(window.location.search),f=x.get("slug"),g=document.getElementById("taskContent");if(!f)throw g.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定任务</p></div>',new Error("No slug");let l=null,r=null,v=!1;function T(){const a=localStorage.getItem("foxsir_github_token");return a&&a.length>10?a:null}async function E(a){const m=_.branches.tasks,d=_.paths.tasks,u=_.getApiUrl(m,d),n=T();if(!n)throw new Error("未配置 GitHub Token");try{const e=await fetch(u,{headers:{Authorization:`token ${n}`}});if(!e.ok)throw new Error(`HTTP ${e.status}`);const t=await e.json();if(!Array.isArray(t))throw new Error("数据格式错误");const i=t.filter(c=>c&&c.name&&c.name.endsWith(".md")).find(c=>c.name.replace(".md","")===a);if(!i)throw new Error("任务不存在");const o=await(await fetch(i.download_url)).text();return H(o)}catch(e){return console.error("获取任务失败:",e),null}}function H(a){const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,d=a.match(m);if(!d)return{title:"未命名任务",slug:"",summary:"",category:"日常任务",content:a,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const u=d[1],n=d[2].trim(),e=u.split(`
`),t={};let s="",i="";for(const p of e){const o=p.trim();if(!o)continue;const c=o.indexOf(":");if(c===-1){s&&(i+=`
`+o);continue}const b=o.substring(0,c).trim();let h=o.substring(c+1).trim();if(h==="|"||h===">"){s=b,i="";continue}t[b]=h,s="",i=""}return s&&i&&(t[s]=i.trim()),{title:t.title||"未命名任务",slug:t.slug||"",summary:t.summary||"",category:t.category||"日常任务",content:n,is_public:t.is_public!=="false",reading_points:parseInt(t.reading_points)||0,created_at:t.created_at||new Date().toISOString(),cover_url:t.cover_url||""}}async function C(){k("加载任务","正在翻阅…");try{if(l=await $(),r=await E(f),!r){g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>任务不存在或加载失败</p></div>',w(!1);return}if(!r.is_public&&!l){g.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此任务仅限登录用户查看</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,w(!1);return}L()}catch(a){console.error("加载失败:",a),g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{w(!1)}}function L(){const a=r.cover_url?`<img src="${r.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let m=r.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(e,t)=>{const s=e.match(/^#+/)[0].length;return`<h${s} style="font-size:${s===1?"24px":s===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${t}</h${s}>`});const d=l&&r.reading_points>0?`
                <span class="points">📖 完成任务可得 ${r.reading_points} 积分</span>
            `:"",u=l&&r.reading_points>0&&!v?`
                <button class="btn-claim" id="claimBtn">领取积分</button>
            `:l&&r.reading_points>0&&v?`
                <span style="font-size:13px;color:rgba(255,255,255,0.15);">✅ 已领取积分</span>
            `:"";g.innerHTML=`
                <div class="task-header">
                    <span class="category">${r.category}</span>
                    <h1>${r.title}</h1>
                    <div class="meta">
                        <span>${new Date(r.created_at).toLocaleDateString("zh-CN")}</span>
                        ${r.is_public?"<span>公开</span>":"<span>🔒 私密</span>"}
                    </div>
                </div>
                ${a}
                <div class="task-body">
                    ${m}
                </div>
                <div class="task-footer">
                    ${d}
                    ${u}
                </div>
            `;const n=document.getElementById("claimBtn");n&&n.addEventListener("click",async()=>{n.disabled=!0,n.textContent="领取中…";try{const{supabase:e}=await y(async()=>{const{supabase:o}=await import("./assets_js_supabase-client.js-CF0gWE4d.js");return{supabase:o}},__vite__mapDeps([0,1,2])),{data:t}=await e.from("article_reads").select("id").eq("user_id",l.id).eq("article_id",f).maybeSingle();if(t){alert("你已经领取过这个任务的积分了！"),n.textContent="已领取",n.disabled=!0;return}const{error:s}=await e.from("article_reads").insert({user_id:l.id,article_id:f,points_claimed:!0});if(s)throw s;const i=(l.user_metadata?.points||0)+r.reading_points,{error:p}=await e.auth.updateUser({data:{points:i}});if(p)throw p;alert(`🎉 获得 ${r.reading_points} 积分！`),v=!0,n.textContent="已领取",n.disabled=!0,setTimeout(()=>location.reload(),500)}catch(e){console.error("❌ 积分领取详细错误:",e);let t="领取失败，请重试";e.message?.includes("permission denied")||e.message?.includes("permission")?t="权限不足，请确保已登录":e.message?.includes("duplicate")?t="您已领取过该积分":e.message?.includes("network")&&(t="网络错误，请检查连接"),alert(t),n.disabled=!1,n.textContent="领取积分"}})}C();
