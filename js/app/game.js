/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
'use strict';

let G=null;
const U={sel:-1, msel:new Set(), input:'digit', held:'', tool:'clover', hl:0, undo:[], redo:[], last:-1, lastTs:0, numOpen:false,
  mode(){ return this.held||this.input }};
let lastDeal={mode:'classic', diff:'medium'};

/* worker; from a file, this thread */
let genWorker=null, genSeq=0, genWait=null, genBusy=false, genTick=null;
function worker(){
  if(genWorker!==null) return genWorker;
  try{
    genWorker=new Worker('js/engine/worker.js');
    genWorker.onmessage=e=>{
      const d=e.data||{};
      if(!genWait||d.seq!==genWait.seq) return;
      const w=genWait; genWait=null;
      d.error? w.fail() : w.ok(d);
    };
    genWorker.onerror=()=>{ genWorker=false; if(genWait){ const w=genWait; genWait=null; w.fail() } };
  }catch(e){ genWorker=false }
  return genWorker;
}
function generate(mode,diff,done){
  const w=worker();
  const sync=()=>setTimeout(()=>{ const r=makePuzzle(mode,diff); done(r&&{mode:r.mode,diff:r.diff,ex:r.ex,sol:r.sol,puz:r.puz}) },30);
  if(!w) return sync();
  const seq=++genSeq;
  genWait={seq, ok:done, fail:sync};
  w.postMessage({mode,diff,seq});
}
function cancelGen(){
  if(!genBusy) return false;
  genBusy=false; genWait=null;
  /* a late error from the stopped worker must not switch generation to this thread */
  if(genWorker&&genWorker.terminate){ genWorker.onmessage=genWorker.onerror=null; try{ genWorker.terminate() }catch(e){} }
  genWorker=null;
  clearInterval(genTick);
  $('gen').classList.add('hidden');
  goHome();
  toast(t('genStopped'));
  return true;
}

function newGame(mode,diff){
  lastDeal={mode,diff};
  if(mode==='random'){ const p=poolList(); mode=p[Math.floor(Math.random()*p.length)] }
  G=null; SP=null;
  document.body.classList.toggle('col',isCol());
  showScreen('game');
  $('board').innerHTML=''; $('pad').classList.add('hidden');
  $('gMode').textContent=t('m_'+mode); $('gDiff').textContent=t('d_'+diff);
  $('gTime').textContent='0:00'; $('gMist').innerHTML='';
  const gen=$('gen'), fill=gen.querySelector('i'), t0=Date.now(), budget=dealBudget(mode,diff);
  gen.classList.remove('hidden');
  const draw=()=>{ fill.style.width=Math.min(96,(Date.now()-t0)/budget*100)+'%' };
  draw(); clearInterval(genTick); genTick=setInterval(draw,200);
  genBusy=true;
  generate(mode,diff,res=>{
    if(!genBusy) return;
    genBusy=false; clearInterval(genTick);
    gen.classList.add('hidden');
    if(!res){ toast(t('genFail')); goHome(); return }
    const n=res.sol.length;
    const rec={id:uid(), mode:res.mode, diff, ex:res.ex, sol:res.sol, given:res.puz.map(v=>!!v), val:res.puz.slice(),
      notes:Array.from({length:n},()=>[]), mid:Array.from({length:n},()=>[]), endErr:[],
      time:0, mistakes:0, hints:0, assisted:false, noLimit:false, instant:res.mode==='numerator'? false : SES.settings.instant, at:Date.now()};
    if(SES.games.length>=MAX_GAMES){
      SES.games.sort((a,b)=>b.at-a.at);
      const gone=SES.games.splice(MAX_GAMES-1);
      toast(tf('dropped',{m:gone.map(x=>t('m_'+x.mode)).join(', ')}));
    }
    SES.games.push(rec);
    writeSes();
    openGame(rec);
  });
}

