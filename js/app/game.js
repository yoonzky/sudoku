'use strict';

let sel=-1, inputMode='digit', undoStack=[], redoStack=[], timerId=null,
    lastPlaced=-1, hlDigit=0, armed=0, lastNumTs=0;
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

function newGame(mode,diff){
  lastRequest={mode,diff};
  if(mode==='random'){
    const pool=poolList();
    mode=pool[Math.floor(Math.random()*pool.length)];
  }
  clearWin();
  $('genOverlay').classList.remove('hidden');
  $('genOverlay').textContent=t('gen')+' · '+t('m_'+mode);
  generateAsync(mode,diff,res=>{
    $('genOverlay').classList.add('hidden');
    if(!res){ toast(t('genFail')); return }
    const sp=buildSpec(res.mode,res.ex);
    const n=sp.cells.length;
    if(SES.games.length>=10) SES.games.shift();
    SES.games.push({
      id:uid(), mode:res.mode, diff, ex:res.ex,
      solution:res.sol, given:res.puz.map(v=>!!v),
      values:res.puz.slice(), hyp:new Array(n).fill(0),
      notes:Array.from({length:n},()=>[]),
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
  clearWin();
  if(typeof idx==='number') SES.cur=idx;
  const g=cur(); if(!g) return;
  const sp=buildSpec(g.mode,g.ex);
  buildBoard(sp); buildNumpad(sp); buildPicker(sp);
  undoStack=[]; redoStack=[]; sel=-1; hlDigit=0; armed=0; inputMode='digit';
  syncModeButtons(); applyControls();
  show('game'); setPaused(false); renderBoard(); startTimer(); snapBoard(); updatePickHint();
  closePicker();
}

function snapshot(){ const g=cur();
  return {values:g.values.slice(), notes:g.notes.map(n=>n.slice()), hyp:g.hyp.slice(), endErr:(g.endErr||[]).slice()} }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length>300) undoStack.shift(); redoStack.length=0 }
function restore(s){ const g=cur();
  g.values=s.values.slice(); g.notes=s.notes.map(n=>n.slice()); g.hyp=s.hyp.slice(); g.endErr=s.endErr.slice() }

function numpadPress(v){
  const g=cur(); if(!g||g.paused) return;
  if(SPEC.kind==='num'){ inputDigit(v); return }
  if(SES.settings.digitFirst){
    armed = armed===v? 0 : v;
    hlDigit=armed; sel=-1; renderBoard(); return;
  }
  if(sel<0||g.given[sel]||g.done){ hlDigit = hlDigit===v? 0 : v; renderBoard() }
  else inputDigit(v);
}

function inputNumber(d){
  const g=cur(); if(!g||g.done||g.paused||sel<0||g.given[sel]) return;
  const prev=g.values[sel]||0;
  const chain=(Date.now()-lastNumTs)<2500 && lastPlaced===sel;
  let nv = (chain && prev>0 && prev*10+d<=SPEC.maxD)? prev*10+d : d;
  if(nv<1||nv>SPEC.maxD) return;
  pushUndo();
  g.values[sel]=nv; g.hyp[sel]=0; lastPlaced=sel; lastNumTs=Date.now();
  dismissPickHint();
  if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  afterMove(true);
}
function inputDigit(v,forceNote,forceHyp){
  const g=cur(); if(!g||g.done||g.paused||sel<0||g.given[sel]) return;
  if(SPEC.kind==='num') return inputNumber(v);
  const mode = forceNote? 'note' : forceHyp? 'hyp' : inputMode;
  if(v<1||v>SPEC.maxD) return;
  pushUndo();
  if(mode==='note'){
    if(g.values[sel]||g.hyp[sel]){ undoStack.pop(); return }
    const nn=g.notes[sel], k=nn.indexOf(v);
    if(k>=0) nn.splice(k,1); else { nn.push(v); nn.sort((a,b)=>a-b) }
  } else if(mode==='hyp'){
    if(g.values[sel]){ undoStack.pop(); return }
    g.hyp[sel]=g.hyp[sel]===v? 0 : v;
    lastPlaced=sel;
    if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  } else {
    if(g.values[sel]===v){ g.values[sel]=0 }
    else{
      g.values[sel]=v; g.notes[sel]=[]; g.hyp[sel]=0; lastPlaced=sel;
      if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
      if(v!==g.solution[sel]){
        if(g.instant){
          g.mistakes++;
          if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
        }
      } else {
        for(const p of SPEC.peers[sel]){ const k=g.notes[p].indexOf(v); if(k>=0) g.notes[p].splice(k,1) }
      }
    }
  }
  afterMove();
}
function eraseCell(){
  const g=cur(); if(!g||g.done||g.paused||sel<0||g.given[sel]) return;
  if(!g.values[sel]&&!g.hyp[sel]&&!g.notes[sel].length) return;
  pushUndo();
  if(g.hyp[sel]&&!g.values[sel]) g.hyp[sel]=0;
  else { g.values[sel]=0; g.hyp[sel]=0; g.notes[sel]=[] }
  if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  afterMove();
}
function hint(){
  const g=cur(); if(!g||g.done||g.paused) return;
  let i=sel;
  if(i<0||g.values[i]===g.solution[i]){
    const empt=[];
    for(let k=0;k<g.solution.length;k++) if(g.values[k]!==g.solution[k]) empt.push(k);
    if(!empt.length) return;
    i=empt[Math.floor(Math.random()*empt.length)];
  }
  pushUndo();
  g.values[i]=g.solution[i]; g.notes[i]=[]; g.hyp[i]=0; g.hints++; g.usedAssist=true; sel=i; lastPlaced=i;
  if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
  for(const p of SPEC.peers[i]){ const k=g.notes[p].indexOf(g.solution[i]); if(k>=0) g.notes[p].splice(k,1) }
  afterMove();
}
function autoNotes(){
  const g=cur(); if(!g||g.done||g.paused||SPEC.kind==='num') return;
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
  if(lastPlaced>=0 && !reducedMotion && !quiet){
    cells[lastPlaced].classList.add('pop');
    flashUnits(lastPlaced);
  }
  if(!quiet) lastPlaced=-1;
  checkWin(); persistCache();
}

function flashUnits(i){
  const g=cur(); if(!g) return;
  const done=new Set();
  for(const gi of SPEC.gOf[i]){
    const unit=SPEC.groups[gi];
    if(unit.every(j=>merged(g,j)===g.solution[j])) unit.forEach(j=>done.add(j));
  }
  if(done.size){
    done.forEach(j=>cells[j].classList.add('uflash'));
    setTimeout(()=>done.forEach(j=>cells[j] && cells[j].classList.remove('uflash')),600);
  }
}

let lastWin=null;
function checkWin(){
  const g=cur(); if(!g) return;
  const n=g.solution.length;
  let full=true;
  for(let i=0;i<n;i++) if(!merged(g,i)){ full=false; break }
  if(!full){ g.wasFull=false; return }
  const wrong=[];
  for(let i=0;i<n;i++) if(merged(g,i)!==g.solution[i]) wrong.push(i);
  if(wrong.length){
    if(!g.instant){ g.endErr=wrong; renderBoard() }
    if(!g.wasFull) toast(t('hasErrors').replace('{n}',wrong.length));
    g.wasFull=true;
    return;
  }
  g.done=true; stopTimer();
  const st=statsFor(g.mode,g.diff);
  const assisted=!!g.usedAssist;
  const isRecord=!assisted && (st.best==null||g.time<st.best);
  const perfect=g.mistakes===0&&g.hints===0&&!assisted;
  if(!assisted) pending.push({id:g.id, d:new Date().toISOString().slice(0,10), mode:g.mode, diff:g.diff,
    time:g.time, mistakes:g.mistakes, hints:g.hints});
  SES.games.splice(SES.cur,1); SES.cur=-1;
  persistCache(); if(!assisted) saveLog();
  lastWin={mode:g.mode, diff:g.diff, time:g.time, best:st.best, mistakes:g.mistakes, hints:g.hints,
    isRecord, assisted, perfect};
  renderWinPanel();
  const showWin=()=>{
    const top=document.querySelector('header').getBoundingClientRect().top;
    document.body.style.setProperty('--won-top',Math.max(0,Math.round(top))+'px');
    document.body.classList.add('won');
    $('winPanel').classList.remove('hidden');
  };
  placeWinGlow(); $('winGlow').classList.add('on');
  if(reducedMotion){ showWin(); return }
  for(let i=0;i<n;i++){
    const c=SPEC.cells[i];
    cells[i].style.animationDelay=((c.x+c.y)*26)+'ms';
    cells[i].classList.add('wave');
  }
  setTimeout(()=>{ cells.forEach(d=>{ d.classList.remove('wave'); d.style.animationDelay='' }); showWin() },1050);
}
function renderWinPanel(){
  const w=lastWin; if(!w) return;
  $('winTime').textContent=fmtTime(w.time);
  $('winRecord').classList.toggle('hidden',!w.isRecord);
  $('winSub').innerHTML=t('m_'+w.mode)+' · '+t('d_'+w.diff)+
    (w.assisted? ' · '+t('assistNote') : (w.perfect? ' · '+t('clean') : ''));
  $('winBest').textContent=fmtTime(w.best);
  $('winMist').textContent=w.mistakes;
  $('winHints').textContent=w.hints;
}
let lastLost={mode:'classic',diff:'medium'};
function gameLost(){
  const g=cur();
  lastLost=g? {mode:g.mode,diff:g.diff} : lastRequest;
  persistCache(); setPaused(true);
  $('loseModal').classList.remove('hidden');
}
function placeWinGlow(){
  const el=$('winGlow'), b=$('board').getBoundingClientRect();
  if(!el||!b.width) return;
  el.style.setProperty('--wgx',Math.round(b.left+b.width/2)+'px');
  el.style.setProperty('--wgy',Math.round(b.top-b.height*0.30)+'px');
}
function clearWin(){
  document.body.classList.remove('won');
  document.body.style.removeProperty('--won-top');
  $('winPanel').classList.add('hidden');
  $('winGlow').classList.remove('on');
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
  $('pauseBtn').innerHTML=p
    ? '<svg viewBox="0 0 24 24"><path d="M9 5.6 19 12 9 18.4Z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M9.5 5.5v13M14.5 5.5v13"/></svg>';
  const pl=t(p?'resume':'pauseT');
  $('pauseBtn').title=pl; $('pauseBtn').setAttribute('aria-label',pl);
}
function syncModeButtons(){
  $('notesBtn').classList.toggle('on', inputMode==='note');
  $('hypBtn').classList.toggle('on2', inputMode==='hyp');
  syncPickerMode();
}
function setMode(m){
  if(SPEC && SPEC.kind==='num') return;
  inputMode = inputMode===m? 'digit' : m;
  syncModeButtons();
  if(cur() && !$('game').classList.contains('hidden')) renderBoard();
}
function applyControls(){
  const num=SPEC && SPEC.kind==='num';
  $('hintBtn').classList.toggle('hidden', !SES.settings.showHint);
  $('autoNotesBtn').classList.toggle('hidden', !SES.settings.showAuto || num);
  $('notesBtn').classList.toggle('hidden', num);
  $('hypBtn').classList.toggle('hidden', num);
}
