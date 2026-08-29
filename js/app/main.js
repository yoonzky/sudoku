'use strict';

/* how far a finger may travel before a tap turns into a drag */
const TAP_SLOP=14;
let tapX=0, tapY=0, tapIdx=-1;
let sweepOn=false, sweepSeen=null, sweepFrom=-1;
let chainOn=false, chainPrev=-1, chainLast=0;
let runOn=false, runFrom=-1, runAdd=false;
/* a quick finger reports one move per two or three cells, so the gap between
   two points is walked over and every cell along the way is visited */
const dragAt={x:0,y:0}; let dragStep=12;
function dragCells(e,fn){
  const raw=e.getCoalescedEvents? e.getCoalescedEvents() : null;
  const evs=(raw&&raw.length)? raw : [e];
  let px=dragAt.x, py=dragAt.y;
  for(const ev of evs){
    const dx=ev.clientX-px, dy=ev.clientY-py;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/dragStep));
    for(let k=1;k<=steps;k++){
      const el=document.elementFromPoint(px+dx*k/steps, py+dy*k/steps);
      const cell=el&&el.closest&&el.closest('.cell');
      if(cell) fn(+cell.dataset.i);
    }
    px=ev.clientX; py=ev.clientY;
  }
  dragAt.x=px; dragAt.y=py;
}
function dragStart(i,e){
  dragAt.x=e.clientX; dragAt.y=e.clientY;
  const w=cells[i]? cells[i].getBoundingClientRect().width : 0;
  dragStep=Math.max(6, w*0.4 || 12);
}
/* on a mac the command key stands where control stands elsewhere, since
   control-click is the right button there */
const MOD_MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const pickMod=e=> MOD_MAC? e.metaKey : e.ctrlKey;
const modeOfEvent=e=> e.shiftKey? 'note' : pickMod(e)? 'mid' : '';
/* either modifier adds to the run instead of starting a new one */
const addMod=e=> e.shiftKey || pickMod(e);
function chainStop(){ chainOn=false; chainPrev=-1; chainLast=0 }
function tapCancel(){ tapIdx=-1 }
function sweepStop(){ sweepOn=false; sweepSeen=null; sweepFrom=-1 }


