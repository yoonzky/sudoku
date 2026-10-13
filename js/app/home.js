'use strict';

const GROUPS=[
  ['g_plain',['classic','x','evenodd','windoku','asterisk','mosaic']],
  ['g_size',['r10','r12']],
  ['g_linked',['double','wing','butterfly','samurai']],
  ['g_rules',['killer','dots','suguru','kakuro','numerator','tokki']]];
const groupOf=m=>(GROUPS.find(g=>g[1].includes(m))||['g_plain'])[0];
let editing=false;

function progressOf(g){
  if(g.mode==='tokki'){
    const all=g.sol.filter(v=>v===TOKKI_BUN).length, on=g.val.filter((v,i)=>v===TOKKI_BUN&&g.sol[i]===TOKKI_BUN).length;
    return all? on/all : 0;
  }
  let open=0, ok=0;
  for(let i=0;i<g.sol.length;i++) if(!g.given[i]){ open++; if(g.val[i]) ok++ }
  return open? ok/open : 0;
}
function bestLine(m){
  let b=null;
  for(const d of DIFFS){ const s=statsFor(m,d).best; if(s!=null&&(b==null||s<b)) b=s }
  return b!=null? tf('best',{t:fmtTime(b)}) : '';
}

function renderHome(){
  const games=SES.games.slice().sort((a,b)=>b.at-a.at);
  if(!games.length) editing=false;
  $('home').classList.toggle('editing',editing);
  $('contSec').classList.toggle('hidden',!games.length);
  $('editBtn').textContent=t(editing?'done':'edit');
  $('contShelf').innerHTML=games.map(g=>{
    const p=progressOf(g);
    return `<button class="cont" data-id="${g.id}">
      <span class="mini">${gamePic(g,96)}</span>
      <span class="info"><b>${t('m_'+g.mode)}</b><small>${t('d_'+g.diff)}</small>
        <span class="bar"><i style="width:${Math.round(p*100)}%"></i></span>
        <span class="t num">${Math.round(p*100)}%, ${fmtTime(g.time)}</span></span>
      ${editing? `<span class="del" data-del="${g.id}" role="button" aria-label="${t('delGame')}">${ic('minus')}</span>` : ''}</button>`;
  }).join('');
  let h='';
  for(const [cap,ids] of GROUPS){
    h+=`<section><div class="shelf-head"><h2>${t(cap)}</h2></div><div class="shelf">`;
    for(const m of ids){
      const b=bestLine(m);
      h+=`<button class="tile" data-mode="${m}"><span class="art">${modeArt(m,96)}</span><b>${t('m_'+m)}</b><small>${b}</small></button>`;
    }
    h+='</div></section>';
  }
  $('shelves').innerHTML=h;
  $('homeTitle').textContent='Yoondoku';
}

/* the card of a mode opens out of its tile */
function openMode(m,from){
  const random=m==='random';
  const art=innerWidth<=640? Math.min(240,innerWidth-80) : Math.max(180,Math.min(340,innerHeight-150));
  const levels=DIFFS.map(d=>{
    const s=random? statsFor(null,d) : statsFor(m,d);
    const going=!random && SES.games.some(g=>g.mode===m&&g.diff===d);
    return `<button class="lv" data-diff="${d}">${t('d_'+d)}${going? `<span class="cont-dot">${t('inProgress')}</span>` : ''}
      <span class="meta num">${s.best!=null? tf('best',{t:fmtTime(s.best)}) : t('notPlayed')}</span><span class="go" aria-hidden="true">${t('playLv')}</span></button>`;
  }).join('');
  const tag=random? '' : (I18N[SES.settings.lang]||I18N.ru)['tag_'+m];
  const poolBlock=`<div class="pool-wrap"><div class="pool-bar"><span id="poolN">${tf('poolN',{n:poolList().length})}</span><div><button class="link" data-pool="all">${t('poolAll')}</button><button class="link" data-pool="none">${t('poolNone')}</button></div></div><div class="pool" id="pool">${poolHTML()}</div></div>`;
  const pic=random? poolBlock : `<span class="art" style="--art:${art}px">${modeArt(m,art)}</span>`;
  let body=`<div class="msheet${random?' rnd':''}">${pic}<div>
    <h1>${t('m_'+m)}</h1>${random? '' : `<div class="grp">${t(groupOf(m))}</div>`}
    <p>${t('r_'+m)}</p>${tag? `<div class="tag">${esc(tag)}</div>` : ''}
    <div class="levels">${levels}</div>`;
  body+='</div></div>';
  const sh=openSheet(body,{from});
  sh.addEventListener('click',e=>{
    const lv=e.target.closest('.lv');
    if(lv){
      const d=lv.dataset.diff;
      const open=!random && SES.games.filter(g=>g.mode===m&&g.diff===d).sort((a,b)=>b.at-a.at)[0];
      closeSheet(true);
      if(open) openGame(open); else newGame(m,d);
      return;
    }
    const pb=e.target.closest('[data-pool]');
    if(pb){ SES.settings.pool= pb.dataset.pool==='all'? null : []; poolSync(); return }
    const pm=e.target.closest('#pool button');
    if(pm){
      const set=new Set(SES.settings.pool&&SES.settings.pool.length? SES.settings.pool : (SES.settings.pool? [] : MODE_IDS));
      set.has(pm.dataset.m)? set.delete(pm.dataset.m) : set.add(pm.dataset.m);
      SES.settings.pool=MODE_IDS.filter(x=>set.has(x));
      if(SES.settings.pool.length===MODE_IDS.length) SES.settings.pool=null;
      poolSync();
    }
  });
}
function poolHTML(){
  const on=new Set(SES.settings.pool? SES.settings.pool : MODE_IDS);
  return MODE_IDS.map(m=>`<button data-m="${m}" class="${on.has(m)?'on':''}"><span class="ck">${ic('check')}</span>${modeArt(m,40)}${t('m_'+m)}</button>`).join('');
}
function poolSync(){
  const empty=SES.settings.pool&&!SES.settings.pool.length;
  $('pool').innerHTML=poolHTML();
  $('poolN').textContent= empty? t('poolEmpty') : tf('poolN',{n:poolList().length});
  document.querySelectorAll('.lv').forEach(b=>b.disabled=!!empty);
  saveSoon();
}

function bindHome(){
  $('shelves').addEventListener('click',e=>{ const b=e.target.closest('.tile'); if(b) openMode(b.dataset.mode,b) });
  $('rndBtn').addEventListener('click',e=>openMode('random',e.currentTarget));
  $('editBtn').addEventListener('click',()=>{ editing=!editing; renderHome() });
  $('contShelf').addEventListener('click',async e=>{
    const del=e.target.closest('[data-del]');
    if(del){
      e.stopPropagation();
      if(await ask({text:t('delGameQ'), ok:t('delete'), danger:true})){
        SES.games=SES.games.filter(g=>g.id!==del.dataset.del); writeSes(); renderHome();
      }
      return;
    }
    const c=e.target.closest('.cont');
    if(!c||editing) return;
    const g=SES.games.find(x=>x.id===c.dataset.id);
    if(g){ lastDeal={mode:g.mode,diff:g.diff}; openGame(g) }
  });
}
