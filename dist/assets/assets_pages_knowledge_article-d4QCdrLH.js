const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/assets_js_supabase-client.js-CF0gWE4d.js","assets/assets_js_config.js-Bq3EMvTC.js","assets/assets_js_request.js-BophGKQa.js"])))=>i.map(i=>d[i]);
import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{_ as y}from"./preload-helper-CLcXU_4U.js";import{C as _}from"./assets_js_content-config.js-Bq1Nvs_5.js";import{g as $}from"./assets_js_auth.js-BCXhz0hh.js";import{s as x,h as w}from"./assets_js_loading.js-BK0rGq7M.js";import"./assets_js_supabase-client.js-CF0gWE4d.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const T=new URLSearchParams(window.location.search),f=T.get("slug"),g=document.getElementById("articleContent");if(!f)throw g.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定文章</p></div>',new Error("No slug");let c=null,n=null,v=!1;function k(){const s=localStorage.getItem("foxsir_github_token");return s&&s.length>10?s:""}async function C(s){const m=_.branches.knowledge,l=_.paths.knowledge,u=_.getApiUrl(m,l),r=k();try{const e=await fetch(u,{headers:{Authorization:`token ${r}`}});if(!e.ok)throw new Error(`HTTP ${e.status}`);const a=(await e.json()).filter(d=>d.name.endsWith(".md")).find(d=>d.name.replace(".md","")===s);if(!a)throw new Error("文章不存在");const o=await(await fetch(a.download_url)).text();return E(o)}catch(e){return console.error("获取文章失败:",e),null}}function E(s){const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,l=s.match(m);if(!l)return{title:"未命名文章",slug:"",summary:"",category:"未分类",content:s,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const u=l[1],r=l[2].trim(),e=u.split(`
`),t={};let i="",a="";for(const p of e){const o=p.trim();if(!o)continue;const d=o.indexOf(":");if(d===-1){i&&(a+=`
`+o);continue}const b=o.substring(0,d).trim();let h=o.substring(d+1).trim();if(h==="|"||h===">"){i=b,a="";continue}t[b]=h,i="",a=""}return i&&a&&(t[i]=a.trim()),{title:t.title||"未命名文章",slug:t.slug||"",summary:t.summary||"",category:t.category||"未分类",content:r,is_public:t.is_public!=="false",reading_points:parseInt(t.reading_points)||0,created_at:t.created_at||new Date().toISOString(),cover_url:t.cover_url||""}}async function H(){x("加载文章","正在翻阅…");try{if(c=await $(),n=await C(f),!n){g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>文章不存在或加载失败</p></div>',w(!1);return}if(!n.is_public&&!c){g.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此文章仅限登录用户阅读</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,w(!1);return}L()}catch(s){console.error("加载失败:",s),g.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{w(!1)}}function L(){const s=n.cover_url?`<img src="${n.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let m=n.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(e,t)=>{const i=e.match(/^#+/)[0].length;return`<h${i} style="font-size:${i===1?"24px":i===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${t}</h${i}>`});const l=c&&n.reading_points>0?`
                <span class="points">📖 阅读可得 ${n.reading_points} 积分</span>
            `:"",u=c&&n.reading_points>0&&!v?`
                <button class="btn-claim" id="claimBtn">领取积分</button>
            `:c&&n.reading_points>0&&v?`
                <span style="font-size:13px;color:rgba(255,255,255,0.15);">✅ 已领取积分</span>
            `:"";g.innerHTML=`
                <div class="article-header">
                    <span class="category">${n.category}</span>
                    <h1>${n.title}</h1>
                    <div class="meta">
                        <span>${new Date(n.created_at).toLocaleDateString("zh-CN")}</span>
                        ${n.is_public?"<span>公开</span>":"<span>🔒 私密</span>"}
                    </div>
                </div>
                ${s}
                <div class="article-body">
                    ${m}
                </div>
                <div class="article-footer">
                    ${l}
                    ${u}
                </div>
            `;const r=document.getElementById("claimBtn");r&&r.addEventListener("click",async()=>{r.disabled=!0,r.textContent="领取中…";try{const{supabase:e}=await y(async()=>{const{supabase:o}=await import("./assets_js_supabase-client.js-CF0gWE4d.js");return{supabase:o}},__vite__mapDeps([0,1,2])),{data:t}=await e.from("article_reads").select("id").eq("user_id",c.id).eq("article_id",f).maybeSingle();if(t){alert("你已经领取过这篇文章的积分了！"),r.textContent="已领取",r.disabled=!0;return}const{error:i}=await e.from("article_reads").insert({user_id:c.id,article_id:f,points_claimed:!0});if(i)throw i;const a=(c.user_metadata?.points||0)+n.reading_points,{error:p}=await e.auth.updateUser({data:{points:a}});if(p)throw p;alert(`🎉 获得 ${n.reading_points} 积分！`),v=!0,r.textContent="已领取",r.disabled=!0,setTimeout(()=>location.reload(),500)}catch(e){console.error("❌ 积分领取详细错误:",e);let t="领取失败，请重试";e.message?.includes("permission denied")||e.message?.includes("permission")?t="权限不足，请确保已登录":e.message?.includes("duplicate")?t="您已领取过该积分":e.message?.includes("network")&&(t="网络错误，请检查连接"),alert(t),r.disabled=!1,r.textContent="领取积分"}})}H();
