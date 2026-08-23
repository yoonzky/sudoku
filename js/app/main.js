'use strict';

let tapX=0, tapY=0, tapIdx=-1;
let sweepOn=false, sweepSeen=null;
function tapCancel(){ tapIdx=-1 }
function sweepStop(){ sweepOn=false; sweepSeen=null }

function tapCell(i){
  const g=cur(); if(!g||g.paused) return;
  closePicker();
  if(SPEC.kind==='meow'){ sel=i; meowTap(i); return }
  if(i!==sel) numFlush();
  if(SES.settings.digitFirst && armed && !g.done && !g.given[i] && SPEC.kind!=='num'){
    sel=i; inputDigit(armed); hlDigit=armed; renderBoard(); return;
  }
  sel=i; hlDigit=0; renderBoard();
}

$('board').addEventListener('pointerdown',e=>{
  const el=e.target.closest('.cell'); if(!el) return;
  lastPointerType=e.pointerType||'mouse';
  const g=cur(); if(!g||g.paused) return;
  const i=+el.dataset.i;
  if(SPEC.kind==='meow'){
    if(e.button===2) return;
    sweepOn=true; sweepSeen=new Set([i]);
    tapIdx=i; tapX=e.clientX; tapY=e.clientY;
    if(e.pointerType!=='touch') tapCell(i);
    return;
  }
  if(e.pointerType!=='touch'){ tapCell(i); return }
  tapIdx=i; tapX=e.clientX; tapY=e.clientY;
});
$('board').addEventListener('pointermove',e=>{
  if(sweepOn){
    if(Math.abs(e.clientX-tapX)<8 && Math.abs(e.clientY-tapY)<8) return;
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const cell=el&&el.closest&&el.closest('.cell');
    if(!cell) return;
    const j=+cell.dataset.i;
    if(sweepSeen.has(j)) return;
    sweepSeen.add(j);
    tapIdx=-1;
    meowSweep(j);
    return;
  }
  if(tapIdx>=0 && (Math.abs(e.clientX-tapX)>10 || Math.abs(e.clientY-tapY)>10)) tapCancel();
});
$('board').addEventListener('pointerup',e=>{
  const i=tapIdx; tapCancel();
  const swept=sweepOn && sweepSeen && sweepSeen.size>1;
  sweepStop();
  if(i<0 || swept || e.pointerType!=='touch') return;
  if(Math.abs(e.clientX-tapX)>10 || Math.abs(e.clientY-tapY)>10) return;
  tapCell(i);
});
for(const ev of ['pointercancel','pointerleave']) $('board').addEventListener(ev,()=>{ tapCancel(); sweepStop() });
$('boardPan').addEventListener('scroll',tapCancel);
$('zoomBtn').addEventListener('click',()=>setZoom(!boardZoom));

$('board').addEventListener('dblclick',e=>{
  const el=e.target.closest('.cell');
  if(el && lastPointerType!=='touch') openPicker(+el.dataset.i);
});
$('board').addEventListener('contextmenu',e=>{
  const el=e.target.closest('.cell'); if(!el) return;
  e.preventDefault();
  if(SPEC && SPEC.kind==='meow'){ sel=+el.dataset.i; meowSetCat(sel); return }
  if(lastPointerType!=='touch') openPicker(+el.dataset.i);
});
$('board').addEventListener('animationend',e=>{
  if(e.animationName==='pop') e.target.classList.remove('pop');
});

