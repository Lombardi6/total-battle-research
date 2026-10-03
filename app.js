
const $=s=>document.querySelector(s);
const state=JSON.parse(localStorage.getItem("tbResearchState")||"{}");
const roman={i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10};
let DATA=[];

function save(){localStorage.setItem("tbResearchState",JSON.stringify(state))}
function norm(v){
  return String(v||"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9ivx]+/g," ").trim()
    .split(/\s+/).map(x=>roman[x]||x).join(" ");
}
function matches(text,q){
  q=norm(q); if(!q)return true;
  const h=norm(text);
  return q.split(/\s+/).every(x=>h.includes(x));
}
function num(v){
  const s=String(v).replace(/,/g,"").trim().toUpperCase(),m=s.match(/^([\d.]+)([KMBT]?)$/);
  if(!m)return 0;
  return Number(m[1])*({"":1,K:1e3,M:1e6,B:1e9,T:1e12}[m[2]]);
}
function fmt(n){
  if(n>=1e12)return (n/1e12).toFixed(2).replace(/\.00$/,"")+"T";
  if(n>=1e9)return (n/1e9).toFixed(2).replace(/\.00$/,"")+"B";
  if(n>=1e6)return (n/1e6).toFixed(2).replace(/\.00$/,"")+"M";
  if(n>=1e3)return (n/1e3).toFixed(2).replace(/\.00$/,"")+"K";
  return Math.round(n).toLocaleString("sk-SK");
}
function key(b,r){return b.id+"|"+r.name}
function current(b,r){return Math.max(0,Math.min(r.levels,Number(state[key(b,r)]||0)))}
function profile(r){
  if(r.curve&&r.curve.length)return r.curve.map(num);
  if(r.levels===1)return [num(r.total)];
  const total=num(r.total),step=total/r.levels;
  return Array.from({length:r.levels},()=>step);
}
function remaining(b,r){
  const c=current(b,r),p=profile(r);
  return p.slice(c).reduce((a,v)=>a+v,0)
}
function image(b,r){
  if(r.image)return `<img src="${r.image}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`;
  const parts=r.name.replace(/[’']/g,"").split(/\s+/).filter(Boolean);
  const initials=((parts[0]||"R")[0]+(parts[1]||"")[0]).toUpperCase();
  const tier=(r.name.match(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/)||[])[1]||"";
  return `<span class="fallback">${initials}</span><span class="tier">${tier}</span>`;
}
function card(b,r){
  const c=current(b,r),done=c===r.levels,p=profile(r),pct=r.levels?c/r.levels*100:0;
  return `<article class="card ${done?"done":""}" data-open="${encodeURIComponent(b.id+"|"+r.name)}">
    <div class="researchImage">${image(b,r)}</div>
    <div><h3>${escapeHtml(r.name)}</h3><small>${c}/${r.levels} levelov · ${b.currency}</small><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="price">${fmt(remaining(b,r))}<br>${b.currency}</div>
    <button class="toggle ${done?"done":""}" data-toggle="${encodeURIComponent(b.id+"|"+r.name)}">${done?"✓":"+"}</button>
  </article>`
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function allRows(){return DATA.flatMap(b=>b.items.map(r=>({b,r})))}

function render(){
  const q=norm($("#search").value), branch=$("#branch").value, currency=$("#currency").value, status=$("#status").value;
  const vp=Number($("#vpBudget").value||0),cp=Number($("#cpBudget").value||0);
  const active=branch==="all"?DATA:DATA.filter(b=>b.id===branch);
  let html="",shown=0;
  for(const b of active){
    if(currency!=="all"&&b.currency!==currency)continue;
    const rows=b.items.filter(r=>{
      const c=current(b,r),done=c===r.levels,cost=remaining(b,r),budget=b.currency==="VP"?vp:cp;
      return matches(r.name,q)||matches(b.name,q)
        ? (status==="all"||(status==="done"&&done)||(status==="todo"&&!done)||(status==="afford"&&cost<=budget))
        : false;
    });
    if(!rows.length)continue;
    shown+=rows.length;
    html+=`<section class="branch"><div class="branchHead"><div class="branchIcon">${b.currency==="VP"?"⚔":"♜"}</div><div><h2>${escapeHtml(b.name)}</h2><small>${b.count} výskumov · ${b.currency}</small></div><div class="right">${b.branch_total} ${b.currency}</div></div><div class="grid">${rows.map(r=>card(b,r)).join("")}</div></section>`;
  }
  $("#results").innerHTML=html||`<div class="empty">Nič sa nenašlo.<br>Skús „Monsters“, „Monsters VIII“ alebo vymaž filter.</div>`;
  document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",e=>{
    if(e.target.closest("[data-toggle]"))return;
    const [bid,name]=decodeURIComponent(el.dataset.open).split("|");
    openResearch(bid,name);
  }));
  document.querySelectorAll("[data-toggle]").forEach(el=>el.addEventListener("click",e=>{
    e.stopPropagation();
    const [bid,name]=decodeURIComponent(el.dataset.toggle).split("|");
    const b=DATA.find(x=>x.id===bid),r=b.items.find(x=>x.name===name);
    state[key(b,r)]=current(b,r)>=r.levels?0:r.levels;save();render();
  }));
  const totals=allRows().reduce((a,x)=>{
    const rem=remaining(x.b,x.r);
    a[x.b.currency.toLowerCase()]+=rem;
    a.levels+=x.r.levels-current(x.b,x.r);
    return a;
  },{vp:0,cp:0,levels:0});
  $("#vpTotal").textContent=fmt(totals.vp);$("#cpTotal").textContent=fmt(totals.cp);
  $("#doneTotal").textContent=((418-totals.levels)/418*100).toFixed(1)+"%";
  const affordable=allRows().filter(x=>remaining(x.b,x.r)>0&&(remaining(x.b,x.r)<=(x.b.currency==="VP"?vp:cp)));
  $("#budgetResult").textContent=affordable.length?`V rozpočte máš ${affordable.length} nedokončených výskumov/úsekov.`:"Zadaj zásobu VP/CP a uvidíš, ktoré ďalšie levely si môžeš dovoliť.";
}
function openResearch(bid,name){
  const b=DATA.find(x=>x.id===bid),r=b.items.find(x=>x.name===name),p=profile(r),c=current(b,r);
  $("#dialogBranch").textContent=b.name+" · "+b.currency;
  $("#dialogName").textContent=r.name;
  $("#dialogMeta").textContent=`${r.levels} levelov · celkom ${r.total} ${b.currency}`;
  $("#dialogImage").innerHTML=image(b,r);
  $("#levelPicker").innerHTML=p.map((v,i)=>`<button class="level ${i<c?"done":""} ${i===c?"current":""}" data-level="${i+1}">Level ${i+1}<small>${fmt(v)} ${b.currency}</small></button>`).join("");
  $("#dialogDone").textContent=`${c} / ${r.levels}`;
  $("#dialogRemaining").textContent=`${r.levels-c} levelov`;
  $("#dialogCost").textContent=fmt(p.slice(c).reduce((a,v)=>a+v,0))+" "+b.currency;
  $("#researchDialog").showModal();
  document.querySelectorAll("[data-level]").forEach(btn=>btn.addEventListener("click",()=>{
    state[key(b,r)]=Number(btn.dataset.level);save();openResearch(bid,name);render();
  }));
}
function fillBranches(){
  $("#branch").innerHTML='<option value="all">Všetky vetvy</option>'+DATA.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  $("#tabs").innerHTML='<button class="active" data-tab="all">Všetky</button>'+DATA.map(b=>`<button data-tab="${b.id}">${escapeHtml(b.name)}</button>`).join("");
  document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    $("#branch").value=btn.dataset.tab;document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");render();
  }));
}
async function init(){
  DATA=await fetch("research.json",{cache:"no-store"}).then(r=>r.json());
  fillBranches();render();
  ["search","branch","currency","status","vpBudget","cpBudget"].forEach(id=>$("#"+id).addEventListener("input",render));
  ["branch","currency","status"].forEach(id=>$("#"+id).addEventListener("change",render));
  $("#allBtn").onclick=()=>{for(const x of allRows())state[key(x.b,x.r)]=x.r.levels;save();render()};
  $("#noneBtn").onclick=()=>{for(const x of allRows())delete state[key(x.b,x.r)];save();render()};
  $("#resetBtn").onclick=()=>{if(confirm("Naozaj vymazať celý uložený progres?")){for(const k of Object.keys(state))delete state[k];save();render()}};
  $("#dialogClose").onclick=()=>$("#researchDialog").close();
}
init();
