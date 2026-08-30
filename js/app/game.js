'use strict';

let sel=-1, msel=new Set(), inputMode='digit', undoStack=[], redoStack=[], timerId=null,
    lastPlaced=-1, hlDigit=0, armed=0, lastNumTs=0, numPending=false, numTimer=null;
let lastRequest={mode:'classic',diff:'medium'};
/* unfinished games kept at once */
const MAX_GAMES=8;
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
let genBusy=false;
function cancelGen(){
  if(!genBusy) return false;
  genBusy=false; genWaiting=null;
  if(genWorker&&genWorker.terminate){ try{ genWorker.terminate() }catch(e){} }
  genWorker=null;
  closeGenOverlay();
  if(!cur()) goHome();
  return true;
}

/* the bar fills against the budget the generator was given */
let genTick=null;
function openGenOverlay(mode,diff){
  const el=$('genOverlay');
  el.innerHTML='';
  const title=document.createElement('b');
  title.textContent=t('gen')+' · '+t('m_'+mode);
  const bar=document.createElement('div');
  bar.className='gen-bar';
  bar.innerHTML='<i></i>';
  const foot=document.createElement('small');
  foot.textContent=t(COARSE? 'genCancelTouch' : 'genCancel');
  el.append(title,bar,foot);
  el.classList.remove('hidden');
  const fill=bar.firstChild, started=Date.now(), budget=dealBudget(mode,diff);
  const draw=()=>{ fill.style.width=Math.min(97,(Date.now()-started)/budget*100)+'%' };
  draw();
  clearInterval(genTick);
  genTick=setInterval(draw,250);
}
function closeGenOverlay(){
  clearInterval(genTick); genTick=null;
  $('genOverlay').classList.add('hidden');
}
function finishGenOverlay(then){
  const fill=$('genOverlay').querySelector('.gen-bar i');
  clearInterval(genTick); genTick=null;
  if(!fill||reducedMotion){ closeGenOverlay(); then(); return }
  fill.style.transition='width .16s ease-out';
  fill.style.width='100%';
  setTimeout(()=>{ closeGenOverlay(); then() },190);
}

async function newGame(mode,diff){
  lastRequest={mode,diff};
  if(typeof syncUrl==='function') syncUrl(mode,diff);
  if(needCheckAsk()) await askCheck();
  if(mode==='random'){
    const pool=poolList();
    mode=pool[Math.floor(Math.random()*pool.length)];
  }
  genBusy=true;
  openGenOverlay(mode,diff);
  generateAsync(mode,diff,res=>{
    if(!genBusy) return;
    genBusy=false;
    finishGenOverlay(()=>{
      if(!res){ toast(t('genFail')); return }
      const sp=buildSpec(res.mode,res.ex);
      const n=sp.cells.length;
      /* a save from an older build may carry more than the limit */
      if(SES.games.length>=MAX_GAMES){
        const gone=SES.games.splice(0, SES.games.length-MAX_GAMES+1);
        const names=gone.map(x=>t('m_'+x.mode)).join(', ');
        toast(t(gone.length>1? 'gamesDropped' : 'gameDropped').replace('{m}',names));
      }
      SES.games.push({
        id:uid(), mode:res.mode, diff, ex:res.ex,
        solution:res.sol, given:res.puz.map(v=>!!v),
        values:res.puz.slice(),
        notes:Array.from({length:n},()=>[]), mid:Array.from({length:n},()=>[]),
        time:0, mistakes:0, hints:0, done:false, paused:false, noLimit:false,
        instant: sp.kind==='num'? false : SES.settings.instant,
        endErr:[], wasFull:false,
      });
      SES.cur=SES.games.length-1;
      persistCache();
      openGame();
    });
  });
}
function openGame(idx){
  clearWin(); numArm(false);
  if(typeof idx==='number') SES.cur=idx;
  const g=cur(); if(!g) return;
  if(typeof syncUrl==='function') syncUrl(g.mode,g.diff);
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
          endErr:(g.endErr||[]).slice()} }
