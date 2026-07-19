import"./supabase-client-BlgCfJt8.js";/* empty css             */import{_ as b}from"./preload-helper-CLcXU_4U.js";import{C as _}from"./content-config-Bq1Nvs_5.js";import{g as $}from"./auth-Cyt5DioV.js";import{s as k,h as w}from"./loading-BK0rGq7M.js";const x=new URLSearchParams(window.location.search),f=x.get("slug"),g=document.getElementById("taskContent");if(!f)throw g.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定任务</p></div>',new Error("No slug");let l=null,e=null,v=!1;function T(){const s=localStorage.getItem("foxsir_github_token");return s&&s.length>10?s:"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"}async function H(s){const m=_.branches.tasks,d=_.paths.tasks,u=_.getApiUrl(m,d),n=T();try{const r=await fetch(u,{headers:{Authorization:`token ${n}`}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const t=await r.json();if(!Array.isArray(t))throw new Error("数据格式错误");const o=t.filter(i=>i&&i.name&&i.name.endsWith(".md")).find(i=>i.name.replace(".md","")===s);if(!o)throw new Error("任务不存在");const c=await(await fetch(o.download_url)).text();return E(c)}catch(r){return console.error("获取任务失败:",r),null}}function E(s){const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,d=s.match(m);if(!d)return{title:"未命名任务",slug:"",summary:"",category:"日常任务",content:s,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const u=d[1],n=d[2].trim(),r=u.split(`
`),t={};let a="",o="";for(const p of r){const c=p.trim();if(!c)continue;const i=c.indexOf(":");if(i===-1){a&&(o+=`
`+c);continue}const y=c.substring(0,i).trim();let h=c.substring(i+1).trim();if(h==="|"||h===">"){a=y,o="";continue}t[y]=h,a="",o=""}return a&&o&&(t[a]=o.trim()),{title:t.title||"未命名任务",slug:t.slug||"",summary:t.summary||"",category:t.category||"日常任务",content:n,is_public:t.is_public!=="false",reading_points:parseInt(t.reading_points)||0,created_at:t.created_at||new Date().toISOString(),cover_url:t.cover_url||""}}async function S(){k("加载任务","正在翻阅…");try{if(l=await $(),e=await H(f),!e){g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>任务不存在或加载失败</p></div>',w(!1);return}if(!e.is_public&&!l){g.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此任务仅限登录用户查看</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,w(!1);return}C()}catch(s){console.error("加载失败:",s),g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{w(!1)}}function C(){const s=e.cover_url?`<img src="${e.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let m=e.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(r,t)=>{const a=r.match(/^#+/)[0].length;return`<h${a} style="font-size:${a===1?"24px":a===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${t}</h${a}>`});const d=l&&e.reading_points>0?`
                <span class="points">📖 完成任务可得 ${e.reading_points} 积分</span>
            `:"",u=l&&e.reading_points>0&&!v?`
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
                    ${m}
                </div>
                <div class="task-footer">
                    ${d}
                    ${u}
                </div>
            `;const n=document.getElementById("claimBtn");n&&n.addEventListener("click",async()=>{n.disabled=!0,n.textContent="领取中…";try{const{supabase:r}=await b(async()=>{const{supabase:c}=await import("./supabase-client-BlgCfJt8.js").then(i=>i.a);return{supabase:c}},[]),{data:t}=await r.from("article_reads").select("id").eq("user_id",l.id).eq("article_id",f).maybeSingle();if(t){alert("你已经领取过这个任务的积分了！"),n.textContent="已领取",n.disabled=!0;return}const{error:a}=await r.from("article_reads").insert({user_id:l.id,article_id:f,points_claimed:!0});if(a)throw a;const o=(l.user_metadata?.points||0)+e.reading_points,{error:p}=await r.auth.updateUser({data:{points:o}});if(p)throw p;alert(`🎉 获得 ${e.reading_points} 积分！`),v=!0,n.textContent="已领取",n.disabled=!0,setTimeout(()=>location.reload(),500)}catch(r){console.error("领取失败:",r),alert("领取失败，请重试"),n.disabled=!1,n.textContent="领取积分"}})}S();
