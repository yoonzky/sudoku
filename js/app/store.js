/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
'use strict';

const LS_SES='yoondoku-ses', LS_LOG='yoondoku-log';
const MAX_GAMES=8;
const SYS_LANG=(()=>{ try{
  for(const l of navigator.languages||[navigator.language||'ru']){ const p=String(l).slice(0,2).toLowerCase(); if(p==='ru'||p==='en') return p }
}catch(e){} return 'ru' })();

const DEF_SETTINGS={theme:'auto', lang:SYS_LANG, instant:true, limit:true, peers:true, same:true, counts:true,
  hintBtn:false, autoBtn:false, pool:null};

let SES={settings:{...DEF_SETTINGS}, games:[]};
let LOG=[];

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

let saveTimer=null;
function writeSes(){
  clearTimeout(saveTimer); saveTimer=null;
  try{ localStorage.setItem(LS_SES,JSON.stringify(SES)) }catch(e){}
}
/* a move writes after a pause, leaving the page writes at once */
function saveSoon(){ if(!saveTimer) saveTimer=setTimeout(writeSes,500) }
function saveLog(){ try{ localStorage.setItem(LS_LOG,JSON.stringify(LOG)) }catch(e){} }

function loadStore(){
  try{
    const s=JSON.parse(localStorage.getItem(LS_SES));
    if(s&&s.settings){ SES=s; SES.settings={...DEF_SETTINGS,...s.settings}; if(!Array.isArray(SES.games)) SES.games=[] }
  }catch(e){}
  try{ const l=JSON.parse(localStorage.getItem(LS_LOG)); if(Array.isArray(l)) LOG=l }catch(e){}
  /* first run on the same site: solved games of the old version carry over */
  try{
    if(!localStorage.getItem(LS_LOG)){
      const old=JSON.parse(localStorage.getItem('sudoku-log'));
      if(old&&Array.isArray(old.games)){ LOG=old.games.map(g=>({...g, mode:g.mode==='meow'?'tokki':g.mode})); saveLog() }
    }
  }catch(e){}
  SES.games=SES.games.filter(g=>g&&MODE_IDS.includes(g.mode)&&Array.isArray(g.val));
}

function statsFor(mode,diff){
  const s={solved:0,best:null,total:0,clean:0};
  for(const g of LOG){
    if(mode&&g.mode!==mode) continue;
    if(diff&&g.diff!==diff) continue;
    s.solved++; s.total+=g.time;
    if(!g.mistakes&&!g.hints) s.clean++;
    if(s.best==null||g.time<s.best) s.best=g.time;
  }
  return s;
}
function poolList(){
  const p=SES.settings.pool;
  const list=(p&&p.length? p : MODE_IDS).filter(m=>MODE_IDS.includes(m));
  return list.length? list : MODE_IDS.slice();
}