function openGame(rec){
  G=rec; G.at=Date.now(); G.paused=false;
  const sp=buildSpec(G.mode,G.ex);
  U.sel=-1; U.msel.clear(); U.hl=0; U.undo=[]; U.redo=[]; U.last=-1; U.held=''; U.input='digit'; U.tool='clover'; U.numOpen=false;
  showScreen('game');
  $('gen').classList.add('hidden');
  document.body.classList.remove('won');
  buildBoard(sp);
  $('gMode').textContent=t('m_'+G.mode); $('gDiff').textContent=t('d_'+G.diff);
  renderPad();
  layoutGame();
  setPaused(false);
  startTimer();
  firstHint();
  saveSoon();
}
function firstHint(){
  const key=SP.kind==='tokki'? 'tokkiHint' : SP.kind==='num'? 'numHint' : '';
  if(!key) return;
  try{ if(localStorage.getItem('yoondoku-'+key)) return; localStorage.setItem('yoondoku-'+key,'1') }catch(e){}
  setTimeout(()=>toast(t(key)),500);
}
function goHome(){
  stopTimer(); closePicker();
  if(G&&!G.done){ G.at=Date.now(); writeSes() }
  G=null;
  closeMenu();
  showScreen('home');
  renderHome();
}

function snap(){ return {val:G.val.slice(), notes:G.notes.map(x=>x.slice()), mid:G.mid.map(x=>x.slice()), endErr:G.endErr.slice()} }
function pushUndo(){ U.undo.push(snap()); if(U.undo.length>400) U.undo.shift(); U.redo.length=0 }
function restore(s){ G.val=s.val.slice(); G.notes=s.notes.map(x=>x.slice()); G.mid=s.mid.map(x=>x.slice()); G.endErr=s.endErr.slice() }
const live=()=>G&&!G.done&&!G.paused;
function dropErr(i){ const k=G.endErr.indexOf(i); if(k>=0) G.endErr.splice(k,1) }
function clearPeerNotes(i,v){ for(const p of SP.peers[i]){ const k=G.notes[p].indexOf(v); if(k>=0) G.notes[p].splice(k,1); const m=G.mid[p].indexOf(v); if(m>=0) G.mid[p].splice(m,1) } }
function mistake(){
  if(!G.instant) return false;
  G.mistakes++;
  if(SES.settings.limit && !G.noLimit && G.mistakes>=3){ afterMove(); lose(); return true }
  return false;
}