function pushUndo(){ undoStack.push(snapshot()); if(undoStack.length>300) undoStack.shift(); redoStack.length=0 }
function restore(s){ const g=cur();
  g.values=s.values.slice(); g.notes=s.notes.map(n=>n.slice());
  g.mid=(s.mid||g.mid).map(n=>n.slice());
  g.endErr=s.endErr.slice() }

/* faces come from a bag: each seated once before any repeats */
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

function tokkiSeat(i){
  const g=cur(); if(!g||g.done||g.paused) return;
  dismissPickHint();
  pushUndo();
  const was=g.values[i];
  g.values[i] = was===TOKKI_BUN? 0 : TOKKI_BUN;
  if(g.values[i]===TOKKI_BUN) dealFace(g,i);
  if(g.values[i]===TOKKI_BUN && g.instant && g.solution[i]!==TOKKI_BUN){
    g.mistakes++;
    if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
  }
  lastPlaced = g.values[i]===TOKKI_BUN? i : -1;
  if(g.values[i]===TOKKI_BUN && g.solution[i]===TOKKI_BUN) sel=-1;
  afterMove();
}
/* drag from a filled cell and the run counts up */
function numChain(j,v){
  const g=cur();
  if(!g||g.done||g.paused||v>SPEC.maxD) return false;
  if(g.values[j]===v){ lastPlaced=j; sel=j; return true }
  if(g.given[j]||g.values[j]) return false;
  pushUndo();
  g.values[j]=v; g.notes[j]=[];
  lastPlaced=j; sel=j;
  afterMove(true);
  return true;
}

function tokkiMark(i){
  const g=cur(); if(!g||g.done||g.paused) return;
  dismissPickHint();
  pushUndo();
  g.values[i] = g.values[i]===TOKKI_MARK? 0 : TOKKI_MARK;
  lastPlaced=-1;
  afterMove();
}
function tokkiSweep(i){
  const g=cur(); if(!g||g.done||g.paused||g.values[i]!==0) return;
  dismissPickHint();
  pushUndo();
  g.values[i]=TOKKI_MARK;
  lastPlaced=-1;
  afterMove();
}
/* a win pins the board and moves the rest of the screen around it */
function pinBoard(change){
  const b=$('board');
  const before=b? b.getBoundingClientRect().top : 0;
  change();
  if(!b) return;
  const after=b.getBoundingClientRect().top;
  const now=parseFloat(document.body.style.getPropertyValue('--won-top'))||0;
  document.body.style.setProperty('--won-top',Math.max(0,Math.round(now+before-after))+'px');
}

