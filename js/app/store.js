'use strict';

const LS_LOG='sudoku-log', LS_SES='sudoku-ses', LS_PEND='sudoku-pending';
const SYS_LANG=(()=>{ try{
  const langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en'];
  for(const l of langs){ const p=String(l).slice(0,2).toLowerCase(); if(I18N[p]) return p }
}catch(e){} return 'en' })();

const DEF_SETTINGS={theme:'light', pos:'center', lang:SYS_LANG, instant:true, limit:true, dblPick:true,
  showHint:false, showAuto:false, highlightSame:true, highlightPeers:true, showCounts:true, digitFirst:false,
  mode:'classic', pool:null};

let LOG={games:[], updated:0};
let SES={settings:{...DEF_SETTINGS}, games:[], cur:-1, updated:0};
let pending=[];

const cur=()=>SES.games[SES.cur]||null;
const allGames=()=>[...LOG.games,...pending];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* a move only touches the current game, so one key is written and after a pause:
   every digit used to serialize the whole record of wins as well */
let saveTimer=null, sesDirty=false;
function writeSes(){
  sesDirty=false;
  try{ localStorage.setItem(LS_SES,JSON.stringify(SES)) }catch(e){}
}
function persistCache(){
  SES.updated=Date.now();
  sesDirty=true;
  if(saveTimer) return;
  saveTimer=setTimeout(()=>{ saveTimer=null; if(sesDirty) writeSes() },600);
}
function savePending(){
  try{ localStorage.setItem(LS_PEND,JSON.stringify(pending)) }catch(e){}
}
/* written at once: leaving the page, a win, dropped games */
function persistNow(){
  if(saveTimer){ clearTimeout(saveTimer); saveTimer=null }
  if(sesDirty) writeSes();
  savePending();
}
function loadCache(){
  try{ const l=JSON.parse(localStorage.getItem(LS_LOG)); if(l&&Array.isArray(l.games)) LOG=l }catch(e){}
  try{ const s=JSON.parse(localStorage.getItem(LS_SES)); if(s&&s.settings){ SES=s;
    SES.settings=Object.assign({...DEF_SETTINGS},s.settings);
    if(!Array.isArray(SES.games)) SES.games=[] } }catch(e){}
  try{ const p=JSON.parse(localStorage.getItem(LS_PEND)); if(Array.isArray(p)) pending=p }catch(e){}

  for(const g of SES.games) if(!g.mode){ g.mode='classic'; g.ex={} }
  /* centre pencil marks came later than the first saved games */
  for(const g of SES.games) if(!Array.isArray(g.mid)) g.mid=Array.from({length:g.solution.length},()=>[]);
  for(const g of LOG.games) if(!g.mode) g.mode='classic';
  for(const g of pending) if(!g.mode) g.mode='classic';
  if(SES.settings.pool && !Array.isArray(SES.settings.pool)) SES.settings.pool=null;
  if(!MODE_IDS.includes(SES.settings.mode) && SES.settings.mode!=='random') SES.settings.mode='classic';
}
function saveLog(){
  const map=new Map();
  for(const g of LOG.games) map.set(g.id,g);
  for(const g of pending) map.set(g.id,g);
  LOG.games=[...map.values()].sort((a,b)=> a.d<b.d?-1:a.d>b.d?1:0);
  LOG.updated=Date.now();
  pending=[];
  try{ localStorage.setItem(LS_LOG,JSON.stringify(LOG)); localStorage.setItem(LS_PEND,'[]') }catch(e){}
}

function fmtTime(s){
  if(s==null) return '—';
  const h=(s/3600)|0, m=((s%3600)/60)|0, sec=s%60;
  return h? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
          : `${m}:${String(sec).padStart(2,'0')}`;
}
const blankStat=()=>({solved:0,best:null,total:0,perfect:0});

function statsFor(mode,diff){
  const s=blankStat();
  for(const g of allGames()){
    if(mode && g.mode!==mode) continue;
    if(diff && g.diff!==diff) continue;
    s.solved++; s.total+=g.time;
    if(g.mistakes===0&&g.hints===0) s.perfect++;
    if(s.best==null||g.time<s.best) s.best=g.time;
  }
  return s;
}

function poolList(){
  const p=SES.settings.pool;
  const list=(p&&p.length? p : MODE_IDS).filter(m=>MODE_IDS.includes(m));
  return list.length? list : MODE_IDS.slice();
}