function inputDigit(v,force){
  if(!live()||SP.kind==='tokki') return;
  if(SP.kind==='num') return inputNumber(v);
  const mode=force||U.mode();
  if(v<1||v>SP.maxD) return;
  if(U.msel.size>1) return inputMulti(v,mode);
  const i=U.sel;
  if(i<0||G.given[i]){ U.hl = U.hl===v? 0 : v; if(U.hl&&SES.settings.tapPlace) onceHint('placeHint'); paint(); return }
  if(mode!=='digit'){
    if(G.val[i]) return;
    pushUndo();
    const arr=mode==='center'? G.mid[i] : G.notes[i], k=arr.indexOf(v);
    if(k>=0) arr.splice(k,1); else { arr.push(v); arr.sort((a,b)=>a-b) }
    return afterMove(true);
  }
  pushUndo();
  if(G.val[i]===v){ G.val[i]=0; dropErr(i); return afterMove(true) }
  G.val[i]=v; G.notes[i]=[]; G.mid[i]=[]; dropErr(i); U.last=i;
  if(v!==G.sol[i]){ if(mistake()) return }
  else clearPeerNotes(i,v);
  afterMove();
}
/* a run of cells takes one move */
function inputMulti(v,mode){
  const list=[...U.msel].filter(i=>!G.given[i]);
  if(mode==='digit'){
    if(!list.length) return;
    const drop=list.every(i=>G.val[i]===v);
    pushUndo();
    let wrong=0;
    for(const i of list){
      dropErr(i);
      if(drop){ G.val[i]=0; continue }
      if(G.val[i]===v) continue;
      G.val[i]=v; G.notes[i]=[]; G.mid[i]=[];
      if(v!==G.sol[i]) wrong++; else clearPeerNotes(i,v);
    }
    if(wrong&&mistake()) return;
    return afterMove(true);
  }
  const bank=mode==='center'? 'mid' : 'notes', open=list.filter(i=>!G.val[i]);
  if(!open.length) return;
  const drop=open.every(i=>G[bank][i].includes(v));
  pushUndo();
  for(const i of open){
    const arr=G[bank][i], k=arr.indexOf(v);
    if(drop){ if(k>=0) arr.splice(k,1) }
    else if(k<0){ arr.push(v); arr.sort((a,b)=>a-b) }
  }
  afterMove(true);
}
/* numerator: figures typed in a row build one number */
function inputNumber(d){
  const i=U.sel;
  if(i<0||G.given[i]) return;
  const chain=Date.now()-U.lastTs<2600 && U.last===i;
  if(U.mode()==='corner'){
    const nn=G.notes[i], prev=chain? nn[nn.length-1] : 0;
    const grow=chain && prev>0 && prev*10+d<=SP.maxD;
    if(!grow&&d<=0) return;
    pushUndo();
    if(grow) nn[nn.length-1]=prev*10+d;
    else { const k=nn.indexOf(d); if(k>=0) nn.splice(k,1); else nn.push(d) }
    U.last=i; U.lastTs=Date.now();
    return afterMove(true);
  }
  const prev=G.val[i]||0;
  const nv=(chain && prev>0 && prev*10+d<=SP.maxD)? prev*10+d : d;
  if(nv<1||nv>SP.maxD) return;
  pushUndo();
  G.val[i]=nv; G.notes[i]=[]; dropErr(i); U.last=i; U.lastTs=Date.now();
  U.numOpen = nv*10<=SP.maxD;
  afterMove(true);
}
/* drag from a filled cell and the run counts up */
function numChain(j,v){
  if(!live()||v>SP.maxD) return false;
  if(G.val[j]===v){ U.sel=j; return true }
  if(G.given[j]||G.val[j]) return false;
  pushUndo();
  G.val[j]=v; G.notes[j]=[]; U.sel=j; U.last=j;
  afterMove(true);
  return true;
}
function tokkiSet(i,kind){
  if(!live()) return;
  const want=kind==='bunny'? TOKKI_BUN : TOKKI_MARK;
  pushUndo();
  G.val[i] = G.val[i]===want? 0 : want;
  if(G.val[i]===TOKKI_BUN){ U.last=i; if(G.sol[i]!==TOKKI_BUN && mistake()) return }
  afterMove();
}
function tokkiSweep(i){
  if(!live()||G.val[i]) return;
  pushUndo();
  G.val[i]=TOKKI_MARK;
  afterMove(true);
}
function erase(){
  if(!live()) return;
  const list=(U.msel.size>1? [...U.msel] : U.sel>=0? [U.sel] : []).filter(i=>!G.given[i]);
  if(!list.some(i=>G.val[i]||G.notes[i].length||G.mid[i].length)) return;
  pushUndo();
  for(const i of list){ G.val[i]=0; G.notes[i]=[]; G.mid[i]=[]; dropErr(i) }
  afterMove(true);
}
function hint(){
  if(!live()) return;
  if(SP.kind==='tokki'){
    const left=[];
    for(let k=0;k<G.sol.length;k++) if(G.sol[k]===TOKKI_BUN && G.val[k]!==TOKKI_BUN) left.push(k);
    if(!left.length) return;
    const k=left[Math.floor(Math.random()*left.length)];
    pushUndo(); G.val[k]=TOKKI_BUN; G.hints++; G.assisted=true; U.last=k;
    return afterMove();
  }
  let i=U.sel;
  if(i<0||G.val[i]===G.sol[i]){
    const open=[];
    for(let k=0;k<G.sol.length;k++) if(G.val[k]!==G.sol[k]) open.push(k);
    if(!open.length) return;
    i=open[Math.floor(Math.random()*open.length)];
  }
  pushUndo();
  G.val[i]=G.sol[i]; G.notes[i]=[]; G.mid[i]=[]; dropErr(i); G.hints++; G.assisted=true;
  U.sel=i; U.msel.clear(); U.last=i;
  clearPeerNotes(i,G.sol[i]);
  afterMove();
}
const digitKind=()=>SP.kind!=='num'&&SP.kind!=='tokki';
function autoNotes(){
  if(!live()||!digitKind()) return;
  pushUndo();
  for(let i=0;i<SP.cells.length;i++) if(!G.val[i]){
    const m=candMask(SP,G.val,i), nn=[];
    for(let v=1;v<=SP.maxD;v++) if(m&(1<<v)) nn.push(v);
    G.notes[i]=nn;
  }
  G.assisted=true;
  afterMove(true);
  toast(t('autoDone'));
}
function undo(){ if(!live()||!U.undo.length) return; U.redo.push(snap()); restore(U.undo.pop()); paint(); saveSoon() }
function redo(){ if(!live()||!U.redo.length) return; U.undo.push(snap()); restore(U.redo.pop()); paint(); saveSoon() }

