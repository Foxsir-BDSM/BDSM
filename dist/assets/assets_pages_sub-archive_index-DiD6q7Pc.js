import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */import{c as S,C as E,b as B,S as R}from"./api-CAcsciEw.js";import{g as w,b as F,c as k,d as x,h as A}from"./utils-CtjtO6eb.js";import{g as N}from"./assets_js_identity.js-BoUU-mI8.js";import"./assets_js_supabase-client.js-DmiGq-Dk.js";import"./assets_js_config.js-Bq3EMvTC.js";import"./assets_js_request.js-BophGKQa.js";const g=document.getElementById("gridContainer"),y=document.getElementById("searchInput"),m=document.getElementById("searchClear"),P=document.getElementById("searchStats"),p=document.getElementById("stateMessage"),r=document.getElementById("loadMoreIndicator");let i=[],d=1,L=0,h=!1,v=!0,u="",U="guest";function _(e){const t=w(e,"fgerzjJpBTF");return t===!0||t==="是"||t==="true"||t===1||typeof t=="string"&&t.trim().toLowerCase()==="true"}function z(e){const t="fxwUAnrwpaT";return e.slice().sort((s,n)=>{const a=parseInt(w(s,t))||0;return(parseInt(w(n,t))||0)-a})}function D(e){const t=parseInt(e);if(isNaN(t)||t<1||t>10)return'<span class="no-rating">暂无评分</span>';let s="";for(let n=1;n<=10;n++)s+=n<=t?"★":"☆";return s}function G(e){return e===!0||e==="true"||e==="是"||e==="认证"||e===1||typeof e=="string"&&e.trim().toLowerCase()==="true"}function O(){if(!i||i.length===0){g.innerHTML='<div class="state-message" style="grid-column:1/-1;"><p>😕 没有找到匹配的资料</p></div>';return}let e=i;if(u.trim()){const s=u.trim().toLowerCase();e=i.filter(n=>{for(const a of R){const o=w(n,a);if(o&&String(o).toLowerCase().includes(s))return!0}return!1})}if(e.length===0){g.innerHTML='<div class="state-message" style="grid-column:1/-1;"><p>😕 没有找到匹配的资料</p></div>',I(0);return}let t="";e.forEach(s=>{const n=s.id,a=F(s),o=k(s),l=x(s),c=A(s),H=c.area||"—",$=c.height||"—",M=c.weight||"—",T=c.recommend||"",b=G(c.verified)?'<div class="verified-badge">✅</div>':"";t+=`
      <div class="card" data-id="${n}" onclick="location.href='detail.html?id=${n}'">
        <div class="card-image-wrap">
          <img src="${a}" alt="${o}" loading="lazy" onerror="this.src='${E.DEFAULT_IMAGE}'" />
          ${b}
          <div class="card-image-caption">
            <span class="card-name">${o}</span>
            ${l?`<span class="card-age">${l}岁</span>`:""}
          </div>
        </div>
        <div class="card-footer">
          <div class="info-row">
            <span class="icon">📍</span>
            <span class="value">${H}</span>
          </div>
          <div class="info-row row-height-weight">
            <span class="height-item"><span class="icon">📏</span><span class="value">${$}cm</span></span>
            <span class="weight-item"><span class="icon">⚖</span><span class="value">${M}kg</span></span>
          </div>
          <div class="info-row stars-row">
            <div class="stars-container">${D(T)}</div>
          </div>
        </div>
      </div>
    `}),g.innerHTML=t,I(e.length)}function I(e){P.innerHTML=`共 <strong>${e}</strong> 位`}async function f(e,t=!1){if(!h){h=!0,r&&(r.textContent="⏳ 加载中...",r.style.display="block");try{const s=await B(e);let n=s.records||[];if(L=s.total||n.length,n=n.filter(_),t)i=n;else{const a=new Set(i.map(l=>l.id)),o=n.filter(l=>!a.has(l.id));i=i.concat(o)}i=z(i),v=i.length<L,d=e,O(),p.style.display="none",r&&(v&&i.length>0?(r.textContent="⬇ 滚动加载更多...",r.style.display="block"):!v&&i.length>0?(r.textContent="✅ 已加载全部",r.style.display="block"):r.style.display="none")}catch(s){console.error("加载失败:",s),t&&(p.innerHTML=`<p>❌ 加载失败：${s.message}</p>`,p.style.display="flex"),r&&(r.textContent="❌ 加载失败，请刷新重试")}finally{h=!1}}}function C(){!v||h||f(d+1,!1)}function V(e){if(u=e.trim(),!u){d=1,i=[],f(1,!0);return}d=1,i=[],f(1,!0)}function j(){y.value="",m.classList.remove("visible"),u="",d=1,i=[],f(1,!0),y.focus()}function q(){const e=document.querySelector(".main-content");if(!e){window.addEventListener("scroll",()=>{const s=window.scrollY,n=window.innerHeight;document.documentElement.scrollHeight-s-n<200&&C()});return}let t=null;e.addEventListener("scroll",()=>{clearTimeout(t),t=setTimeout(()=>{const{scrollTop:s,scrollHeight:n,clientHeight:a}=e;n-s-a<150&&C()},100)})}async function J(){try{U=await N()}catch{console.warn("获取角色失败，使用 guest")}p.style.display="flex",g.innerHTML="",await f(1,!0),y.addEventListener("input",e=>{const t=e.target.value;t.trim()?m.classList.add("visible"):m.classList.remove("visible"),V(t)}),m.addEventListener("click",j),document.getElementById("btnFillForm").addEventListener("click",()=>{window.open(E.FORM_URL,"_blank")}),q()}window.clearArchiveCache=()=>{S(),location.reload()};J();
