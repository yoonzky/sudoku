'use strict';

let sel=-1, msel=new Set(), inputMode='digit', undoStack=[], redoStack=[], timerId=null,
    lastPlaced=-1, hlDigit=0, armed=0, lastNumTs=0, numPending=false, numTimer=null;
let lastRequest={mode:'classic',diff:'medium'};
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

let genWorker=null, genSeq=0, genWaiting=null;
function workerReady(){
  if(genWorker!==null) return genWorker;
  try{
    genWorker=new Worker('js/engine/worker.js');
    genWorker.onmessage=e=>{
      const d=e.data||{};
      if(!genWaiting||d.seq!==genWaiting.seq) return;
      const cb=genWaiting; genWaiting=null;
      if(d.error){ cb.fail(); return }
      cb.ok(d);
    };
    genWorker.onerror=()=>{ genWorker=false; if(genWaiting){ const cb=genWaiting; genWaiting=null; cb.fail() } };
  }catch(e){ genWorker=false }
  return genWorker;
}
function generateAsync(mode,diff,done){
  const w=workerReady();
  const sync=()=>{ setTimeout(()=>{
    const r=makePuzzle(mode,diff);
    done(r&&{mode:r.mode,diff:r.diff,ex:r.ex,sol:r.sol,puz:r.puz,grade:r.grade});
  },20) };
  if(!w) return sync();
  const seq=++genSeq;
  genWaiting={seq, ok:done, fail:sync};
  w.postMessage({mode,diff,seq});
}
/* samurai and killer take seconds to deal, so the wait needs a way out */
let genBusy=false;
function cancelGen(){
  if(!genBusy) return false;
  genBusy=false; genWaiting=null;
  if(genWorker&&genWorker.terminate){ try{ genWorker.terminate() }catch(e){} }
  genWorker=null;
  $('genOverlay').classList.add('hidden');
  /* the game the deal was meant to replace is already gone, so fall back to the menu */
  if(!cur()) goHome();
  return true;
}

function newGame(mode,diff){
  lastRequest={mode,diff};
  if(mode==='random'){
    const pool=poolList();
    mode=pool[Math.floor(Math.random()*pool.length)];
  }
  genBusy=true;
  $('genOverlay').innerHTML='';
  $('genOverlay').append(t('gen')+' · '+t('m_'+mode));
  const hint=document.createElement('small');
  hint.textContent=t('genCancel');
  $('genOverlay').appendChild(hint);
  $('genOverlay').classList.remove('hidden');
  generateAsync(mode,diff,res=>{
    if(!genBusy) return;
    genBusy=false;
    $('genOverlay').classList.add('hidden');
    if(!res){ toast(t('genFail')); return }
    const sp=buildSpec(res.mode,res.ex);
    const n=sp.cells.length;
    if(SES.games.length>=10){
      const drop=SES.games.shift();
      toast(t('gameDropped').replace('{m}',t('m_'+drop.mode)));
    }
    SES.games.push({
      id:uid(), mode:res.mode, diff, ex:res.ex,
      solution:res.sol, given:res.puz.map(v=>!!v),
      values:res.puz.slice(), hyp:new Array(n).fill(0),
      notes:Array.from({length:n},()=>[]), mid:Array.from({length:n},()=>[]),
      time:0, mistakes:0, hints:0, done:false, paused:false, noLimit:false,
      instant: sp.kind==='num'? false : SES.settings.instant,
      endErr:[], wasFull:false,
    });
    SES.cur=SES.games.length-1;
    persistCache();
    openGame();
  });
}
function openGame(idx){
  clearWin(); numArm(false);
  if(typeof idx==='number') SES.cur=idx;
  const g=cur(); if(!g) return;
  const sp=buildSpec(g.mode,g.ex);
  buildBoard(sp); buildNumpad(sp); buildPicker(sp);
  undoStack=[]; redoStack=[]; sel=-1; msel.clear(); hlDigit=0; armed=0; inputMode='digit';
  syncModeButtons(); applyControls();
  show('game'); setPaused(false); renderBoard(); startTimer();
  boardZoom = isPhone() && !isLand() && fitCell()>0 && fitCell()<26;
  snapBoardTwice(); centerBoardPan(); panHint(); updatePickHint();
  closePicker();
}