function afterMove(quiet){
  paint();
  if(U.last>=0 && !quiet && !REDUCED.matches){
    const d=CELLS[U.last];
    d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop');
    setTimeout(()=>d.classList.remove('pop'),260);
  }
  saveSoon();
  if(!U.numOpen) checkWin();
}

function checkWin(){
  const g=G; if(!g||g.done) return;
  const n=g.sol.length;
  if(SP.kind==='tokki'){
    for(let i=0;i<n;i++) if((g.val[i]===TOKKI_BUN)!==(g.sol[i]===TOKKI_BUN)) return;
  } else {
    for(let i=0;i<n;i++) if(!g.val[i]){ g.full=false; return }
    const wrong=[];
    for(let i=0;i<n;i++) if(g.val[i]!==g.sol[i]) wrong.push(i);
    if(wrong.length){
      if(!g.instant){ g.endErr=wrong; paint() }
      if(!g.full) toast(tf('hasErrors',{n:wrong.length}));
      g.full=true;
      return;
    }
  }
  win();
}
function win(){
  const g=G;
  g.done=true; stopTimer();
  U.sel=-1; U.msel.clear(); U.hl=0;
  const prev=statsFor(g.mode,g.diff).best;
  const rec=!g.assisted && (prev==null || g.time<prev);
  if(!g.assisted){ LOG.push({id:g.id, d:new Date().toISOString().slice(0,10), mode:g.mode, diff:g.diff, time:g.time, mistakes:g.mistakes, hints:g.hints}); saveLog() }
  SES.games=SES.games.filter(x=>x.id!==g.id);
  writeSes();
  paint();
  document.body.classList.add('won');
  const pad=$('pad');
  pad.className='pad';
  pad.innerHTML=`<div class="result"><span class="r-head">${t('solved')}</span><span class="r-cap">${t('m_'+g.mode)}, ${t('d_'+g.diff).toLowerCase()}</span>
    <span class="r-time num">${fmtTime(g.time)}</span>
    ${rec&&prev!=null? `<span class="r-rec">${t('newRecord')}</span>` : g.assisted? `<span class="r-cap">${t('assisted')}</span>` : ''}
    <div class="rows">
      ${prev!=null? `<div class="row"><span>${t(rec?'wasL':'recordL')}</span><b class="num">${fmtTime(prev)}</b></div>` : ''}
      ${g.instant? `<div class="row"><span>${t('mistakesL')}</span><b class="num">${g.mistakes}</b></div>` : ''}
      <div class="row"><span>${t('hintsL')}</span><b class="num">${g.hints}</b></div>
    </div>
    <div class="acts"><button class="btn" id="againBtn">${t('again')}</button><button class="btn plain" id="homeBtn">${t('allModes')}</button></div></div>`;
  $('againBtn').onclick=()=>newGame(lastDeal.mode===g.mode||lastDeal.mode==='random'? lastDeal.mode : g.mode, g.diff);
  $('homeBtn').onclick=goHome;
  if(document.body.classList.contains('col')) fitBoard();
  if(!REDUCED.matches) for(let i=0;i<SP.cells.length;i++){
    const c=SP.cells[i], d=CELLS[i];
    d.style.animation=`wave .5s ${(c.x+c.y)*28}ms cubic-bezier(.3,.7,.3,1) both`;
    setTimeout(()=>{ d.style.animation='' },560+(c.x+c.y)*28);
  }
}
function lose(){
  setPaused(true,true);
  ask({title:t('loseT'), text:t('loseD'), ok:t('noLimit'), alt:t('restart')}).then(r=>{
    if(!G) return;
    if(r==='ok'){ G.noLimit=true; setPaused(false); paint(); saveSoon() }
    else if(r==='alt') restartGame(true);
    else setPaused(true);
  });
}
async function restartGame(sure){
  if(!G) return;
  if(!sure && !(await ask({text:t('restartQ'), ok:t('restart'), danger:true}))) return;
  const n=G.sol.length;
  G.val=G.sol.map((v,i)=>G.given[i]? v : 0);
  G.notes=Array.from({length:n},()=>[]); G.mid=Array.from({length:n},()=>[]); G.endErr=[];
  G.time=0; G.mistakes=0; G.hints=0; G.assisted=false; G.noLimit=false; G.full=false; G.face={}; G.bag=[];
  U.undo=[]; U.redo=[]; U.sel=-1; U.msel.clear(); U.hl=0;
  setPaused(false); startTimer(); paint(); saveSoon();
}