$('modeList').addEventListener('click',e=>{
  const b=e.target.closest('[data-mode]'); if(!b) return;
  pickMode(b.dataset.mode);
});
$('diffGrid').addEventListener('click',e=>{
  const b=e.target.closest('.diff-btn'); if(!b) return;
  closeSheet();
  newGame(pickedMode,b.dataset.diff);
});
$('sheetBg').addEventListener('click',closeSheet);
(function(){
  const mp=$('modePanel'), grab=$('sheetGrab');
  let y0=null;
  grab.addEventListener('pointerdown',e=>{
    y0=e.clientY; mp.style.transition='none';
    try{ grab.setPointerCapture(e.pointerId) }catch(err){}
  });
  grab.addEventListener('pointermove',e=>{
    if(y0==null) return;
    const dy=Math.max(0,e.clientY-y0);
    mp.style.transform=dy? `translateY(${dy}px)` : '';
  });
  const end=e=>{
    if(y0==null) return;
    const dy=e.clientY-y0; y0=null;
    mp.style.transition=''; mp.style.transform='';
    if(dy>60) closeSheet();
  };
  grab.addEventListener('pointerup',end);
  grab.addEventListener('pointercancel',()=>{ y0=null; mp.style.transition=''; mp.style.transform='' });
  grab.addEventListener('click',closeSheet);
})();
$('contPick').addEventListener('click',contPickStart);
$('contCancel').addEventListener('click',contPickStop);
$('contAll').addEventListener('click',()=>contMark(true));
$('contNone').addEventListener('click',()=>contMark(false));
$('contDel').addEventListener('click',contDelete);
$('contList').addEventListener('click',async e=>{
  const del=e.target.closest('.cont-x');
  if(del){
    e.stopPropagation();
    if(await askConfirm(t('delGame'))){
      SES.games.splice(+del.dataset.del,1);
      if(SES.cur>=SES.games.length) SES.cur=SES.games.length-1;
      persistCache(); renderHome();
    }
    return;
  }
  const card=e.target.closest('.cont-card');
  if(!card) return;
  if(contSel) contToggle(card.dataset.id);
  else openGame(+card.dataset.idx);
});
$('poolOpen').addEventListener('click',openPool);
$('poolAll').addEventListener('click',()=>document.querySelectorAll('#poolGrid input').forEach(i=>i.checked=true));
$('poolNone').addEventListener('click',()=>document.querySelectorAll('#poolGrid input').forEach(i=>i.checked=false));
$('poolClose').addEventListener('click',()=>{ if(savePool()) $('poolModal').classList.add('hidden') });

function goHome(){ numFlush(); clearWin(); closePicker(); stopTimer(); persistCache(); show('home'); renderHome() }
$('backBtn').addEventListener('click',goHome);
$('rulesBtn').addEventListener('click',openRules);
$('rulesClose').addEventListener('click',()=>$('rulesModal').classList.add('hidden'));
$('pauseBtn').addEventListener('click',()=>{ const g=cur(); if(g) setPaused(!g.paused) });
$('resumeBtn').addEventListener('click',()=>setPaused(false));
$('restartBtn').addEventListener('click',async()=>{
  const g=cur(); if(!g) return;
  if(!await askConfirm(t('restartConfirm'))) return;
  const n=g.solution.length;
  g.values=g.solution.map((v,i)=>g.given[i]? v : 0);
  g.notes=Array.from({length:n},()=>[]);
  g.hyp=new Array(n).fill(0); g.endErr=[]; g.wasFull=false;
  g.time=0; g.mistakes=0; g.hints=0; g.done=false; g.noLimit=false; g.usedAssist=false;
  undoStack=[]; redoStack=[]; sel=-1; hlDigit=0;
  setPaused(false); renderBoard(); startTimer(); persistCache();
});
$('undoBtn').addEventListener('click',undo);
$('redoBtn').addEventListener('click',redo);
$('eraseBtn').addEventListener('click',eraseCell);
$('hintBtn').addEventListener('click',hint);
$('autoNotesBtn').addEventListener('click',autoNotes);
$('notesBtn').addEventListener('click',()=>setMode('note'));
$('hypBtn').addEventListener('click',()=>setMode('hyp'));
$('winHome').addEventListener('click',goHome);
$('winAgain').addEventListener('click',()=>newGame(lastRequest.mode,lastRequest.diff));
$('loseNew').addEventListener('click',()=>{ $('loseModal').classList.add('hidden');
  SES.games.splice(SES.cur,1); SES.cur=-1; persistCache(); newGame(lastLost.mode,lastLost.diff) });
$('loseContinue').addEventListener('click',()=>{ $('loseModal').classList.add('hidden');
  const g=cur(); if(g){ g.noLimit=true; setPaused(false); renderBoard(); persistCache() } });