function snapshot(){ const g=cur();
  return {values:g.values.slice(), notes:g.notes.map(n=>n.slice()), mid:g.mid.map(n=>n.slice()),
          hyp:g.hyp.slice(), endErr:(g.endErr||[]).slice()} }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length>300) undoStack.shift(); redoStack.length=0 }
function restore(s){ const g=cur();
  g.values=s.values.slice(); g.notes=s.notes.map(n=>n.slice());
  g.mid=(s.mid||g.mid).map(n=>n.slice());
  g.hyp=s.hyp.slice(); g.endErr=s.endErr.slice() }

/* the faces come out of a bag: each one is seated once before any comes round
   again, and an emptied bag is shuffled anew */
function dealFace(g,i){
  if(!g.face) g.face={};
  if(g.face[i]!=null) return;
  if(!g.bag||!g.bag.length){
    g.bag=[0,1,2,3,4,5];
    for(let k=g.bag.length-1;k>0;k--){
      const j=Math.floor(Math.random()*(k+1));
      [g.bag[k],g.bag[j]]=[g.bag[j],g.bag[k]];
    }
  }
  g.face[i]=g.bag.pop();
  persistCache();
}

function meowSetCat(i){
  const g=cur(); if(!g||g.done||g.paused) return;
  dismissPickHint();
  pushUndo();
  const was=g.values[i];
  g.values[i] = was===MEOW_CAT? 0 : MEOW_CAT;
  if(g.values[i]===MEOW_CAT) dealFace(g,i);
  if(g.values[i]===MEOW_CAT && g.instant && g.solution[i]!==MEOW_CAT){
    g.mistakes++;
    if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
  }
  lastPlaced = g.values[i]===MEOW_CAT? i : -1;
  if(g.values[i]===MEOW_CAT && g.solution[i]===MEOW_CAT) sel=-1;
  afterMove();
}
/* numerator: drag from a filled cell and the run keeps counting up */
function numChain(j,v){
  const g=cur();
  if(!g||g.done||g.paused||g.given[j]||v>SPEC.maxD) return false;
  pushUndo();
  g.values[j]=v; g.notes[j]=[]; g.hyp[j]=0;
  lastPlaced=j; sel=j;
  afterMove(true);
  return true;
}

function meowMark(i){
  const g=cur(); if(!g||g.done||g.paused) return;
  dismissPickHint();
  pushUndo();
  g.values[i] = g.values[i]===MEOW_MARK? 0 : MEOW_MARK;
  lastPlaced=-1;
  afterMove();
}
function meowSweep(i){
  const g=cur(); if(!g||g.done||g.paused||g.values[i]!==0) return;
  dismissPickHint();
  pushUndo();
  g.values[i]=MEOW_MARK;
  lastPlaced=-1;
  afterMove();
}
/* the win takes the pad away and the page stops centring itself, which would
   slide the board out from under the player. It is pinned where it stood and
   the rest of the screen moves around it */
function pinBoard(change){
  const b=$('board');
  const before=b? b.getBoundingClientRect().top : 0;
  change();
  if(!b) return;
  const after=b.getBoundingClientRect().top;
  const now=parseFloat(document.body.style.getPropertyValue('--won-top'))||0;
  document.body.style.setProperty('--won-top',Math.max(0,Math.round(now+before-after))+'px');
}

