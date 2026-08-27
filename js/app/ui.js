'use strict';

const $=id=>document.getElementById(id);
/* two themes; their colours live in css/base.css and are read from there */
const THEMES=[{id:'light'},{id:'dark'}];
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let lastPointerType='mouse';
const PHONE_Q=matchMedia('(max-width:700px)');
const LAND_Q=matchMedia('(orientation:landscape) and (max-height:560px) and (min-width:560px)');
const isPhone=()=>PHONE_Q.matches||LAND_Q.matches;
const isLand=()=>LAND_Q.matches;
/* на большом экране с мышью пульт встаёт справа от поля, а не под ним */
const RAIL_Q=matchMedia('(min-width:1040px) and (min-height:660px) and (pointer:fine)');
const isRail=()=>RAIL_Q.matches;
function syncRail(){ document.body.classList.toggle('rail', isRail()) }
const COARSE=(()=>{ try{ return matchMedia('(pointer:coarse)').matches }catch(e){} return false })();
function pickerAllowed(){
  if(lastPointerType==='touch'||COARSE) return false;
  try{ if(!matchMedia('(pointer:fine)').matches) return false }catch(e){}
  return true;
}
let toastTimer=null;
function toast(msg){
  const el=$('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}
function show(screen){
  closeSheet();
  $('home').classList.toggle('hidden',screen!=='home');
  $('game').classList.toggle('hidden',screen!=='game');
  document.body.classList.toggle('in-game',screen==='game');
  if(screen==='game') snapBoard();
}
function openSheet(){
  if(!isPhone()) return;
  const mp=$('modePanel');
  document.body.classList.add('sheet');
  mp.scrollTop=0;
}
function closeSheet(){ document.body.classList.remove('sheet') }
function sheetOpen(){ return document.body.classList.contains('sheet') }

function applyTheme(){
  if(!THEMES.find(x=>x.id===SES.settings.theme)) SES.settings.theme=THEMES[0].id;
  document.documentElement.dataset.theme=SES.settings.theme;
  const bg=cssVar('--bg'), accent=cssVar('--accent');
  if(bg) $('metaTheme').setAttribute('content',bg);
  document.querySelectorAll('.sw').forEach(b=>b.classList.toggle('selq',b.dataset.t===SES.settings.theme));
  setFavicon(bg||'#0d1119', accent||'#9ec1f5');
}
function setFavicon(bg,accent){
  let cellsSvg='';
  for(let r=0;r<3;r++) for(let c=0;c<3;c++)
    cellsSvg+=`<rect x="${10+c*16}" y="${10+r*16}" width="12" height="12" rx="3.5" fill="${accent}" opacity="${r===c?'1':'.18'}"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${bg}"/>${cellsSvg}</svg>`;
  let link=document.querySelector('link[rel="icon"]');
  if(!link){ link=document.createElement('link'); link.rel='icon'; document.head.appendChild(link) }
  link.href='data:image/svg+xml,'+encodeURIComponent(svg);
}
function applyLayout(){ placePickHint() }

const PK_ICONS={
  digit:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>',
  note:'<svg viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/></svg>',
  mid:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/><circle cx="8.6" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>',
  hyp:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" stroke-dasharray="3 2.6"/></svg>',
};
function buildPicker(sp){
  const pk=$('picker');
  pk.innerHTML='';
  pk.classList.toggle('pk-ten', sp.maxD===10 && sp.kind!=='num');
  pk.classList.toggle('pk-wide', sp.maxD>10 && sp.kind!=='num');
  pk.classList.toggle('pk-num', sp.kind==='num');
  if(sp.kind==='num'){ buildNumPicker(pk); return }
  const hdr=document.createElement('div');
  hdr.className='pk-mode';
  const tabName={digit:'digitTab', note:'noteTab', hyp:'hypTab'};
  hdr.innerHTML=['digit','note','hyp'].map(m=>
    `<button data-m="${m}" title="${t(tabName[m])}">${PK_ICONS[m]}</button>`).join('');
  hdr.querySelectorAll('button').forEach(b=>b.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    inputMode=b.dataset.m; syncModeButtons(); renderBoard();
  }));
  pk.appendChild(hdr);
  for(let v=1;v<=sp.maxD;v++){
    const b=document.createElement('button');
    b.dataset.v=v; b.innerHTML=`${v}<small></small>`;
    b.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); inputDigit(v); closePicker() });
    pk.appendChild(b);
  }
  addEraseRow(pk);
}