function tapCell(i){
  const g=cur(); if(!g||g.paused) return;
  closePicker();
  try{ $('board').focus({preventScroll:true}) }catch(e){}
  if(msel.size){ msel.clear() }
  if(SPEC.kind==='tokki'){
    sel=i;
    if(lastPointerType==='touch') tokkiTap(i); else tokkiMark(i);
    return;
  }
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
  if(SPEC.kind==='tokki'){
    if(e.button===2) return;
    /* a zoomed board scrolls under the finger, so dragging must not leave marks */
    if(!$('boardPan').classList.contains('pan')){
      sweepOn=true; sweepSeen=new Set(); sweepFrom=i;
    }
    tapIdx=i; tapX=e.clientX; tapY=e.clientY;
    dragStart(i,e);
    if(e.pointerType!=='touch') tapCell(i);
    return;
  }
  if(SPEC.kind==='num' && e.pointerType!=='touch' && e.button!==2 && g.values[i]){
    chainOn=true; chainPrev=i; chainLast=g.values[i];
    tapX=e.clientX; tapY=e.clientY;
    dragStart(i,e);
  }
  /* the right button belongs to the pad at the cell: it must not clear a run
     that the player has just picked */
  if(e.button===2) return;
  /* a drag with the mouse picks a run of cells, so a digit lands in all of them.
     With a modifier held the drag adds to what is already picked, and a single
     click on a cell toggles it, so cells that do not touch can be taken */
  if(e.pointerType!=='touch' && e.button===0 && SPEC.kind!=='num'){
    runOn=true; runFrom=i; runAdd=addMod(e); tapX=e.clientX; tapY=e.clientY; dragStart(i,e);
    if(runAdd){
      e.preventDefault();
      closePicker();
      if(msel.has(i)) msel.delete(i); else msel.add(i);
      sel=i; hlDigit=0;
      renderBoard();
      if(msel.size>1) showMultiHint();
      return;
    }
  }
  if(e.pointerType!=='touch'){ tapCell(i); return }
  tapIdx=i; tapX=e.clientX; tapY=e.clientY;
});
$('board').addEventListener('pointermove',e=>{
  if(sweepOn){
    if(Math.abs(e.clientX-tapX)<TAP_SLOP && Math.abs(e.clientY-tapY)<TAP_SLOP) return;
    if(sweepFrom>=0 && !sweepSeen.size){
      sweepSeen.add(sweepFrom);
      tokkiSweep(sweepFrom);
    }
    dragCells(e,j=>{
      if(sweepSeen.has(j)) return;
      sweepSeen.add(j);
      tapIdx=-1;
      tokkiSweep(j);
    });
    return;
  }
  if(chainOn){
    dragCells(e,j=>{
      if(j===chainPrev || !SPEC.nbr[chainPrev] || SPEC.nbr[chainPrev].indexOf(j)<0) return;
      if(numChain(j,chainLast+1)){ chainLast++; chainPrev=j }
    });
    return;
  }
  if(runOn){
    if(Math.abs(e.clientX-tapX)<TAP_SLOP && Math.abs(e.clientY-tapY)<TAP_SLOP) return;
    if(!msel.size && runFrom>=0) msel.add(runFrom);
    let grew=false;
    dragCells(e,j=>{ if(!msel.has(j)){ msel.add(j); grew=true } });
    if(grew){ renderBoard(); showMultiHint() }
    return;
  }
  if(tapIdx>=0 && (Math.abs(e.clientX-tapX)>TAP_SLOP || Math.abs(e.clientY-tapY)>TAP_SLOP)) tapCancel();
});
$('board').addEventListener('pointerup',e=>{
  if(runOn){
    const added=runAdd; runOn=false; runAdd=false;
    if(!added && msel.size<=1){ msel.clear(); renderBoard() }
  }
  const i=tapIdx; tapCancel();
  const swept=sweepOn && sweepSeen && sweepSeen.size>0;
  sweepStop(); chainStop();
  if(swept){ sel=-1; renderBoard() }
  if(i<0 || swept || e.pointerType!=='touch') return;
  if(Math.abs(e.clientX-tapX)>TAP_SLOP || Math.abs(e.clientY-tapY)>TAP_SLOP) return;
  tapCell(i);
});
for(const ev of ['pointercancel','pointerleave']) $('board').addEventListener(ev,()=>{
  tapCancel(); sweepStop(); chainStop();
  if(runOn){ const added=runAdd; runOn=false; runAdd=false;
    if(!added && msel.size<=1){ msel.clear(); renderBoard() } }
});
/* a press with the mouse leaves the focus ring on the button, and the next key
   lights it up as if it had been picked. The buttons act on click, so they need
   no focus from a press */
for(const sel of ['.controls','.numpad','.topbar','header']){
  const el=document.querySelector(sel);
  if(el) el.addEventListener('pointerdown',e=>{ if(e.target.closest('button')) e.preventDefault() });
}
function showMultiHint(){
  try{
    if(localStorage.getItem('sudoku-multiHint')) return;
    localStorage.setItem('sudoku-multiHint','1');
  }catch(e){}
  toast(t('multiHint'));
}
$('boardPan').addEventListener('scroll',()=>{ tapCancel(); sweepStop(); chainStop() });
$('zoomBtn').addEventListener('click',()=>setZoom(!boardZoom));

$('board').addEventListener('dblclick',e=>{
  const el=e.target.closest('.cell');
  if(el && lastPointerType!=='touch') openPicker(+el.dataset.i);
});
$('board').addEventListener('contextmenu',e=>{
  const el=e.target.closest('.cell'); if(!el) return;
  e.preventDefault();
  if(SPEC && SPEC.kind==='tokki'){ sel=+el.dataset.i; tokkiSeat(sel); return }
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
      persistNow(); renderHome();
    }
    return;
  }
  const card=e.target.closest('.cont-card');
  if(!card) return;
  if(contSel){ contToggle(card.dataset.id); return }
  const open=e.target.closest('.cont-open');
  if(open) openGame(+open.dataset.idx);
});
$('poolOpen').addEventListener('click',openPool);
$('poolAll').addEventListener('click',()=>document.querySelectorAll('#poolGrid input').forEach(i=>i.checked=true));
$('poolNone').addEventListener('click',()=>document.querySelectorAll('#poolGrid input').forEach(i=>i.checked=false));
$('poolClose').addEventListener('click',()=>{ if(savePool()) $('poolModal').classList.add('hidden') });

/* the address keeps the mode, and with a level it opens straight into a game:
   a bookmark used to land on the menu whatever it was made from */