$('statsBtn').addEventListener('click',openStats);
$('statsClose').addEventListener('click',()=>$('statsModal').classList.add('hidden'));
$('setBtn').addEventListener('click',()=>openSettings());
$('setClose').addEventListener('click',()=>$('setModal').classList.add('hidden'));
$('resetStats').addEventListener('click',resetStats);
document.querySelectorAll('.stabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('optInstant').addEventListener('change',e=>{ SES.settings.instant=e.target.checked;
  $('optLimit').disabled=!SES.settings.instant; persistCache() });
$('optLimit').addEventListener('change',e=>{ SES.settings.limit=e.target.checked; persistCache();
  if(cur()&&!$('game').classList.contains('hidden')) renderBoard() });
$('optDbl').addEventListener('change',e=>{ SES.settings.dblPick=e.target.checked;
  if(!e.target.checked) closePicker(); persistCache() });
$('optSame').addEventListener('change',e=>{ SES.settings.highlightSame=e.target.checked; persistCache();
  if(cur()&&!$('game').classList.contains('hidden')) renderBoard() });
$('optPeers').addEventListener('change',e=>{ SES.settings.highlightPeers=e.target.checked; persistCache();
  if(cur()&&!$('game').classList.contains('hidden')) renderBoard() });
$('optDigitFirst').addEventListener('change',e=>{ SES.settings.digitFirst=e.target.checked;
  if(!e.target.checked){ armed=0; hlDigit=0 } persistCache();
  if(cur()&&!$('game').classList.contains('hidden')) renderBoard() });
$('optCounts').addEventListener('change',e=>{ SES.settings.showCounts=e.target.checked; persistCache();
  if(cur()&&!$('game').classList.contains('hidden')) renderBoard() });
$('optHintBtn').addEventListener('change',e=>{ SES.settings.showHint=e.target.checked; applyControls(); persistCache() });
$('optAutoBtn').addEventListener('change',e=>{ SES.settings.showAuto=e.target.checked; applyControls(); persistCache() });
document.querySelectorAll('#posseg button').forEach(b=>b.addEventListener('click',()=>{
  SES.settings.pos=b.dataset.p; applyLayout(); persistCache();
}));
document.querySelectorAll('#langseg button').forEach(b=>b.addEventListener('click',()=>{
  SES.settings.lang=b.dataset.l; applyLang(); refreshPickerLang(); persistCache();
  if(cur()&&!$('game').classList.contains('hidden')){ renderBoard(); updatePickHint() }
}));
for(const id of ['statsModal','setModal','poolModal','rulesModal']){
  $(id).addEventListener('click',e=>{ if(e.target.id===id){
    if(id==='poolModal'){ if(!savePool()) return }
    $(id).classList.add('hidden');
  }});
}
document.addEventListener('pointerdown',e=>{
  const pk=$('picker');
  if(!pk.classList.contains('hidden')&&!pk.contains(e.target)) closePicker();
  if($('game').classList.contains('hidden')||sel<0) return;
  if(e.target.closest('#board,#numpad,.controls,#picker,.topbar,header,.modal-bg')) return;
  numFlush(); sel=-1; hlDigit=0; armed=0; renderBoard();
});

