import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{C as g}from"./assets_js_content-config.js-Bq1Nvs_5.js";import{g as _}from"./assets_js_auth.js-DwBsfD0Z.js";import{s as $,h as f}from"./assets_js_loading.js-BK0rGq7M.js";import{g as b}from"./assets_js_content-manager.js-neIpQfMu.js";import"./assets_js_supabase-client.js-DmiGq-Dk.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const x=new URLSearchParams(window.location.search),y=x.get("slug"),p=document.getElementById("articleContent");if(!y)throw p.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定文章</p></div>',new Error("No slug");let w=null,e=null;async function T(n){const d=g.branches.knowledge,s=g.paths.knowledge,m=g.getApiUrl(d,s),r=b();if(!r)throw new Error("未配置 GitHub Token");try{const o=await fetch(m,{headers:{Authorization:`token ${r}`}});if(!o.ok)throw new Error(`HTTP ${o.status}`);const i=(await o.json()).filter(c=>c.name.endsWith(".md")).find(c=>c.name.replace(".md","")===n);if(!i)throw new Error("文章不存在");const a=await(await fetch(i.download_url)).text();return H(a)}catch(o){return console.error("获取文章失败:",o),null}}function H(n){const d=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,s=n.match(d);if(!s)return{title:"未命名文章",slug:"",summary:"",category:"未分类",content:n,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const m=s[1],r=s[2].trim(),o=m.split(`
`),t={};let l="",i="";for(const h of o){const a=h.trim();if(!a)continue;const c=a.indexOf(":");if(c===-1){l&&(i+=`
`+a);continue}const v=a.substring(0,c).trim();let u=a.substring(c+1).trim();if(u==="|"||u===">"){l=v,i="";continue}t[v]=u,l="",i=""}return l&&i&&(t[l]=i.trim()),{title:t.title||"未命名文章",slug:t.slug||"",summary:t.summary||"",category:t.category||"未分类",content:r,is_public:t.is_public!=="false",reading_points:parseInt(t.reading_points)||0,created_at:t.created_at||new Date().toISOString(),cover_url:t.cover_url||""}}async function L(){$("加载文章","正在翻阅…");try{if(w=await _(),e=await T(y),!e){p.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>文章不存在或加载失败</p></div>',f(!1);return}if(!e.is_public&&!w){p.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此文章仅限登录用户阅读</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,f(!1);return}S()}catch(n){console.error("加载失败:",n),p.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{f(!1)}}function S(){const n=e.cover_url?`<img src="${e.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let d=e.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(s,m)=>{const r=s.match(/^#+/)[0].length;return`<h${r} style="font-size:${r===1?"24px":r===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${m}</h${r}>`});p.innerHTML=`
                <div class="article-header">
                    <span class="category">${e.category}</span>
                    <h1>${e.title}</h1>
                    <div class="meta">
                        <span>${new Date(e.created_at).toLocaleDateString("zh-CN")}</span>
                        ${e.is_public?"<span>公开</span>":"<span>🔒 私密</span>"}
                    </div>
                </div>
                ${n}
                <div class="article-body">
                    ${d}
                </div>
                <div class="article-footer"></div>
            `}L();