function meowClash(g,sp,i){
  if(g.values[i]!==MEOW_CAT) return false;
  for(const j of sp.peers[i]) if(g.values[j]===MEOW_CAT) return true;
  return false;
}
function meowTap(i){
  const g=cur(); if(!g||g.done||g.paused) return;
  dismissPickHint();
  pushUndo();
  const was=g.values[i];
  g.values[i] = was===0? MEOW_MARK : was===MEOW_MARK? MEOW_CAT : 0;
  if(g.values[i]===MEOW_CAT && g.instant && g.solution[i]!==MEOW_CAT){
    g.mistakes++;
    if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
  }
  lastPlaced = g.values[i]===MEOW_CAT? i : -1;
  if(g.values[i]===MEOW_CAT && g.solution[i]===MEOW_CAT){ sel=-1 }
  afterMove();
}

function numpadPress(v){
  const g=cur(); if(!g||g.paused) return;
  if(SPEC.kind==='num'){ inputDigit(v); return }
  if(msel.size>1){ inputDigit(v); return }
  if(SES.settings.digitFirst){
    armed = armed===v? 0 : v;
    hlDigit=armed; sel=-1; renderBoard(); return;
  }
  if(sel<0||g.given[sel]||g.done){ hlDigit = hlDigit===v? 0 : v; renderBoard() }
  else inputDigit(v);
}

