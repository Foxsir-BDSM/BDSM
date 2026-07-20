import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{C as g}from"./assets_js_content-config.js-Bq1Nvs_5.js";import{g as _}from"./assets_js_auth.js-DwBsfD0Z.js";import{s as $,h as f}from"./assets_js_loading.js-BK0rGq7M.js";import{g as b}from"./assets_js_content-manager.js-neIpQfMu.js";import"./assets_js_supabase-client.js-DmiGq-Dk.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const k=new URLSearchParams(window.location.search),y=k.get("slug"),p=document.getElementById("taskContent");if(!y)throw p.innerHTML='<div class="error-msg"><div class="icon">📭</div><p>未指定任务</p></div>',new Error("No slug");let w=null,e=null;async function T(s){const d=g.branches.tasks,i=g.paths.tasks,m=g.getApiUrl(d,i),r=b();if(!r)throw new Error("未配置 GitHub Token");try{const o=await fetch(m,{headers:{Authorization:`token ${r}`}});if(!o.ok)throw new Error(`HTTP ${o.status}`);const t=await o.json();if(!Array.isArray(t))throw new Error("数据格式错误");const a=t.filter(n=>n&&n.name&&n.name.endsWith(".md")).find(n=>n.name.replace(".md","")===s);if(!a)throw new Error("任务不存在");const c=await(await fetch(a.download_url)).text();return x(c)}catch(o){return console.error("获取任务失败:",o),null}}function x(s){const d=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/,i=s.match(d);if(!i)return{title:"未命名任务",slug:"",summary:"",category:"日常任务",content:s,is_public:!0,reading_points:0,created_at:new Date().toISOString(),cover_url:""};const m=i[1],r=i[2].trim(),o=m.split(`
`),t={};let l="",a="";for(const h of o){const c=h.trim();if(!c)continue;const n=c.indexOf(":");if(n===-1){l&&(a+=`
`+c);continue}const v=c.substring(0,n).trim();let u=c.substring(n+1).trim();if(u==="|"||u===">"){l=v,a="";continue}t[v]=u,l="",a=""}return l&&a&&(t[l]=a.trim()),{title:t.title||"未命名任务",slug:t.slug||"",summary:t.summary||"",category:t.category||"日常任务",content:r,is_public:t.is_public!=="false",reading_points:parseInt(t.reading_points)||0,created_at:t.created_at||new Date().toISOString(),cover_url:t.cover_url||""}}async function H(){$("加载任务","正在翻阅…");try{if(w=await _(),e=await T(y),!e){p.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>任务不存在或加载失败</p></div>',f(!1);return}if(!e.is_public&&!w){p.innerHTML=`
                        <div class="error-msg">
                            <div class="icon">🔒</div>
                            <p>此任务仅限登录用户查看</p>
                            <a href="/auth.html?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}">登录后解锁</a>
                        </div>
                    `,f(!1);return}L()}catch(s){console.error("加载失败:",s),p.innerHTML='<div class="error-msg"><div class="icon">⚠️</div><p>加载失败，请稍后重试</p></div>'}finally{f(!1)}}function L(){const s=e.cover_url?`<img src="${e.cover_url}" alt="封面" style="width:100%; border-radius:12px; margin-bottom:20px;" />`:"";let d=e.content.replace(/\n/g,"<br />").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/^#{1,6}\s+(.*)$/gm,(i,m)=>{const r=i.match(/^#+/)[0].length;return`<h${r} style="font-size:${r===1?"24px":r===2?"20px":"18px"};margin:20px 0 8px;color:#fffffe;">${m}</h${r}>`});p.innerHTML=`
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
                    ${d}
                </div>
                <div class="task-footer"></div>
            `}H();