function syncUrl(mode,diff){
  if(!history.replaceState) return;
  const q = mode? '?m='+mode+(diff? '&d='+diff : '') : location.pathname;
  try{ history.replaceState(null,'',q) }catch(e){}
}
function goHome(){ numFlush(); clearWin(); closePicker(); stopTimer(); persistCache();
  show('home'); renderHome(); syncUrl(pickedMode) }
$('backBtn').addEventListener('click',goHome);
$('rulesBtn').addEventListener('click',openRules);
$('rulesClose').addEventListener('click',()=>$('rulesModal').classList.add('hidden'));
$('pauseBtn').addEventListener('click',()=>{ const g=cur(); if(g) setPaused(!g.paused) });
/* the plate over the board is the way back into the game: a button on it would
   only repeat the one in the strip above */
$('pauseOverlay').addEventListener('click',()=>setPaused(false));
async function restartGame(){
  const g=cur(); if(!g) return;
  if(!await askConfirm(t('restartConfirm'))) return;
  const n=g.solution.length;
  g.values=g.solution.map((v,i)=>g.given[i]? v : 0);
  g.notes=Array.from({length:n},()=>[]);
  g.mid=Array.from({length:n},()=>[]);
  g.endErr=[]; g.wasFull=false;
  g.time=0; g.mistakes=0; g.hints=0; g.done=false; g.noLimit=false; g.usedAssist=false;
  undoStack=[]; redoStack=[]; sel=-1; msel.clear(); hlDigit=0;
  setPaused(false); renderBoard(); startTimer(); persistCache();
}
$('restartBtnTop').addEventListener('click',restartGame);
$('undoBtn').addEventListener('click',undo);
$('redoBtn').addEventListener('click',redo);
$('eraseBtn').addEventListener('click',eraseCell);
$('hintBtn').addEventListener('click',hint);
$('autoNotesBtn').addEventListener('click',autoNotes);
$('digitBtn').addEventListener('click',()=>setMode('digit'));
$('notesBtn').addEventListener('click',()=>setMode('note'));
$('midBtn').addEventListener('click',()=>setMode('mid'));
$('winHome').addEventListener('click',goHome);
$('winAgain').addEventListener('click',()=>newGame(lastRequest.mode,lastRequest.diff));
$('loseNew').addEventListener('click',()=>{ $('loseModal').classList.add('hidden');
  SES.games.splice(SES.cur,1); SES.cur=-1; persistNow(); newGame(lastLost.mode,lastLost.diff) });
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
  numFlush(); sel=-1; msel.clear(); hlDigit=0; armed=0; renderBoard();
});

const LETTER_DIGIT={KeyA:10,KeyB:11,KeyC:12};
$('genOverlay').addEventListener('click',()=>{ if(cancelGen()) toast(t('genStopped')) });
const KBD_SEEN='sudoku-kbd';
function markKeyboard(){
  if(document.body.classList.contains('has-kbd')) return;
  document.body.classList.add('has-kbd');
  try{ localStorage.setItem(KBD_SEEN,'1') }catch(e){}
}
try{ if(localStorage.getItem(KBD_SEEN)) document.body.classList.add('has-kbd') }catch(e){}
window.addEventListener('keydown',e=>{ if(/^(Key[A-Z]|Digit[0-9]|Arrow)/.test(e.code)) markKeyboard() });

/* the borrowed mode lights up while the key is down and goes out when it is not */
const trackMod=e=>{
  if($('game').classList.contains('hidden')) return setHeldMode('');
  setHeldMode(modeOfEvent(e));
};
window.addEventListener('keydown',trackMod);
window.addEventListener('keyup',trackMod);
window.addEventListener('blur',()=>setHeldMode(''));