function addEraseRow(pk){
  const x=document.createElement('button');
  x.className='pk-x';
  x.innerHTML=`<svg viewBox="0 0 24 24"><path d="M9 20 3 14 13 4l6 6-10 10Z"/><path d="M21 20H9"/><path d="m7 10 6 6"/></svg><span class="pk-x-t">${t('eraseP')}</span>`;
  x.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); eraseCell(); closePicker() });
  pk.appendChild(x);
}
/* bound once: inside addEraseRow it piled up another listener per game */
$('picker').addEventListener('pointerdown',e=>e.stopPropagation());

function buildNumPicker(pk){
  for(let v=1;v<=9;v++) pk.appendChild(numKey(v));
  pk.appendChild(numKey(0));
  addEraseRow(pk);
}
function numKey(v){
  const b=document.createElement('button');
  b.dataset.v=v; b.textContent=v;
  b.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    const cell=sel;
    inputDigit(v);
    const now=cell>=0? (cur()? cur().values[cell] : 0) : 0;
    if(!now || now*10>SPEC.maxD) closePicker();
  });
  return b;
}
function syncPickerMode(){
  const pk=$('picker');
  pk.querySelectorAll('.pk-mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===inputMode));
  pk.classList.toggle('mode-note',inputMode==='note'||inputMode==='mid');
  pk.classList.toggle('mode-hyp',inputMode==='hyp');
}
function refreshPickerCounts(){
  const pk=$('picker'); if(pk.classList.contains('hidden')) return;
  const g=cur(); if(!g){ closePicker(); return }
  const counts={};
  for(let k=0;k<SPEC.cells.length;k++){ const v=merged(g,k); if(v) counts[v]=(counts[v]||0)+1 }
  const tot=digitTotals(g);
  const showCounts=SES.settings.showCounts!==false;
  pk.querySelectorAll('button[data-v]').forEach(b=>{
    const v=+b.dataset.v, left=(tot[v]||0)-(counts[v]||0);
    b.classList.toggle('done',left<=0);
    const s=b.querySelector('small'); if(s) s.textContent=(showCounts&&left>0)?left:'';
  });
}
function openPicker(i){
  if(!pickerAllowed()||!SPEC||!SES.settings.dblPick||SPEC.kind==='meow') return;
  dismissPickHint();
  const g=cur(); if(!g||g.done||g.paused||g.given[i]) return;
  sel=i; renderBoard();
  const pk=$('picker');
  if(SPEC.kind!=='num') syncPickerMode();
  pk.classList.remove('hidden');
  if(SPEC.kind!=='num') refreshPickerCounts();
  placePicker(i);
}
function placePicker(i){
  const pk=$('picker'), wrap=document.querySelector('.board-wrap');
  if(!wrap||!cells[i]) return;
  const wrapR=wrap.getBoundingClientRect(), cellR=cells[i].getBoundingClientRect();
  const pw=pk.offsetWidth, ph=pk.offsetHeight, pad=6;
  let left=cellR.right+8;
  if(left+pw>window.innerWidth-pad) left=cellR.left-8-pw;
  if(left<pad) left=Math.max(pad,(window.innerWidth-pw)/2);
  left=Math.min(left,Math.max(pad,window.innerWidth-pw-pad));
  let top=cellR.top+cellR.height/2-ph/2;
  top=Math.max(pad,Math.min(top,window.innerHeight-ph-pad));
  pk.style.left=Math.round(left-wrapR.left)+'px';
  pk.style.top=Math.round(top-wrapR.top)+'px';
}
function closePicker(){ $('picker').classList.add('hidden') }
function refreshPickerLang(){
  const pk=$('picker');
  const tabs=pk.querySelectorAll('.pk-mode button');
  if(tabs.length===4){ tabs[0].title=t('digitTab'); tabs[1].title=t('noteTab');
    tabs[2].title=t('midTab'); tabs[3].title=t('hypTab') }
  const xt=pk.querySelector('.pk-x-t'); if(xt) xt.textContent=t('eraseP');
}
function placePickHint(){
  const el=$('pickHint');
  if(!el||el.classList.contains('hidden')) return;
  if(isPhone()){
    el.classList.remove('right-side');
    el.style.left=el.style.top=''; el.style.visibility='';
    return;
  }
  const b=$('board').getBoundingClientRect();
  if(!b.width) return;
  const w=el.offsetWidth||176, gap=20;
  const rightRoom=window.innerWidth-b.right, leftRoom=b.left;
  const useRight=rightRoom>=leftRoom;
  const room=useRight? rightRoom : leftRoom;
  if(room<w+gap+6){ el.style.visibility='hidden'; return }
  el.style.visibility='';
  el.classList.toggle('right-side',!useRight);
  el.style.left=Math.round(useRight? b.right+gap : b.left-gap-w)+'px';
  el.style.top=Math.round(b.top+b.height/2-el.offsetHeight/2)+'px';
}
const hintKey=()=> SPEC&&SPEC.kind==='num'? 'sudoku-numHint'
  : SPEC&&SPEC.kind==='meow'? 'sudoku-meowHint' : 'sudoku-pickHint';
function updatePickHint(){
  const el=$('pickHint'); if(!el||!SPEC) return;
  let seen=false; try{ seen=!!localStorage.getItem(hintKey()) }catch(e){}
  const num=SPEC.kind==='num', meow=SPEC.kind==='meow';
  el.textContent = meow? (COARSE? t('meowHintTouch') : t('meowHint'))
    : num? (COARSE? t('numHintTouch') : t('numHint')) : t('pickHint');
  el.classList.toggle('hidden', seen || (!num && !meow && (!SES.settings.dblPick || !pickerAllowed())));
  placePickHint();
}
function dismissPickHint(){
  try{ localStorage.setItem(hintKey(),'1') }catch(e){}
  const el=$('pickHint'); if(!el||el.classList.contains('hidden')) return;
  el.classList.add('hidden');
}

function openStats(){
  let h=`<tr><th>${t('level')}</th><th>${t('hSolved')}</th><th>${t('hBest')}</th><th>${t('avgL')}</th><th>${t('hClean')}</th></tr>`;
  for(const d of DIFFS){
    const s=statsFor(null,d), avg=s.solved?Math.round(s.total/s.solved):null;
    h+=`<tr><td>${t('d_'+d)}</td><td>${s.solved}</td><td>${fmtTime(s.best)}</td><td>${fmtTime(avg)}</td><td>${s.perfect}</td></tr>`;
  }
  $('statsTable').innerHTML=h;
  let h2='';
  for(const id of MODE_IDS){
    const s=statsFor(id,null);
    if(!s.solved) continue;
    const avg=Math.round(s.total/s.solved);
    h2+=`<tr><td>${t('m_'+id)}</td><td>${s.solved}</td><td>${fmtTime(s.best)}</td><td>${fmtTime(avg)}</td><td>${s.perfect}</td></tr>`;
  }
  $('statsModes').innerHTML = h2
    ? `<tr><th>${t('modesT')}</th><th>${t('hSolved')}</th><th>${t('hBest')}</th><th>${t('avgL')}</th><th>${t('hClean')}</th></tr>`+h2
    : '';
  const hist=[...allGames()].sort((a,b)=> a.d<b.d?1:-1).slice(0,12);
  const loc=SES.settings.lang==='ru'?'ru-RU':'en-GB';
  const fmtDay=d=>{ const p=d.split('-'); return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString(loc,{day:'numeric',month:'short'}) };
  $('histList').innerHTML=
    `<h3>${t('histT')}</h3>`+
    (hist.map(x=>`<div><span>${fmtDay(x.d)} · ${t('m_'+x.mode)} · ${t('d_'+x.diff)}</span><span><b>${fmtTime(x.time)}</b>${x.mistakes?` · ${t('mist')} ${x.mistakes}`:''}${x.hints?` · ${t('hintsSm')} ${x.hints}`:''}</span></div>`).join('')||`<div>${t('none')}</div>`)+
    `<div class="hist-foot"><span>${t('dataAt')}</span><span>${LOG.updated? new Date(LOG.updated).toLocaleString(loc,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span></div>`;
  $('statsModal').classList.remove('hidden');
}
async function resetStats(){
  if(!await askConfirm(t('resetConfirm'))) return;
  pending=[]; LOG.games=[]; LOG.updated=Date.now();
  try{ localStorage.setItem(LS_LOG,JSON.stringify(LOG)); localStorage.setItem(LS_PEND,'[]') }catch(e){}
  renderHome();
  if(!$('statsModal').classList.contains('hidden')) openStats();
  toast(t('resetDone'));
}

function buildSwatches(){
  const wrap=$('swatches');
  for(const th of THEMES){
    const b=document.createElement('button');
    b.className='sw'; b.dataset.t=th.id;
    b.innerHTML=`<span>${t('th_'+th.id)}</span>`;
    b.addEventListener('click',()=>{ SES.settings.theme=th.id; applyTheme(); persistCache() });
    wrap.appendChild(b);
  }
}
function openSettings(tab){
  $('optInstant').checked=SES.settings.instant;
  $('optLimit').checked=SES.settings.limit;
  $('optLimit').disabled=!SES.settings.instant;
  $('optDbl').checked=SES.settings.dblPick;
  $('optSame').checked=SES.settings.highlightSame!==false;
  $('optPeers').checked=SES.settings.highlightPeers!==false;
  $('optCounts').checked=SES.settings.showCounts!==false;
  $('optDigitFirst').checked=!!SES.settings.digitFirst;
  $('optHintBtn').checked=SES.settings.showHint;
  $('optAutoBtn').checked=SES.settings.showAuto;
  applyLayout(); setTab(tab||'view');
  $('setModal').classList.remove('hidden');
}
function setTab(name){
  if(name==='keys'&&getComputedStyle($('tabKeysBtn')).display==='none') name='view';
  document.querySelectorAll('.stabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  for(const tb of ['view','game','keys']) $('tab-'+tb).classList.toggle('hidden',tb!==name);
}
function askConfirm(msg){
  return new Promise(res=>{
    const bg=$('confirmModal');
    $('confirmText').textContent=msg;
    $('confirmYes').textContent=t('yes'); $('confirmNo').textContent=t('cancel');
    bg.classList.remove('hidden');
    const done=v=>{ bg.classList.add('hidden');
      $('confirmYes').onclick=$('confirmNo').onclick=bg.onclick=null; res(v) };
    $('confirmYes').onclick=()=>done(true);
    $('confirmNo').onclick=()=>done(false);
    bg.onclick=e=>{ if(e.target===bg) done(false) };
  });
}

function openRules(){
  const g=cur(); if(!g) return;
  $('rulesName').textContent=t('m_'+g.mode);
  $('rulesText').textContent=t('r_'+g.mode);
  $('rulesPrev').innerHTML=previewSVG(g.mode);
  $('rulesModal').classList.remove('hidden');
}

/* ── диалоги для клавиатуры и скринридера ───────────────────────── */
/* окна открываются и закрываются в разных местах кода, поэтому роли и
   ловушка фокуса навешиваются один раз и следят за классом hidden */
const FOCUSABLE='button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
let dlgReturn=null;
function dialogFrame(bg){
  const box=bg.querySelector('.modal'); if(!box) return null;
  if(!box.hasAttribute('role')){
    box.setAttribute('role','dialog');
    box.setAttribute('aria-modal','true');
    box.setAttribute('tabindex','-1');
    const h=box.querySelector('h2');
    if(h){ if(!h.id) h.id=bg.id+'Title'; box.setAttribute('aria-labelledby',h.id) }
  }
  return box;
}
function openDialog(bg){
  const box=dialogFrame(bg); if(!box) return;
  dlgReturn=document.activeElement;
  /* фокус на само окно, а не на первую кнопку: иначе Enter сразу жмёт
     «Сбросить статистику» и подобное */
  box.focus({preventScroll:true});
}
function closeDialog(){
  const el=dlgReturn; dlgReturn=null;
  if(el && document.contains(el)) el.focus({preventScroll:true});
}
function openDialogEl(){
  for(const bg of document.querySelectorAll('.modal-bg'))
    if(!bg.classList.contains('hidden')) return bg;
  return null;
}
function initDialogs(){
  const list=[...document.querySelectorAll('.modal-bg')];
  for(const bg of list){
    dialogFrame(bg);
    new MutationObserver(()=>{
      if(bg.classList.contains('hidden')){ if(!openDialogEl()) closeDialog() }
      else openDialog(bg);
    }).observe(bg,{attributes:true, attributeFilter:['class']});
  }
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab') return;
    const bg=openDialogEl(); if(!bg) return;
    const box=bg.querySelector('.modal'); if(!box) return;
    const items=[...box.querySelectorAll(FOCUSABLE)].filter(el=>el.offsetParent!==null);
    if(!items.length) return;
    const first=items[0], last=items[items.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus() }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus() }
    else if(!box.contains(document.activeElement)){ e.preventDefault(); first.focus() }
  },true);
}
