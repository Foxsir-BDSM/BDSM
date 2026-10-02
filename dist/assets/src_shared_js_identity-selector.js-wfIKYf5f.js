const c=[{id:"male_S",label:"男S",gender:"male",type:"top",icon:"⚔️",desc:"掌控者"},{id:"female_S",label:"女S",gender:"female",type:"top",icon:"⚔️",desc:"掌控者"},{id:"male_Dom",label:"男Dom",gender:"male",type:"top",icon:"🔮",desc:"支配者"},{id:"female_Dom",label:"女Dom",gender:"female",type:"top",icon:"🔮",desc:"支配者"},{id:"male_Z",label:"男Z",gender:"male",type:"top",icon:"🔥",desc:"召契者"},{id:"female_Z",label:"女Z",gender:"female",type:"top",icon:"🔥",desc:"召契者"},{id:"male_M",label:"男M",gender:"male",type:"bottom",icon:"🛡️",desc:"臣服者"},{id:"female_M",label:"女M",gender:"female",type:"bottom",icon:"🛡️",desc:"臣服者"},{id:"male_Sub",label:"男Sub",gender:"male",type:"bottom",icon:"🌊",desc:"跟随者"},{id:"female_Sub",label:"女Sub",gender:"female",type:"bottom",icon:"🌊",desc:"跟随者"},{id:"male_B",label:"男B",gender:"male",type:"bottom",icon:"💎",desc:"应契者"},{id:"female_B",label:"女B",gender:"female",type:"bottom",icon:"💎",desc:"应契者"}];c.map(e=>e.id);let d=null;const s=new Set;function y(e){const n=document.getElementById(e);if(!n){console.warn("[identity-selector] 容器不存在:",e);return}n.innerHTML=`
    <div class="identity-selector">
      <div class="section-label">
        🎯 主身份 <small>（必选，决定等级路径）</small>
      </div>
      <div class="primary-grid" id="primary-grid"></div>

      <div class="section-label" style="margin-top: 1rem;">
        🧩 副身份 <small>（可选，多选，展示多元属性）</small>
      </div>
      <div class="secondary-grid" id="secondary-grid"></div>

      <div class="identity-hint" id="identity-hint">请点击卡片选择主身份</div>
    </div>
  `;const l=document.getElementById("primary-grid"),i=document.getElementById("secondary-grid");c.forEach(t=>{const a=document.createElement("div");a.className="identity-card",a.dataset.id=t.id,a.innerHTML=`
      <span class="icon">${t.icon}</span>
      <span class="label">${t.label}</span>
      <span class="badge">${t.desc}</span>
    `,a.addEventListener("click",()=>m(t.id)),l.appendChild(a)}),c.forEach(t=>{const a=document.createElement("div");a.className="secondary-card",a.dataset.id=t.id,a.innerHTML=`
      <span class="icon">${t.icon}</span>
      <span class="label">${t.label}</span>
    `,a.addEventListener("click",()=>p(t.id)),i.appendChild(a)}),r(),o()}function m(e){d===e?d=null:d=e,r(),o()}function p(e){s.has(e)?s.delete(e):s.add(e),r(),o()}function r(){document.querySelectorAll(".primary-grid .identity-card").forEach(e=>{const n=e.dataset.id;e.classList.toggle("selected-primary",n===d)}),document.querySelectorAll(".secondary-grid .secondary-card").forEach(e=>{const n=e.dataset.id;e.classList.toggle("selected-secondary",s.has(n))})}function o(){const e=document.getElementById("identity-hint");if(!e)return;const n=[];if(d){const l=c.find(i=>i.id===d);if(l){const i=l.gender==="male"?"男":"女",t=l.type==="top"?"上位":"下位";n.push(`主：${l.label}（${l.desc} · ${i} · ${t}）`)}}else n.push("⚠️ 请选择主身份");if(s.size>0){const l=Array.from(s).map(i=>{const t=c.find(a=>a.id===i);return t?t.label:i});n.push(`副：${l.join("、")}`)}e.textContent=n.join(" ｜ ")||"请点击卡片选择主身份"}function f(){if(!d)return{valid:!1,error:"请选择主身份"};const e=c.find(n=>n.id===d);return e?{valid:!0,primaryId:d,primaryLabel:e.label,gender:e.gender,type:e.type,secondaryIds:Array.from(s)}:{valid:!1,error:"主身份数据异常，请重新选择"}}function g(){d=null,s.clear(),r(),o()}export{g as a,f as g,y as r};