function numArm(on){
  clearTimeout(numTimer);
  numPending=on;
  if(on) numTimer=setTimeout(numFlush,2600);
}
function numFlush(){
  if(!numPending) return;
  clearTimeout(numTimer);
  numPending=false;
  if(cur()) checkWin();
}
function inputNumber(d){
  const g=cur(); if(!g||g.done||g.paused||sel<0||g.given[sel]) return;
  const chain=(Date.now()-lastNumTs)<2600 && lastPlaced===sel;
  if(inputMode==='note'){
    const nn=g.notes[sel];
    const prev=chain? nn[nn.length-1] : 0;
    const grow = chain && prev>0 && prev*10+d<=SPEC.maxD;
    if(!grow && d<=0) return;
    pushUndo();
    if(grow){ nn[nn.length-1]=prev*10+d }
    else {
      const k=nn.indexOf(d);
      if(k>=0) nn.splice(k,1); else nn.push(d);
    }
    lastPlaced=sel; lastNumTs=Date.now();
    dismissPickHint();
    afterMove(true);
    return;
  }
  const prev=g.values[sel]||0;
  let nv = (chain && prev>0 && prev*10+d<=SPEC.maxD)? prev*10+d : d;
  if(nv<1||nv>SPEC.maxD) return;
  pushUndo();
  g.values[sel]=nv; g.hyp[sel]=0; g.notes[sel]=[]; lastPlaced=sel; lastNumTs=Date.now();
  dismissPickHint();
  if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  const more=nv*10<=SPEC.maxD;
  numArm(more);
  if(!more && nv===g.solution[sel]){ sel=-1; hlDigit=0 }
  afterMove(true);
}
/* a digit typed over a run of picked cells always lands as a pencil mark */
function inputMulti(v,mode){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(v<1||v>SPEC.maxD) return;
  const bank = mode==='mid'? 'mid' : 'notes';
  const list=[...msel].filter(i=>!g.given[i]&&!g.values[i]&&!g.hyp[i]);
  if(!list.length) return;
  const drop=list.every(i=>g[bank][i].includes(v));
  pushUndo();
  for(const i of list){
    const arr=g[bank][i], k=arr.indexOf(v);
    if(drop){ if(k>=0) arr.splice(k,1) }
    else if(k<0){ arr.push(v); arr.sort((a,b)=>a-b) }
  }
  dismissPickHint();
  afterMove(true);
}
function inputDigit(v,forceNote,forceHyp,forceMid){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(SPEC.kind==='meow') return;
  if(SPEC.kind==='num') return inputNumber(v);
  const mode = forceNote? 'note' : forceHyp? 'hyp' : forceMid? 'mid' : inputMode;
  if(msel.size>1) return inputMulti(v, mode==='digit'? 'note' : mode);
  if(sel<0||g.given[sel]) return;
  if(v<1||v>SPEC.maxD) return;
  if((mode==='note'||mode==='mid') && (g.values[sel]||g.hyp[sel])) return;
  if(mode==='hyp' && g.values[sel]) return;
  pushUndo();
  if(mode==='note'||mode==='mid'){
    const nn = mode==='mid'? g.mid[sel] : g.notes[sel], k=nn.indexOf(v);
    if(k>=0) nn.splice(k,1); else { nn.push(v); nn.sort((a,b)=>a-b) }
  } else if(mode==='hyp'){
    g.hyp[sel]=g.hyp[sel]===v? 0 : v;
    lastPlaced=sel;
    if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  } else {
    if(g.values[sel]===v){ g.values[sel]=0 }
    else{
      g.values[sel]=v; g.notes[sel]=[]; g.mid[sel]=[]; g.hyp[sel]=0; lastPlaced=sel;
      if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
      if(v!==g.solution[sel]){
        if(g.instant){
          g.mistakes++;
          if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
        }
        else { sel=-1; hlDigit=0 }
      } else {
        for(const p of SPEC.peers[sel]){ const k=g.notes[p].indexOf(v); if(k>=0) g.notes[p].splice(k,1) }
        sel=-1; hlDigit=0;
      }
    }
  }
  afterMove();
}
function eraseCell(){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(msel.size>1){
    const list=[...msel].filter(i=>!g.given[i]);
    if(!list.some(i=>g.values[i]||g.hyp[i]||g.notes[i].length||g.mid[i].length)) return;
    pushUndo();
    for(const i of list){
      g.values[i]=0; g.hyp[i]=0; g.notes[i]=[]; g.mid[i]=[];
      if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
    }
    afterMove();
    return;
  }
  if(sel<0||g.given[sel]) return;
  if(!g.values[sel]&&!g.hyp[sel]&&!g.notes[sel].length&&!g.mid[sel].length) return;
  pushUndo();
  if(g.hyp[sel]&&!g.values[sel]) g.hyp[sel]=0;
  else { g.values[sel]=0; g.hyp[sel]=0; g.notes[sel]=[]; g.mid[sel]=[] }
  if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  afterMove();
}
function hint(){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(SPEC.kind==='meow'){
    const left=[];
    for(let k=0;k<g.solution.length;k++)
      if(g.solution[k]===MEOW_CAT && g.values[k]!==MEOW_CAT) left.push(k);
    if(!left.length) return;
    const spot=left[Math.floor(Math.random()*left.length)];
    pushUndo();
    g.values[spot]=MEOW_CAT; g.hints++; g.usedAssist=true; sel=-1; lastPlaced=spot;
    afterMove();
    return;
  }
  let i=sel;
  if(i<0||g.values[i]===g.solution[i]){
    const empt=[];
    for(let k=0;k<g.solution.length;k++) if(g.values[k]!==g.solution[k]) empt.push(k);
    if(!empt.length) return;
    i=empt[Math.floor(Math.random()*empt.length)];
  }
  pushUndo();
  g.values[i]=g.solution[i]; g.notes[i]=[]; g.mid[i]=[]; g.hyp[i]=0; g.hints++; g.usedAssist=true; sel=i; lastPlaced=i;
  scrollSelIntoView();
  if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
  for(const p of SPEC.peers[i]){ const k=g.notes[p].indexOf(g.solution[i]); if(k>=0) g.notes[p].splice(k,1) }
  afterMove();
}
function autoNotes(){
  const g=cur(); if(!g||g.done||g.paused||SPEC.kind==='num'||SPEC.kind==='meow') return;
  pushUndo();
  for(let i=0;i<SPEC.cells.length;i++) if(!g.values[i]&&!g.hyp[i]){
    const m=candMask(SPEC,g.values,i), nn=[];
    for(let v=1;v<=SPEC.maxD;v++) if(m&(1<<v)) nn.push(v);
    g.notes[i]=nn;
  }
  g.usedAssist=true;
  afterMove(); toast(t('autoDone'));
}
function undo(){ const g=cur(); if(!g||g.done||g.paused||!undoStack.length) return;
  redoStack.push(snapshot()); restore(undoStack.pop()); renderBoard(); persistCache() }
