'use strict';

const $=id=>document.getElementById(id);
/* two themes; their colours live in css/base.css and are read from there */
const THEMES=[{id:'light'},{id:'dark'}];
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let lastPointerType='mouse';
const PHONE_Q=matchMedia('(max-width:700px)');
const LAND_Q=matchMedia('(orientation:landscape) and (max-height:560px) and (min-width:560px)');
const isPhone=()=>PHONE_Q.matches||LAND_Q.matches;
/* the sheet serves every width with no room for the side column, so it
   starts where that column ends, not at the phone breakpoint */
const SHEET_Q=matchMedia('(max-width:900px)');
const sheetWidth=()=>SHEET_Q.matches;
const isLand=()=>LAND_Q.matches;
/* on a wide screen with a mouse the pad stands beside the board */
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
/* time on screen follows the length: two and a bit seconds was not enough
   for a long message like a game pushed out of the list */
function toast(msg){
  const el=$('toast'); el.textContent=msg; el.classList.add('show');
  const ms=Math.min(7000, Math.max(2600, 1600+msg.length*65));
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),ms);
}
function show(screen){
  closeSheet();
  $('home').classList.toggle('hidden',screen!=='home');
  $('game').classList.toggle('hidden',screen!=='game');
  document.body.classList.toggle('in-game',screen==='game');
  if(screen==='game') snapBoard();
}
function openSheet(){
  if(!sheetWidth()) return;
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
  digit:'<svg viewBox="0 0 24 24"><path d="M9.6 8.4 13 5.9v12.2" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.9 18.1h6.2" stroke-width="1.9" stroke-linecap="round"/></svg>',
  note:'<svg viewBox="0 0 24 24"><circle cx="6.6" cy="6.6" r="2" fill="currentColor" stroke="none"/><circle cx="17.4" cy="6.6" r="2" fill="currentColor" stroke="none"/><circle cx="6.6" cy="17.4" r="2" fill="currentColor" stroke="none"/><circle cx="17.4" cy="17.4" r="2" fill="currentColor" stroke="none"/></svg>',
  mid:'<svg viewBox="0 0 24 24"><circle cx="6.4" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="17.6" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
};
const PK_TABS={digit:'digitTab', note:'noteTab', mid:'midTab'};
function buildPicker(sp){
  const pk=$('picker');
  pk.innerHTML='';
  pk.classList.toggle('pk-ten', sp.maxD===10 && sp.kind!=='num');
  pk.classList.toggle('pk-wide', sp.maxD>10 && sp.kind!=='num');
  pk.classList.toggle('pk-num', sp.kind==='num');
  if(sp.kind==='num'){ buildNumPicker(pk); return }
  const hdr=document.createElement('div');
  hdr.className='pk-mode';
  hdr.innerHTML=['digit','note','mid'].map(m=>
    `<button data-m="${m}" title="${t(PK_TABS[m])}">${PK_ICONS[m]}</button>`).join('');
  hdr.querySelectorAll('button').forEach(b=>b.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    setMode(b.dataset.m); renderBoard();
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
  const m=activeMode();
  pk.querySelectorAll('.pk-mode button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  pk.classList.toggle('mode-note',m==='note');
  pk.classList.toggle('mode-mid',m==='mid');
}
function refreshPickerCounts(){
  const pk=$('picker'); if(pk.classList.contains('hidden')) return;
  const g=cur(); if(!g){ closePicker(); return }
  const counts={};
  for(let k=0;k<SPEC.cells.length;k++){ const v=g.values[k]; if(v) counts[v]=(counts[v]||0)+1 }
  const tot=digitTotals(g);
  const showCounts=SES.settings.showCounts!==false;
  pk.querySelectorAll('button[data-v]').forEach(b=>{
    const v=+b.dataset.v, left=(tot[v]||0)-(counts[v]||0);
    b.classList.toggle('done',left<=0);
    const s=b.querySelector('small'); if(s) s.textContent=(showCounts&&left>0)?left:'';
  });
}
function openPicker(i){
  if(!pickerAllowed()||!SPEC||!SES.settings.dblPick||SPEC.kind==='tokki') return;
  dismissPickHint();
  const g=cur(); if(!g||g.done||g.paused) return;
  /* opened over a picked run the pad fills all of it, so the run stays */
  const run=msel.size>1 && msel.has(i);
  if(!run && g.given[i]) return;
  if(!run) sel=i;
  renderBoard();
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
  pk.querySelectorAll('.pk-mode button').forEach(b=>{ b.title=t(PK_TABS[b.dataset.m]||'digitTab') });
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
  : SPEC&&SPEC.kind==='tokki'? 'sudoku-tokkiHint' : 'sudoku-pickHint';
function updatePickHint(){
  const el=$('pickHint'); if(!el||!SPEC) return;
  let seen=false; try{ seen=!!localStorage.getItem(hintKey()) }catch(e){}
  const num=SPEC.kind==='num', tokki=SPEC.kind==='tokki';
  el.textContent = tokki? (COARSE? t('tokkiHintTouch') : t('tokkiHint'))
    : num? (COARSE? t('numHintTouch') : t('numHint')) : t('pickHint');
  el.classList.toggle('hidden', seen || (!num && !tokki && (!SES.settings.dblPick || !pickerAllowed())));
  placePickHint();
}
function dismissPickHint(){
  try{ localStorage.setItem(hintKey(),'1') }catch(e){}
  const el=$('pickHint'); if(!el||el.classList.contains('hidden')) return;
  el.classList.add('hidden');
}

function openStats(){
  const th=k=>`<th scope="col">${t(k)}</th>`;
  let h=`<tr>${th('level')}${th('hSolved')}${th('hBest')}${th('avgL')}${th('hClean')}</tr>`;
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
    ? `<tr>${th('modesT')}${th('hSolved')}${th('hBest')}${th('avgL')}${th('hClean')}</tr>`+h2
    : '';
  const hist=[...allGames()].sort((a,b)=> a.d<b.d?1:-1).slice(0,12);
  const loc=SES.settings.lang==='ru'?'ru-RU':'en-GB';
  const fmtDay=d=>{ const p=d.split('-'); return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString(loc,{day:'numeric',month:'short'}) };
  $('histList').innerHTML=
    `<h3>${t('histT')}</h3>`+
    (hist.map(x=>`<div><span>${fmtDay(x.d)} · ${t('m_'+x.mode)} · ${t('d_'+x.diff)}</span><span><b>${fmtTime(x.time)}</b>${x.mistakes?` · ${t('mist')} ${x.mistakes}`:''}${x.hints?` · ${t('hintsSm')} ${x.hints}`:''}</span></div>`).join('')||`<div>${t('none')}</div>`)+
    `<div class="hist-foot"><span>${t('dataAt')}</span><span>${LOG.updated? new Date(LOG.updated).toLocaleString(loc,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span></div>`;
  $('resetStats').disabled=!allGames().length;
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
  $('krowHint').classList.toggle('off', !SES.settings.showHint);
  $('krowAuto').classList.toggle('off', !SES.settings.showAuto);
  applyLayout(); setTab(tab||'view');
  $('setModal').classList.remove('hidden');
}
function setTab(name){
  if(name==='keys'&&getComputedStyle($('tabKeysBtn')).display==='none') name='view';
  document.querySelectorAll('.stabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  for(const tb of ['view','game','keys']) $('tab-'+tb).classList.toggle('hidden',tb!==name);
}
/* asked once, before the very first deal: whether a wrong digit says so
   at once or the board is checked when full. The answer is the instant
   check setting and stays changeable there */
const CHECK_ASKED='sudoku-checkAsked';
function needCheckAsk(){
  if(SES.games.length||LOG.games.length||pending.length) return false;
  try{ return !localStorage.getItem(CHECK_ASKED) }catch(e){}
  return false;
}
function askCheck(){
  return new Promise(res=>{
    const bg=$('checkModal');
    bg.classList.remove('hidden');
    const done=on=>{
      SES.settings.instant=on;
      if(!on) SES.settings.limit=false;
      persistCache();
      try{ localStorage.setItem(CHECK_ASKED,'1') }catch(e){}
      bg.classList.add('hidden');
      $('checkOn').onclick=$('checkOff').onclick=bg.onclick=null;
      res(on);
    };
    $('checkOn').onclick=()=>done(true);
    $('checkOff').onclick=()=>done(false);
    bg.onclick=e=>{ if(e.target===bg) done(true) };
  });
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
  const rtag=I18N[SES.settings.lang]&&I18N[SES.settings.lang]['tag_'+g.mode] || I18N.en['tag_'+g.mode] || '';
  $('rulesTag').textContent=rtag;
  $('rulesTag').classList.toggle('hidden', !rtag);
  $('rulesPrev').innerHTML=previewSVG(g.mode);
  $('rulesModal').classList.remove('hidden');
}

/* ── dialogs for the keyboard and the screen reader ─────────────── */
/* windows open and close in several places, so roles and the focus trap
   are wired once and follow the hidden class */
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
  /* focus lands on the window, not the first button: otherwise Enter goes
     straight into reset statistics and the like */
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
