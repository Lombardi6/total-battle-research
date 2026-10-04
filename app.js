
const $=s=>document.querySelector(s);
const state=JSON.parse(localStorage.getItem("tbResearchState")||"{}");
const roman={i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10};
let DATA=[];

function save(){localStorage.setItem("tbResearchState",JSON.stringify(state))}
function norm(v){return String(v||"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9ivx]+/g," ").trim().split(/\s+/).map(x=>roman[x]||x).join(" ")}
function matches(text,q){q=norm(q);if(!q)return true;const h=norm(text);return q.split(/\s+/).every(x=>h.includes(x))}
function num(v){const s=String(v).replace(/,/g,"").trim().toUpperCase(),m=s.match(/^([\d.]+)([KMBT]?)$/);if(!m)return 0;return Number(m[1])*({"":1,K:1e3,M:1e6,B:1e9,T:1e12}[m[2]])}
function fmt(n){if(n>=1e12)return(n/1e12).toFixed(2).replace(/\.00$/,"")+"T";if(n>=1e9)return(n/1e9).toFixed(2).replace(/\.00$/,"")+"B";if(n>=1e6)return(n/1e6).toFixed(2).replace(/\.00$/,"")+"M";if(n>=1e3)return(n/1e3).toFixed(2).replace(/\.00$/,"")+"K";return Math.round(n).toLocaleString("sk-SK")}
function key(b,r){return b.id+"|"+r.name}
function current(b,r){return Math.max(0,Math.min(r.levels,Number(state[key(b,r)]||0)))}
function profile(r){if(r.curve?.length)return r.curve.map(num);if(r.levels===1)return[num(r.total)];const total=num(r.total),step=total/r.levels;return Array.from({length:r.levels},()=>step)}
function remaining(b,r){const c=current(b,r),p=profile(r);return p.slice(c).reduce((a,v)=>a+v,0)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function image(b,r){
  const src=r.image||"";
  if(src)return `<img src="${src}" alt="" loading="lazy" onerror="this.style.display='none'">`;
  return `<div style="display:grid;place-items:center;width:100%;height:100%;font-weight:900;color:#e8bd55">${escapeHtml((r.name||"R").slice(0,2).toUpperCase())}</div>`;
}
function allRows(){return DATA.flatMap(b=>b.items.map(r=>({b,r})))}

function node(b,r){
  const c=current(b,r),done=c===r.levels,pct=r.levels?c/r.levels*100:0,rem=remaining(b,r);
  return `<article class="node ${done?"done":""}" data-open="${encodeURIComponent(b.id+"|"+r.name)}">
    <div class="order-chip">#${String(r.globalOrder||r.order||0).padStart(3,"0")}</div>
    <div class="node-image">${image(b,r)}</div>
    <div class="node-body">
      <div class="node-order">${r.levels===1?"ODOMKNUTIE":"VYLEPŠENIE"} · ${r.levels} ${r.levels===1?"level":"levelov"}</div>
      <h3>${escapeHtml(r.name)}</h3>
      <div class="node-meta"><span>${c}/${r.levels}</span><span>•</span><span class="currency ${b.currency}">${b.currency}</span><span>•</span><span>${fmt(rem)}</span></div>
      <div class="mini-bar"><i style="width:${pct}%"></i></div>
      <div class="node-bottom"><span>${pct.toFixed(0)}% hotovo</span><strong>${done?"DOKONČENÉ":"ZOSTÁVA "+fmt(rem)}</strong></div>
    </div>
    <button class="node-action ${done?"done":""}" data-toggle="${encodeURIComponent(b.id+"|"+r.name)}">${done?"✓":"+"}</button>
  </article>`;
}

function render(){
  const q=$("#search").value,branch=$("#branch").value,currency=$("#currency").value,status=$("#status").value;
  const vp=num($("#vpBudget").value||0),cp=num($("#cpBudget").value||0);
  const active=branch==="all"?DATA:DATA.filter(b=>b.id===branch);
  let html="",shown=0;
  for(const b of active){
    if(currency!=="all"&&b.currency!==currency)continue;
    const rows=b.items.filter(r=>{
      const c=current(b,r),done=c===r.levels,cost=remaining(b,r),budget=b.currency==="VP"?vp:cp;
      if(!(matches(r.name,q)||matches(b.name,q)))return false;
      return status==="all"||(status==="done"&&done)||(status==="todo"&&!done)||(status==="afford"&&cost<=budget&&cost>0);
    });
    if(!rows.length)continue;
    shown+=rows.length;
    html+=`<section class="branch">
      <div class="branch-head">
        <div class="branch-icon">${b.currency==="VP"?"V":"C"}</div>
        <div class="branch-title"><h2>${escapeHtml(b.name)}</h2><small>${b.count} výskumov · poradie 01 → ${String(b.count).padStart(2,"0")} · ${b.currency==="VP"?"Valor":"Conquest"}</small></div>
        <div class="branch-total"><span>CELÁ VETVA</span><strong>${b.branch_total} ${b.currency}</strong></div>
      </div>
      <div class="tree-board"><div class="tree-grid">${rows.map(r=>node(b,r)).join("")}</div></div>
    </section>`;
  }
  $("#results").innerHTML=html||`<div class="empty">Nič sa nenašlo.<br>Skús zmeniť vyhľadávanie alebo filter.</div>`;
  bindNodes();

  const totals=allRows().reduce((a,x)=>{const rem=remaining(x.b,x.r);a[x.b.currency.toLowerCase()]+=rem;a.levels+=x.r.levels-current(x.b,x.r);return a},{vp:0,cp:0,levels:0});
  const doneLevels=418-totals.levels;
  $("#vpTotal").textContent=fmt(totals.vp);$("#cpTotal").textContent=fmt(totals.cp);$("#levelsLeft").textContent=totals.levels;$("#doneTotal").textContent=((doneLevels/418)*100).toFixed(1)+"%";
  const affordable=allRows().filter(x=>{const rem=remaining(x.b,x.r),budget=x.b.currency==="VP"?vp:cp;return rem>0&&budget>0&&rem<=budget});
  $("#budgetResult").textContent=affordable.length?`V zadanom rozpočte máš ${affordable.length} nedokončených výskumov.`:"Zadaj zásobu VP/CP a uvidíš, čo sa zmestí do rozpočtu.";
}
function bindNodes(){
 document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",e=>{if(e.target.closest("[data-toggle]"))return;const [bid,name]=decodeURIComponent(el.dataset.open).split("|");openResearch(bid,name)}));
 document.querySelectorAll("[data-toggle]").forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();const [bid,name]=decodeURIComponent(el.dataset.toggle).split("|");const b=DATA.find(x=>x.id===bid),r=b.items.find(x=>x.name===name);state[key(b,r)]=current(b,r)>=r.levels?0:r.levels;save();render()}));
}
function openResearch(bid,name){
 const b=DATA.find(x=>x.id===bid),r=b.items.find(x=>x.name===name),p=profile(r),c=current(b,r);
 $("#dialogBranch").textContent=`${b.name} · ${b.currency==="VP"?"VALOR":"CONQUEST"}`;
 $("#dialogName").textContent=r.name;$("#dialogMeta").textContent=`Poradie #${String(r.globalOrder||r.order||0).padStart(3,"0")} · ${r.levels} levelov · celkom ${r.total} ${b.currency}`;
 $("#dialogImage").innerHTML=image(b,r);
 $("#levelPicker").innerHTML=p.map((v,i)=>`<button class="level ${i<c?"done":""} ${i===c?"current":""}" data-level="${i+1}">Level ${i+1}<small>${fmt(v)} ${b.currency}</small></button>`).join("");
 $("#dialogDone").textContent=`${c} / ${r.levels}`;$("#dialogRemaining").textContent=`${r.levels-c} levelov`;$("#dialogCost").textContent=fmt(p.slice(c).reduce((a,v)=>a+v,0))+" "+b.currency;
 $("#researchDialog").showModal();
 document.querySelectorAll("[data-level]").forEach(btn=>btn.addEventListener("click",()=>{state[key(b,r)]=Number(btn.dataset.level);save();openResearch(bid,name);render()}));
}
function fillBranches(){
 $("#branch").innerHTML='<option value="all">Všetky vetvy</option>'+DATA.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
 $("#tabs").innerHTML='<button class="active" data-tab="all">Všetky</button>'+DATA.map(b=>`<button data-tab="${b.id}">${escapeHtml(b.name)}</button>`).join("");
 document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{$("#branch").value=btn.dataset.tab;document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");render()}));
}
async function init(){DATA=await fetch("research.json",{cache:"no-store"}).then(r=>r.json());fillBranches();render()}
$("#search").addEventListener("input",render);$("#branch").addEventListener("change",render);$("#currency").addEventListener("change",render);$("#status").addEventListener("change",render);$("#vpBudget").addEventListener("input",render);$("#cpBudget").addEventListener("input",render);
$("#closeDialog").addEventListener("click",()=>$("#researchDialog").close());
$("#researchDialog").addEventListener("click",e=>{if(e.target.id==="researchDialog")$("#researchDialog").close()});
$("#resetProgress").addEventListener("click",()=>{if(confirm("Naozaj chceš vynulovať celý progres?")){Object.keys(state).forEach(k=>delete state[k]);save();render()}});
$("#maxAll").addEventListener("click",()=>{if(confirm("Nastaviť všetkých 418 výskumov na maximum?")){allRows().forEach(x=>state[key(x.b,x.r)]=x.r.levels);save();render()}});
init().catch(err=>{$("#results").innerHTML='<div class="empty">Nepodarilo sa načítať research.json.<br>'+escapeHtml(err.message)+'</div>'});