function redo(){ const g=cur(); if(!g||g.done||g.paused||!redoStack.length) return;
  undoStack.push(snapshot()); restore(redoStack.pop()); renderBoard(); persistCache() }

function afterMove(quiet){
  renderBoard();
  if(lastPlaced>=0 && !reducedMotion && !quiet) cells[lastPlaced].classList.add('pop');
  if(!quiet) lastPlaced=-1;
  checkWin(); persistCache();
}

let lastWin=null, winTimer=null;
function checkWin(){
  const g=cur(); if(!g) return;
  const n=g.solution.length;
  if(SPEC && SPEC.kind==='meow'){
    for(let i=0;i<n;i++)
      if((g.values[i]===MEOW_CAT)!==(g.solution[i]===MEOW_CAT)) return;
  } else {
    let full=true;
    for(let i=0;i<n;i++) if(!merged(g,i)){ full=false; break }
    if(!full){ g.wasFull=false; return }
    const wrong=[];
    for(let i=0;i<n;i++) if(merged(g,i)!==g.solution[i]) wrong.push(i);
    if(wrong.length){
      if(numPending) return;
      if(!g.instant){ g.endErr=wrong; renderBoard() }
      if(!g.wasFull) toast(t('hasErrors').replace('{n}',wrong.length));
      g.wasFull=true;
      return;
    }
  }
  g.done=true; stopTimer();
  if(boardZoom) setZoom(false);
  sel=-1; msel.clear(); hlDigit=0; armed=0; renderBoard();
  const st=statsFor(g.mode,g.diff);
  const assisted=!!g.usedAssist;
  const isRecord=!assisted && (st.best==null||g.time<st.best);
  const perfect=g.mistakes===0&&g.hints===0&&!assisted;
  if(!assisted) pending.push({id:g.id, d:new Date().toISOString().slice(0,10), mode:g.mode, diff:g.diff,
    time:g.time, mistakes:g.mistakes, hints:g.hints});
  SES.games.splice(SES.cur,1); SES.cur=-1;
  persistNow(); if(!assisted) saveLog();
  lastWin={mode:g.mode, diff:g.diff, time:g.time, best:st.best, mistakes:g.mistakes, hints:g.hints,
    isRecord, assisted, perfect, instant:g.instant};
  renderWinPanel();
  const showWin=()=>{
    document.body.classList.add('won');
    $('winPanel').classList.remove('hidden');
    placeWinPanel();
  };
  if(reducedMotion){ pinBoard(showWin); return }
  pinBoard(()=>document.body.classList.add('won'));
  for(let i=0;i<n;i++){
    const c=SPEC.cells[i];
    cells[i].style.animationDelay=((c.x+c.y)*22)+'ms';
    cells[i].classList.add('wave');
  }
  winTimer=setTimeout(()=>{ winTimer=null;
    cells.forEach(d=>{ d.classList.remove('wave'); d.style.animationDelay='' });
    showWin() },900);
}
function renderWinPanel(){
  const w=lastWin; if(!w) return;
  $('winTime').textContent=fmtTime(w.time);
  $('winRecord').classList.toggle('hidden',!w.isRecord);
  $('winSub').innerHTML=t('m_'+w.mode)+' · '+t('d_'+w.diff)+
    (w.assisted? ' · '+t('assistNote') : (w.perfect? ' · '+t('clean') : ''));
  const lbl=$('winBestLbl');
  lbl.dataset.i18n = w.isRecord? 'wasL' : 'recordL';
  lbl.textContent=t(lbl.dataset.i18n);
  $('winBest').textContent=fmtTime(w.best);
  $('winBestCell').classList.toggle('hidden', w.isRecord && w.best==null);
  $('winMist').textContent=w.mistakes;
  $('winHints').textContent=w.hints;
  $('winMistCell').classList.toggle('hidden', !w.instant);
}
let lastLost={mode:'classic',diff:'medium'};
function gameLost(){
  const g=cur();
  lastLost=g? {mode:g.mode,diff:g.diff} : lastRequest;
  persistCache(); setPaused(true);
  $('loseModal').classList.remove('hidden');
}
function placeWinPanel(){
  const panel=$('winPanel');
  if(!panel||!document.body.classList.contains('won')||!SPEC){
    document.body.classList.remove('win-side');
    return;
  }
  /* with the pad beside the board the panel goes into its column: same markup
     as the side win, the grid does the placing */
  if(isRail()){ document.body.classList.add('win-side'); panel.style.left=''; panel.style.top=''; return }
  const b=$('board').getBoundingClientRect(), game=$('game').getBoundingClientRect();
  const side=(window.innerWidth-b.right)>=330 && window.innerHeight>=600 && !isPhone();
  document.body.classList.toggle('win-side',side);
  panel.style.left = side? Math.round(b.right-game.left+28)+'px' : '';
  panel.style.top = side? Math.round(b.top-game.top+b.height/2)+'px' : '';
}
function clearWin(){
  clearTimeout(winTimer); winTimer=null;
  document.body.classList.remove('won');
  document.body.classList.remove('win-side');
  document.body.style.removeProperty('--won-top');
  $('winPanel').style.left=''; $('winPanel').style.top='';
  $('winPanel').classList.add('hidden');
}

