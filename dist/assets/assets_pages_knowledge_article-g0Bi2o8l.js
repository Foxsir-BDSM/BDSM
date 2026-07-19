import"./supabase-client-BlgCfJt8.js";/* empty css             */import{_ as y}from"./preload-helper-CLcXU_4U.js";import{C as _}from"./content-config-Bq1Nvs_5.js";import{g as $}from"./auth-Cyt5DioV.js";import{s as x,h as w}from"./loading-BK0rGq7M.js";const H=new URLSearchParams(window.location.search),f=H.get("slug"),g=document.getElementById("articleContent");if(!f)throw g.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定文章</p></div>',new Error("No slug");let l=null,t=null,v=!1;function S(){const i=localStorage.getItem("foxsir_github_token");return i&&i.length>10?i:"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"}async function T(i){const u=_.branches.knowledge,d=_.paths.knowledge,m=_.getApiUrl(u,d),n=S();try{const e=await fetch(m,{headers:{Authorization:`token ${n}`}});if(!e.ok)throw new Error(`HTTP ${e.status}`);const o=(await e.json()).filter(c=>c.name.endsWith(".md")).find(c=>c.name.replace(".md","")===i);if(!o)throw new Error("文章不存在");const s=await(await fetch(o.download_url)).text();return C(s)}catch(e){return console.error("获取文章失败:",e),null}}function C(i){const u=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,d=i.match(u);if(!d)return{title:"未命名文章",slug:"",summary:"",category:"未分类",content:i,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const m=d[1],n=d[2].trim(),e=m.split(`
`),r={};let a="",o="";for(const p of e){const s=p.trim();if(!s)continue;const c=s.indexOf(":");if(c===-1){a&&(o+=`
`+s);continue}const b=s.substring(0,c).trim();let h=s.substring(c+1).trim();if(h==="|"||h===">"){a=b,o="";continue}r[b]=h,a="",o=""}return a&&o&&(r[a]=o.trim()),{title:r.title||"未命名文章",slug:r.slug||"",summary:r.summary||"",category:r.category||"未分类",content:n,is_public:r.is_public!=="false",reading_points:parseInt(r.reading_points)||0,created_at:r.created_at||new Date().toISOString(),cover_url:r.cover_url||""}}async function E(){x("加载文章","正在翻阅…");try{if(l=await $(),t=await T(f),!t){g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>文章不存在或加载失败</p></div>',w(!1);return}if(!t.is_public&&!l){g.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此文章仅限登录用户阅读</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,w(!1);return}I()}catch(i){console.error("加载失败:",i),g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{w(!1)}}function I(){const i=t.cover_url?`<img src="${t.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let u=t.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(e,r)=>{const a=e.match(/^#+/)[0].length;return`<h${a} style="font-size:${a===1?"24px":a===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${r}</h${a}>`});const d=l&&t.reading_points>0?`
                <span class="points">📖 阅读可得 ${t.reading_points} 积分</span>
            `:"",m=l&&t.reading_points>0&&!v?`
                <button class="btn-claim" id="claimBtn">领取积分</button>
            `:l&&t.reading_points>0&&v?`
                <span style="font-size:13px;color:rgba(255,255,255,0.15);">✅ 已领取积分</span>
            `:"";g.innerHTML=`
                <div class="article-header">
                    <span class="category">${t.category}</span>
                    <h1>${t.title}</h1>
                    <div class="meta">
                        <span>${new Date(t.created_at).toLocaleDateString("zh-CN")}</span>
                        ${t.is_public?"<span>公开</span>":"<span>🔒 私密</span>"}
                    </div>
                </div>
                ${i}
                <div class="article-body">
                    ${u}
                </div>
                <div class="article-footer">
                    ${d}
                    ${m}
                </div>
            `;const n=document.getElementById("claimBtn");n&&n.addEventListener("click",async()=>{n.disabled=!0,n.textContent="领取中…";try{const{supabase:e}=await y(async()=>{const{supabase:s}=await import("./supabase-client-BlgCfJt8.js").then(c=>c.a);return{supabase:s}},[]),{data:r}=await e.from("article_reads").select("id").eq("user_id",l.id).eq("article_id",f).maybeSingle();if(r){alert("你已经领取过这篇文章的积分了！"),n.textContent="已领取",n.disabled=!0;return}const{error:a}=await e.from("article_reads").insert({user_id:l.id,article_id:f,points_claimed:!0});if(a)throw a;const o=(l.user_metadata?.points||0)+t.reading_points,{error:p}=await e.auth.updateUser({data:{points:o}});if(p)throw p;alert(`🎉 获得 ${t.reading_points} 积分！`),v=!0,n.textContent="已领取",n.disabled=!0,setTimeout(()=>location.reload(),500)}catch(e){console.error("领取失败:",e),alert("领取失败，请重试"),n.disabled=!1,n.textContent="领取积分"}})}E();
