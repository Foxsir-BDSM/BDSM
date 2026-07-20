const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/assets_js_supabase-client.js-CF0gWE4d.js","assets/assets_js_config.js-Bq3EMvTC.js","assets/assets_js_request.js-BophGKQa.js"])))=>i.map(i=>d[i]);
import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{_ as y}from"./preload-helper-CLcXU_4U.js";import{C as _}from"./assets_js_content-config.js-Bq1Nvs_5.js";import{g as $}from"./assets_js_auth.js-CORIovx3.js";import{s as x,h as v}from"./assets_js_loading.js-BK0rGq7M.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const T=new URLSearchParams(window.location.search),f=T.get("slug"),g=document.getElementById("articleContent");if(!f)throw g.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定文章</p></div>',new Error("No slug");let c=null,t=null,w=!1;function C(){const i=localStorage.getItem("foxsir_github_token");return i&&i.length>10?i:""}async function E(i){const m=_.branches.knowledge,l=_.paths.knowledge,u=_.getApiUrl(m,l),n=C();try{const e=await fetch(u,{headers:{Authorization:`token ${n}`}});if(!e.ok)throw new Error(`HTTP ${e.status}`);const o=(await e.json()).filter(d=>d.name.endsWith(".md")).find(d=>d.name.replace(".md","")===i);if(!o)throw new Error("文章不存在");const s=await(await fetch(o.download_url)).text();return H(s)}catch(e){return console.error("获取文章失败:",e),null}}function H(i){const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,l=i.match(m);if(!l)return{title:"未命名文章",slug:"",summary:"",category:"未分类",content:i,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const u=l[1],n=l[2].trim(),e=u.split(`
`),r={};let a="",o="";for(const p of e){const s=p.trim();if(!s)continue;const d=s.indexOf(":");if(d===-1){a&&(o+=`
`+s);continue}const b=s.substring(0,d).trim();let h=s.substring(d+1).trim();if(h==="|"||h===">"){a=b,o="";continue}r[b]=h,a="",o=""}return a&&o&&(r[a]=o.trim()),{title:r.title||"未命名文章",slug:r.slug||"",summary:r.summary||"",category:r.category||"未分类",content:n,is_public:r.is_public!=="false",reading_points:parseInt(r.reading_points)||0,created_at:r.created_at||new Date().toISOString(),cover_url:r.cover_url||""}}async function L(){x("加载文章","正在翻阅…");try{if(c=await $(),t=await E(f),!t){g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>文章不存在或加载失败</p></div>',v(!1);return}if(!t.is_public&&!c){g.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此文章仅限登录用户阅读</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,v(!1);return}S()}catch(i){console.error("加载失败:",i),g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{v(!1)}}function S(){const i=t.cover_url?`<img src="${t.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let m=t.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(e,r)=>{const a=e.match(/^#+/)[0].length;return`<h${a} style="font-size:${a===1?"24px":a===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${r}</h${a}>`});const l=c&&t.reading_points>0?`
                <span class="points">📖 阅读可得 ${t.reading_points} 积分</span>
            `:"",u=c&&t.reading_points>0&&!w?`
                <button class="btn-claim" id="claimBtn">领取积分</button>
            `:c&&t.reading_points>0&&w?`
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
                    ${m}
                </div>
                <div class="article-footer">
                    ${l}
                    ${u}
                </div>
            `;const n=document.getElementById("claimBtn");n&&n.addEventListener("click",async()=>{n.disabled=!0,n.textContent="领取中…";try{const{supabase:e}=await y(async()=>{const{supabase:s}=await import("./assets_js_supabase-client.js-CF0gWE4d.js");return{supabase:s}},__vite__mapDeps([0,1,2])),{data:r}=await e.from("article_reads").select("id").eq("user_id",c.id).eq("article_id",f).maybeSingle();if(r){alert("你已经领取过这篇文章的积分了！"),n.textContent="已领取",n.disabled=!0;return}const{error:a}=await e.from("article_reads").insert({user_id:c.id,article_id:f,points_claimed:!0});if(a)throw a;const o=(c.user_metadata?.points||0)+t.reading_points,{error:p}=await e.auth.updateUser({data:{points:o}});if(p)throw p;alert(`🎉 获得 ${t.reading_points} 积分！`),w=!0,n.textContent="已领取",n.disabled=!0,setTimeout(()=>location.reload(),500)}catch(e){console.error("领取失败:",e),alert("领取失败，请重试"),n.disabled=!1,n.textContent="领取积分"}})}L();