const LETTER_DIGIT={KeyA:10,KeyB:11,KeyC:12};
document.addEventListener('keydown',e=>{
  const modalOpen=['loseModal','statsModal','setModal','poolModal','rulesModal']
    .some(id=>!$(id).classList.contains('hidden'));
  if(modalOpen){
    if(e.key==='Escape'){
      $('statsModal').classList.add('hidden'); $('setModal').classList.add('hidden');
      $('rulesModal').classList.add('hidden');
      if(!$('poolModal').classList.contains('hidden') && savePool()) $('poolModal').classList.add('hidden');
    }
    return;
  }
  if($('game').classList.contains('hidden')){
    if(e.key==='Escape'&&sheetOpen()) closeSheet();
    return;
  }
  const g=cur(); if(!g) return;
  const code=e.code;
  if(SPEC && SPEC.kind==='meow' && !e.ctrlKey && !e.metaKey){
    if(code==='Space'){ e.preventDefault(); if(sel>=0) meowTap(sel); return }
    if(code==='Enter'||code==='NumpadEnter'){ e.preventDefault(); if(sel>=0) meowSetCat(sel); return }
  }
  if((e.ctrlKey||e.metaKey)&&code==='KeyZ'){ e.preventDefault(); e.shiftKey? redo():undo(); return }
  if((e.ctrlKey||e.metaKey)&&code==='KeyY'){ e.preventDefault(); redo(); return }
  if(e.ctrlKey||e.metaKey) return;
  const dm=code.match(/^(Digit|Numpad)([0-9])$/);
  if(dm){
    const d=+dm[2];
    if(SPEC.kind==='num'){ e.preventDefault(); inputDigit(d); return }
    if(d>=1){ e.preventDefault(); inputDigit(d,e.shiftKey,e.altKey); return }
  }
  if(SPEC.maxD>9 && LETTER_DIGIT[code] && LETTER_DIGIT[code]<=SPEC.maxD){
    e.preventDefault(); inputDigit(LETTER_DIGIT[code],e.shiftKey,e.altKey); return;
  }
  if(e.altKey) return;
  switch(code){
    case 'Backspace': case 'Delete': case 'Digit0': case 'Numpad0': eraseCell(); break;
    case 'KeyN': setMode('note'); break;
    case 'Space': e.preventDefault(); setMode('note'); break;
    case 'KeyD': setMode('hyp'); break;
    case 'KeyZ': undo(); break;
    case 'KeyY': redo(); break;
    case 'KeyH': if(SES.settings.showHint) hint(); break;
    case 'KeyA': if(SES.settings.showAuto&&SPEC.maxD<=9) autoNotes(); break;
    case 'KeyR': openRules(); break;
    case 'KeyP': setPaused(!g.paused); break;
    case 'Escape':
      if(!$('picker').classList.contains('hidden')) closePicker();
      else goHome();
      break;
    case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
      e.preventDefault();
      if(g.paused) break;
      numFlush(); moveSel(code);
      break;
    }
  }
});

function moveSel(code){
  if(!SPEC) return;
  if(sel<0){ sel=0; renderBoard(); return }
  const step={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[code];
  let {x,y}=SPEC.cells[sel];
  for(let k=0;k<Math.max(SPEC.W,SPEC.H)+1;k++){
    x+=step[0]; y+=step[1];
    if(x<0||y<0||x>=SPEC.W||y>=SPEC.H) return;
    const j=cellAt(SPEC,x,y);
    if(j>=0){ sel=j; hlDigit=0; renderBoard(); return }
  }
}

window.addEventListener('beforeunload',()=>{ try{
  localStorage.setItem(LS_LOG,JSON.stringify(LOG));
  localStorage.setItem(LS_SES,JSON.stringify(SES));
  localStorage.setItem(LS_PEND,JSON.stringify(pending));
}catch(e){} });
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ persistCache(); if(pending.length) saveLog() }
});
window.addEventListener('resize',()=>{
  if(!isPhone()) closeSheet();
  snapBoardTwice(); updatePickHint();
});
if(window.visualViewport) window.visualViewport.addEventListener('resize',snapBoard);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(snapBoard);

loadCache();
pickedMode=SES.settings.mode||'classic';
buildSwatches();
applyTheme(); applyLayout(); applyLang();
renderHome(); show('home');
if(pending.length) saveLog();
(function(){
  const seen=localStorage.getItem('sudoku-welcomed');
  if(seen||localStorage.getItem(LS_SES)) return;
  const bg=$('welcomeModal');
  bg.classList.remove('hidden');
  const pick=id=>{ SES.settings.theme=id; applyTheme(); persistCache();
    try{ localStorage.setItem('sudoku-welcomed','1') }catch(e){}
    bg.classList.add('hidden') };
  $('welLight').onclick=()=>pick('light');
  $('welDark').onclick=()=>pick('dark');
  bg.addEventListener('click',e=>{ if(e.target===bg){
    try{ localStorage.setItem('sudoku-welcomed','1') }catch(err){}
    bg.classList.add('hidden') } });
})();

const DEV_HOST=location.hostname==='localhost'||location.hostname==='127.0.0.1';
if('serviceWorker' in navigator && location.protocol.startsWith('http') && !DEV_HOST){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}) });
  let swReloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(swReloaded) return;
    swReloaded=true;
    location.reload();
  });
} else if('serviceWorker' in navigator && DEV_HOST){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
  if(window.caches) caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))).catch(()=>{});
}