let timerId=null;
function startTimer(){
  stopTimer();
  $('gTime').textContent=fmtTime(G.time);
  timerId=setInterval(()=>{
    if(!G||G.done||G.paused||document.hidden) return;
    G.time++;
    $('gTime').textContent=fmtTime(G.time);
    if(G.time%15===0) saveSoon();
  },1000);
}
function stopTimer(){ clearInterval(timerId); timerId=null }
function setPaused(p,quiet){
  if(!G) return;
  G.paused=p;
  $('cover').classList.toggle('hidden',!p||quiet===true);
  document.body.classList.toggle('paused',p);
  $('pauseBtn').innerHTML=ic(p?'play':'pause');
  $('pauseBtn').setAttribute('aria-label',t(p?'resume':'pause'));
}

/* pad: digit, corner and centre marks, keys, tools */
const MODES_IN=['digit','corner','center'];
function modesFor(){
  if(SP.kind==='tokki') return ['clover','bunny'];
  if(SP.kind==='num') return ['digit','corner'];
  return MODES_IN;
}
function setInput(m){
  if(SP.kind==='tokki'){ U.tool=m; return paintPad() }
  if(!modesFor().includes(m)) return;
  U.input=m; paint();
}
function cycleInput(){ const l=modesFor(); const cur=SP.kind==='tokki'? U.tool : U.input; setInput(l[(l.indexOf(cur)+1)%l.length]) }
function keyList(col){
  if(SP.kind==='tokki') return [];
  if(SP.kind==='num') return col? [1,2,3,4,5,6,7,8,9,0] : [1,2,3,4,5,6,7,8,9,-1,0,-1];
  const k=[];
  for(let v=1;v<=SP.maxD;v++) k.push(v);
  if(!col && SP.maxD===10) k.splice(9,0,-1),k.push(-1);
  return k;
}
function renderPad(){
  if(!SP) return;
  const col=document.body.classList.contains('col');
  const pad=$('pad');
  pad.className='pad'; pad.classList.remove('hidden');
  const glyph=m=> m==='clover'? CLOVER.replace('class="clover"','fill="currentColor"') : m==='bunny'? FACES[0].replace('class="face f0"','fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"') : GLYPH[m];
  const label=m=> SP.kind==='num'&&m==='corner'? t('corner') : t(m);
  let h=`<div class="modes" id="modes">${modesFor().map(m=>`<button data-m="${m}"><span class="gl">${glyph(m)}</span>${label(m)}</button>`).join('')}</div>`;
  const keys=keyList(col);
  if(keys.length){
    const kc=col? (keys.length<=9? keys.length : Math.ceil(keys.length/2)) : 3;
    h+=`<div class="keys${col&&keys.length>9?' two':''}" id="keys" style="--kc:${kc};--kr:${Math.ceil(keys.length/kc)}">`+
      keys.map(v=>v<0? '<span class="key blank"></span>' : `<button type="button" class="key${v>9?' d2':''}" data-v="${v}">${v}<small aria-hidden="true"></small></button>`).join('')+'</div>';
  }
  const tools=[['undo','undo'],['redo','redo']];
  if(SP.kind!=='tokki') tools.push(['erase','erase']);
  if(SES.settings.autoBtn && digitKind() && SP.maxD<=9) tools.push(['auto','wand']);
  if(SES.settings.hintBtn) tools.push(['hint','bulb']);
  h+=`<div class="tools" id="tools">${tools.map(([k,i])=>`<button class="tool" data-t="${k}">${ic(i)}${t(k)}</button>`).join('')}</div>`;
  pad.innerHTML=h;
  /* on a phone the digits come first, right under the board */
  if(col&&$('keys')) pad.insertBefore($('keys'),pad.firstChild);
  paintPad();
}
function paintPad(){
  if(!G||!SP||G.done) return;
  const m=SP.kind==='tokki'? U.tool : U.mode();
  document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  const keys=$('keys');
  if(keys){
    keys.classList.toggle('mode-note',m==='corner'); keys.classList.toggle('mode-mid',m==='center');
    const show=SES.settings.counts && digitKind();
    const left={};
    if(digitKind()){ for(const v of G.sol) left[v]=(left[v]||0)+1; for(const v of G.val) if(v) left[v]--; }
    keys.querySelectorAll('.key[data-v]').forEach(k=>{
      const v=+k.dataset.v, l=left[v];
      k.querySelector('small').textContent= show&&l>0? l : '';
      k.classList.toggle('done', digitKind() && l<=0);
      k.classList.toggle('hl', v>0 && U.hl===v);
    });
  }
  const tb=q=>document.querySelector(`#tools [data-t="${q}"]`);
  if(tb('undo')) tb('undo').disabled=!U.undo.length;
  if(tb('redo')) tb('redo').disabled=!U.redo.length;
  const mi=$('gMist'), lim=SES.settings.limit&&G.instant&&!G.noLimit;
  if(!G.instant){ mi.className='mist hidden' }
  else { mi.className='mist num'+(G.mistakes?' on':''); mi.innerHTML=`${t('mistakes')} <b>${G.mistakes}</b>${lim?'/3':''}` }
  mi.setAttribute('aria-label',lim? tf('mistakesN',{n:G.mistakes}) : t('mistakes')+' '+G.mistakes);
}

/* rail beside the board on a wide screen, a tray under it on a phone or upright tablet */
function isCol(){ return innerWidth<720 || (innerHeight>innerWidth && innerWidth<1100) }
function layoutGame(){
  const col=isCol(), was=document.body.classList.contains('col');
  document.body.classList.toggle('col',col);
  /* on a phone the timer goes under the title */
  const tm=$('gTime');
  if(col&&tm.parentNode.className!=='sub') document.querySelector('.gbar .sub').appendChild(tm);
  if(!col&&tm.parentNode.className==='sub') document.querySelector('.gbar .div').after(tm);
  if(G&&!G.done&&col!==was) renderPad();
  fitBoard();
}