function tokkiClash(g,sp,i){
  if(g.values[i]!==TOKKI_BUN) return false;
  for(const j of sp.peers[i]) if(g.values[j]===TOKKI_BUN) return true;
  return false;
}
/* a lone tap leaves the clover; the bunny takes a double tap */
const TOKKI_DBL_MS=450;
let tokkiTapCell=-1, tokkiTapAt=0;
function tokkiTap(i){
  const g=cur(); if(!g||g.done||g.paused) return;
  const now=Date.now();
  const quick = i===tokkiTapCell && now-tokkiTapAt<TOKKI_DBL_MS;
  tokkiTapCell=i; tokkiTapAt=now;
  dismissPickHint();
  pushUndo();
  const was=g.values[i];
  g.values[i] = was===TOKKI_BUN? 0
    : was===TOKKI_MARK? (quick? TOKKI_BUN : 0)
    : TOKKI_MARK;
  if(g.values[i]===TOKKI_BUN && g.instant && g.solution[i]!==TOKKI_BUN){
    g.mistakes++;
    if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
  }
  lastPlaced = g.values[i]===TOKKI_BUN? i : -1;
  if(g.values[i]===TOKKI_BUN && g.solution[i]===TOKKI_BUN){ sel=-1 }
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
  g.values[sel]=nv; g.notes[sel]=[]; lastPlaced=sel; lastNumTs=Date.now();
  dismissPickHint();
  if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  const more=nv*10<=SPEC.maxD;
  numArm(more);
  afterMove(true);
}
/* a run of picked cells gets what one cell would get */
function inputMulti(v,mode){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(v<1||v>SPEC.maxD) return;
  if(mode==='digit'){
    const list=[...msel].filter(i=>!g.given[i]);
    if(!list.length) return;
    const drop=list.every(i=>g.values[i]===v);
    pushUndo();
    let wrong=0;
    for(const i of list){
      if(drop){
        g.values[i]=0;
        if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
        continue;
      }
      if(g.values[i]===v) continue;
      g.values[i]=v; g.notes[i]=[]; g.mid[i]=[];
      if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
      if(v!==g.solution[i]) wrong++;
      else for(const p of SPEC.peers[i]){ const k=g.notes[p].indexOf(v); if(k>=0) g.notes[p].splice(k,1) }
    }
    /* one press is one move, however many cells it covered */
    if(wrong && g.instant){
      g.mistakes++;
      if(SES.settings.limit && !g.noLimit && g.mistakes>=3){ afterMove(); gameLost(); return }
    }
    dismissPickHint();
    afterMove(true);
    return;
  }
  const bank = mode==='mid'? 'mid' : 'notes';
  const list=[...msel].filter(i=>!g.given[i]&&!g.values[i]);
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
function inputDigit(v,forceNote,forceMid){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(SPEC.kind==='tokki') return;
  if(SPEC.kind==='num') return inputNumber(v);
  const mode = forceNote? 'note' : forceMid? 'mid' : activeMode();
  if(msel.size>1) return inputMulti(v, mode);
  if(sel<0||g.given[sel]) return;
  if(v<1||v>SPEC.maxD) return;
  if((mode==='note'||mode==='mid') && g.values[sel]) return;
  pushUndo();
  if(mode==='note'||mode==='mid'){
    const nn = mode==='mid'? g.mid[sel] : g.notes[sel], k=nn.indexOf(v);
    if(k>=0) nn.splice(k,1); else { nn.push(v); nn.sort((a,b)=>a-b) }
  } else {
    /* the end check has to forget a cleared cell */
    if(g.values[sel]===v){ g.values[sel]=0;
      if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) } }
    else{
      g.values[sel]=v; g.notes[sel]=[]; g.mid[sel]=[]; lastPlaced=sel;
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
  const g=cur(); if(!g||g.done||g.paused) return;
  if(msel.size>1){
    const list=[...msel].filter(i=>!g.given[i]);
    if(!list.some(i=>g.values[i]||g.notes[i].length||g.mid[i].length)) return;
    pushUndo();
    for(const i of list){
      g.values[i]=0; g.notes[i]=[]; g.mid[i]=[];
      if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
    }
    afterMove();
    return;
  }
  if(sel<0||g.given[sel]) return;
  if(!g.values[sel]&&!g.notes[sel].length&&!g.mid[sel].length) return;
  pushUndo();
  g.values[sel]=0; g.notes[sel]=[]; g.mid[sel]=[];
  if(g.endErr){ const k=g.endErr.indexOf(sel); if(k>=0) g.endErr.splice(k,1) }
  afterMove();
}
function hint(){
  const g=cur(); if(!g||g.done||g.paused) return;
  if(SPEC.kind==='tokki'){
    const left=[];
    for(let k=0;k<g.solution.length;k++)
      if(g.solution[k]===TOKKI_BUN && g.values[k]!==TOKKI_BUN) left.push(k);
    if(!left.length) return;
    const spot=left[Math.floor(Math.random()*left.length)];
    pushUndo();
    g.values[spot]=TOKKI_BUN; g.hints++; g.usedAssist=true; sel=-1; lastPlaced=spot;
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
  g.values[i]=g.solution[i]; g.notes[i]=[]; g.mid[i]=[]; g.hints++; g.usedAssist=true; sel=i; lastPlaced=i;
  scrollSelIntoView();
  if(g.endErr){ const k=g.endErr.indexOf(i); if(k>=0) g.endErr.splice(k,1) }
  for(const p of SPEC.peers[i]){ const k=g.notes[p].indexOf(g.solution[i]); if(k>=0) g.notes[p].splice(k,1) }
  afterMove();
}
function autoNotes(){
  const g=cur(); if(!g||g.done||g.paused||SPEC.kind==='num'||SPEC.kind==='tokki') return;
  pushUndo();
  for(let i=0;i<SPEC.cells.length;i++) if(!g.values[i]){
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
  if(SPEC && SPEC.kind==='tokki'){
    for(let i=0;i<n;i++)
      if((g.values[i]===TOKKI_BUN)!==(g.solution[i]===TOKKI_BUN)) return;
  } else {
    let full=true;
    for(let i=0;i<n;i++) if(!g.values[i]){ full=false; break }
    if(!full){ g.wasFull=false; return }
    const wrong=[];
    for(let i=0;i<n;i++) if(g.values[i]!==g.solution[i]) wrong.push(i);
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
    /* the panel moves the board as much as the class did, so it is pinned too */
    pinBoard(showWin) },900);
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
  /* beside the board the panel goes into the pad column */
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
  document.body.classList.toggle('paused',p);
  $('pauseOverlay').classList.toggle('hidden',!p);
  if(!$('game').classList.contains('hidden')) renderBoard();
  const pl=t(p?'resume':'pauseT');
  $('pauseBtn').innerHTML=(p? '<svg viewBox="0 0 24 24"><path d="M8.8 6.2 18.6 12 8.8 17.8Z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>' : '<svg viewBox="0 0 24 24"><rect x="7.4" y="5.4" width="3.6" height="13.2" rx="1.8" fill="currentColor" stroke="none"/><rect x="13" y="5.4" width="3.6" height="13.2" rx="1.8" fill="currentColor" stroke="none"/></svg>')
    + '<span class="tbtn-lbl"></span>';
  $('pauseBtn').querySelector('.tbtn-lbl').textContent=pl;
  $('pauseBtn').title=pl; $('pauseBtn').setAttribute('aria-label',pl);
}
/* digit, corner marks, centre marks */
const MODES_IN=['digit','note','mid'];
/* shift or command borrows a mode while held */
let heldMode='';
const activeMode=()=>heldMode||inputMode;
function setHeldMode(m){
  if(heldMode===m) return;
  heldMode = modeAllowed(m)? m : '';
  syncModeButtons();
  if(cur() && !$('game').classList.contains('hidden')) renderBoard();
}
function modeAllowed(m){
  if(!SPEC) return m==='digit';
  if(SPEC.kind==='tokki') return false;
  if(SPEC.kind==='num') return m==='digit'||m==='note';
  return MODES_IN.indexOf(m)>=0;
}
function syncModeButtons(){
  const m=activeMode();
  $('digitBtn').classList.toggle('on', m==='digit');
  $('notesBtn').classList.toggle('on2', m==='note');
  $('midBtn').classList.toggle('on3', m==='mid');
  document.body.classList.toggle('mode-note', m==='note');
  document.body.classList.toggle('mode-mid', m==='mid');
  syncPickerMode();
}
function setMode(m){
  if(!modeAllowed(m)) return;
  inputMode=m;
  syncModeButtons();
  if(cur() && !$('game').classList.contains('hidden')) renderBoard();
}
function cycleMode(){
  const list=MODES_IN.filter(modeAllowed);
  if(!list.length) return;
  const k=list.indexOf(inputMode);
  setMode(list[(k+1)%list.length]);
}
function applyControls(){
  const num=SPEC && SPEC.kind==='num', tokki=SPEC && SPEC.kind==='tokki';
  $('hintBtn').classList.toggle('hidden', !SES.settings.showHint);
  $('autoNotesBtn').classList.toggle('hidden', !SES.settings.showAuto || num || tokki);
  $('digitBtn').classList.toggle('hidden', tokki);
  $('midBtn').classList.toggle('hidden', num || tokki);
  $('notesBtn').classList.toggle('hidden', tokki);
  $('eraseBtn').classList.toggle('hidden', tokki);
  /* a row with no visible button goes away */
  for(const id of ['ctlModes','ctlActs']){
    const row=$(id); if(!row) continue;
    row.classList.toggle('hidden', !row.querySelector('.ctl:not(.hidden)'));
  }
}