function startTimer(){
  stopTimer();
  const g=cur(); if(!g) return;
  $('gTimer').textContent=fmtTime(g.time);
  timerId=setInterval(()=>{
    const gg=cur();
    if(!gg||gg.done||gg.paused||document.hidden) return;
    gg.time++;
    $('gTimer').textContent=fmtTime(gg.time);
    if(gg.time%20===0) persistCache();
  },1000);
}
function stopTimer(){ clearInterval(timerId); timerId=null }
function setPaused(p){
  const g=cur(); if(!g) return;
  g.paused=p; closePicker();
  $('pauseOverlay').classList.toggle('hidden',!p);
  const pl=t(p?'resume':'pauseT');
  $('pauseBtn').innerHTML=(p
    ? '<svg viewBox="0 0 24 24"><path d="M9 5.6 19 12 9 18.4Z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M9.5 5.5v13M14.5 5.5v13"/></svg>')
    + '<span class="tbtn-lbl"></span>';
  $('pauseBtn').querySelector('.tbtn-lbl').textContent=pl;
  $('pauseBtn').title=pl; $('pauseBtn').setAttribute('aria-label',pl);
}
function syncModeButtons(){
  $('notesBtn').classList.toggle('on', inputMode==='note');
  $('hypBtn').classList.toggle('on2', inputMode==='hyp');
  syncPickerMode();
}
function setMode(m){
  if(SPEC && SPEC.kind==='meow') return;
  if(SPEC && SPEC.kind==='num' && m!=='note') return;
  if(m==='mid' && SPEC && SPEC.kind==='num') return;
  inputMode = inputMode===m? 'digit' : m;
  syncModeButtons();
  if(cur() && !$('game').classList.contains('hidden')) renderBoard();
}
function applyControls(){
  const num=SPEC && SPEC.kind==='num', meow=SPEC && SPEC.kind==='meow';
  $('hintBtn').classList.toggle('hidden', !SES.settings.showHint);
  $('autoNotesBtn').classList.toggle('hidden', !SES.settings.showAuto || num || meow);
  $('hypBtn').classList.toggle('hidden', num || meow);
  $('notesBtn').classList.toggle('hidden', meow);
  /* a third tap clears the cell, so the erase key has nothing left to do */
  $('eraseBtn').classList.toggle('hidden', meow);
  /* a row with no visible button goes away, or it leaves a gap behind */
  for(const id of ['ctlModes','ctlActs']){
    const row=$(id); if(!row) continue;
    row.classList.toggle('hidden', !row.querySelector('.ctl:not(.hidden)'));
  }
}