document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && cancelGen()){ toast(t('genStopped')); return }
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
  /* playing by keyboard: the ring stays with the board, not with whatever
     button was pressed last */
  const act=document.activeElement;
  if(code!=='Tab' && act && act.tagName==='BUTTON' && act.closest('#game')){
    act.blur();
    try{ $('board').focus({preventScroll:true}) }catch(err){}
  }
  if((e.ctrlKey||e.metaKey)&&code==='KeyZ'){ e.preventDefault(); e.shiftKey? redo():undo(); return }
  if((e.ctrlKey||e.metaKey)&&code==='KeyY'){ e.preventDefault(); redo(); return }
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey){
    const cm=code.match(/^(Digit|Numpad)([1-9])$/);
    if(cm && SPEC.kind!=='num' && SPEC.kind!=='tokki'){
      e.preventDefault(); inputDigit(+cm[2],false,true); return;
    }
  }
  if(e.ctrlKey||e.metaKey) return;
  const dm=code.match(/^(Digit|Numpad)([0-9])$/);
  if(dm){
    const d=+dm[2];
    if(SPEC.kind==='num'){ e.preventDefault(); inputDigit(d); return }
    if(d>=1){ e.preventDefault(); inputDigit(d,e.shiftKey); return }
  }
  if(SPEC.maxD>9 && LETTER_DIGIT[code] && LETTER_DIGIT[code]<=SPEC.maxD){
    e.preventDefault(); inputDigit(LETTER_DIGIT[code],e.shiftKey); return;
  }
  if(e.altKey) return;
  switch(code){
    case 'Backspace': case 'Delete': case 'Digit0': case 'Numpad0': eraseCell(); break;
    case 'KeyZ': setMode('digit'); break;
    case 'KeyX': setMode('note'); break;
    case 'KeyC': setMode('mid'); break;
    case 'Space': e.preventDefault(); cycleMode(); break;
    case 'KeyH': if(SES.settings.showHint) hint(); break;
    case 'KeyA': if(SES.settings.showAuto&&SPEC.maxD<=9) autoNotes(); break;
    case 'KeyR': openRules(); break;
    case 'KeyP': setPaused(!g.paused); break;
    case 'Escape':
      if(!$('picker').classList.contains('hidden')) closePicker();
      else if(msel.size){ msel.clear(); renderBoard() }
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
  if(msel.size) msel.clear();
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

window.addEventListener('beforeunload',persistNow);
window.addEventListener('pagehide',persistNow);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ persistNow(); if(pending.length) saveLog() }
});
window.addEventListener('resize',()=>{
  if(!sheetWidth()) closeSheet();
  syncRail();
  snapBoardTwice(); updatePickHint(); placeWinPanel();
});
syncRail();
/* resize does not always fire (window snapping, a monitor swap), so the layout
   listens to the media query itself */
if(RAIL_Q.addEventListener) RAIL_Q.addEventListener('change',()=>{
  syncRail(); snapBoardTwice(); placeWinPanel();
});
initDialogs();
/* resizing the board mid-drag would move the cells out from under the finger */
if(window.visualViewport) window.visualViewport.addEventListener('resize',()=>{
  if(sweepOn||chainOn) return;
  snapBoard();
});
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(snapBoard);

loadCache();
pickedMode=SES.settings.mode||'tokki';
buildSwatches();
applyTheme(); applyLayout(); applyLang();
renderHome(); show('home');
if(pending.length) saveLog();
/* a link with a mode picks it, and one with a level deals the game at once.
   The guest who arrives by such a link is the one who also gets the welcome
   window, so the address waits for it instead of being thrown away */
function openFromUrl(){
  const q=new URLSearchParams(location.search);
  const m=q.get('m'), d=q.get('d');
  if(!m || (!MODE_IDS.includes(m) && m!=='random')) return;
  pickMode(m); closeSheet();
  if(!d || !DIFFS.includes(d)) return;
  /* reloading the page must not deal a new board: the game the address points
     at is still in the list, and dealing over it would push out the oldest one */
  const open=SES.cur>=0? SES.games[SES.cur] : null;
  if(open && !open.done && open.diff===d && (m==='random' || open.mode===m)) return openGame(SES.cur);
  const idx=SES.games.findIndex(g=>!g.done && g.diff===d && (m==='random' || g.mode===m));
  if(idx>=0) return openGame(idx);
  newGame(m,d);
}
(function(){
  const seen=localStorage.getItem('sudoku-welcomed');
  if(seen||localStorage.getItem(LS_SES)) return openFromUrl();
  const bg=$('welcomeModal');
  bg.classList.remove('hidden');
  const done=()=>{
    try{ localStorage.setItem('sudoku-welcomed','1') }catch(e){}
    bg.classList.add('hidden');
    openFromUrl();
  };
  const pick=id=>{ SES.settings.theme=id; applyTheme(); persistCache(); done() };
  $('welLight').onclick=()=>pick('light');
  $('welDark').onclick=()=>pick('dark');
  bg.addEventListener('click',e=>{ if(e.target===bg) done() });
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
