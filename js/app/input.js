'use strict';

/* how far a finger may travel before a tap turns into a drag */
const SLOP=10;
const P={on:false, id:-1, x:0, y:0, from:-1, moved:false, kind:'', add:false, type:'mouse', chainV:0, seen:null, lastTap:-1, lastTapAt:0};
const pickMod=e=> MAC? e.metaKey : e.ctrlKey;

function cellFromPoint(x,y){
  const r=$('board').getBoundingClientRect();
  const cx=Math.floor((x-r.left)/CS), cy=Math.floor((y-r.top)/CS);
  if(cx<0||cy<0||cx>=SP.W||cy>=SP.H) return -1;
  return cellAt(SP,cx,cy);
}
/* every cell between two pointer samples */
function walk(x0,y0,x1,y1,fn){
  const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/(CS*.35)));
  for(let k=1;k<=n;k++){ const j=cellFromPoint(x0+(x1-x0)*k/n, y0+(y1-y0)*k/n); if(j>=0) fn(j) }
}

function selectCell(i){
  U.msel.clear();
  if(i!==U.sel) U.numOpen=false;
  U.sel=i; U.hl=0;
  paint();
}

function boardDown(e){
  if(!G||G.done||G.paused||!SP) return;
  const i=cellFromPoint(e.clientX,e.clientY);
  if(i<0) return;
  e.preventDefault();
  try{ $('board').focus({preventScroll:true}) }catch(err){}
  P.on=true; P.id=e.pointerId; P.x=e.clientX; P.y=e.clientY; P.from=i; P.moved=false; P.type=e.pointerType||'mouse';
  try{ $('board').setPointerCapture(e.pointerId) }catch(err){}
  if(SP.kind==='tokki'){
    if(e.button===2){ P.on=false; U.sel=i; tokkiSet(i,'bunny'); return }
    P.kind='sweep'; P.seen=new Set();
    return;
  }
  if(e.button===2){ P.on=false; if(P.type!=='touch') openPicker(i); return }
  if(SP.kind==='num' && G.val[i]){ P.kind='chain'; P.chainV=G.val[i]; P.prev=i; selectCell(i); return }
  if(pickMod(e)||e.shiftKey){
    P.kind='run'; P.add=true;
    if(U.msel.size<=1 && U.sel>=0) U.msel.add(U.sel);
    if(U.msel.has(i)) U.msel.delete(i); else U.msel.add(i);
    U.sel=i; paint();
    return;
  }
  P.kind= P.type==='touch'&&$('bwrap').classList.contains('zoom')? 'tap' : 'run'; P.add=false;
  if(P.type!=='touch') selectCell(i);
}
function boardMove(e){
  if(!P.on||e.pointerId!==P.id) return;
  if(!P.moved && Math.hypot(e.clientX-P.x,e.clientY-P.y)<SLOP) return;
  const x0=P.moved? P.lx : P.x, y0=P.moved? P.ly : P.y;
  P.moved=true; P.lx=e.clientX; P.ly=e.clientY;
  if(P.kind==='sweep'){
    if(!P.seen.size){ P.seen.add(P.from); tokkiSweep(P.from) }
    walk(x0,y0,e.clientX,e.clientY,j=>{ if(!P.seen.has(j)){ P.seen.add(j); tokkiSweep(j) } });
    return;
  }
  if(P.kind==='chain'){
    walk(x0,y0,e.clientX,e.clientY,j=>{
      if(j===P.prev || !SP.nbr[P.prev].includes(j)) return;
      if(numChain(j,P.chainV+1)){ P.chainV++; P.prev=j }
    });
    return;
  }
  if(P.kind==='run'){
    if(!P.add && U.msel.size<=1){ U.msel.clear(); U.msel.add(P.from) }
    let grew=false;
    walk(x0,y0,e.clientX,e.clientY,j=>{ if(!U.msel.has(j)){ U.msel.add(j); grew=true } });
    if(grew){ U.sel=[...U.msel].pop(); paint(); onceHint('multiHint') }
  }
}
function boardUp(e){
  if(!P.on||e.pointerId!==P.id) return;
  P.on=false;
  const i=P.from;
  if(P.kind==='sweep'){
    if(!P.moved){
      /* double tap seats a bunny */
      const now=Date.now(), dbl=P.lastTap===i && now-P.lastTapAt<400;
      P.lastTap=i; P.lastTapAt=now;
      U.sel=i;
      if(dbl){ U.undo.length&&restore(U.undo.pop()); tokkiSet(i,'bunny') }
      else tokkiSet(i,U.tool);
    }
    return;
  }
  if(P.kind==='tap'&&!P.moved){ selectCell(i); return }
  if(P.kind==='run' && !P.moved && !P.add){
    if(P.type==='touch') selectCell(i);
    if(U.msel.size) { U.msel.clear(); paint() }
  }
}
function onceHint(k){
  try{ if(localStorage.getItem('yoondoku-'+k)) return; localStorage.setItem('yoondoku-'+k,'1') }catch(e){}
  toast(t(k));
}

function moveSel(code){
  U.msel.clear();
  if(U.sel<0){ U.sel=SP.cells.findIndex((c,i)=>!G.given[i]); if(U.sel<0) U.sel=0; return paint() }
  const st={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[code];
  let {x,y}=SP.cells[U.sel];
  for(let k=0;k<Math.max(SP.W,SP.H);k++){
    x+=st[0]; y+=st[1];
    if(x<0||y<0||x>=SP.W||y>=SP.H) return;
    const j=cellAt(SP,x,y);
    if(j>=0){ U.sel=j; U.hl=0; U.numOpen=false; revealCell(j); return paint() }
  }
}

const LETTER={KeyA:10,KeyB:11,KeyC:12};
function gameKey(e){
  if(e.key==='Escape'&&genBusy){ cancelGen(); return }
  if(!G||$('game').classList.contains('hidden')) return;
  if(document.querySelector('.sheet,.alert')) return;
  const code=e.code, mod=e.metaKey||e.ctrlKey;
  if(e.key==='Escape'){
    if(closePicker()||closeMenu()) return;
    if(U.msel.size){ U.msel.clear(); paint(); return }
    if(U.sel>=0&&!G.done){ U.sel=-1; paint(); return }
    goHome(); return;
  }
  if(G.done) return;
  if(mod&&code==='KeyZ'){ e.preventDefault(); e.shiftKey? redo() : undo(); return }
  if(mod&&code==='KeyY'){ e.preventDefault(); redo(); return }
  const dm=code.match(/^(Digit|Numpad)([0-9])$/);
  if(dm){
    const d=+dm[2];
    if(SP.kind==='num'){ e.preventDefault(); inputDigit(d); return }
    if(d===0){ e.preventDefault(); erase(); return }
    e.preventDefault();
    inputDigit(d, e.shiftKey? 'corner' : pickMod(e)? 'center' : '');
    return;
  }
  if(mod) return;
  if(SP.maxD>9 && SP.maxD<=12 && LETTER[code] && LETTER[code]<=SP.maxD){ e.preventDefault(); inputDigit(LETTER[code], e.shiftKey? 'corner' : ''); return }
  switch(code){
    case 'Backspace': case 'Delete': e.preventDefault(); erase(); break;
    case 'KeyZ': setInput(SP.kind==='tokki'? 'clover' : 'digit'); break;
    case 'KeyX': setInput(SP.kind==='tokki'? 'bunny' : 'corner'); break;
    case 'KeyC': if(SP.maxD<=9) setInput('center'); break;
    case 'Space': e.preventDefault(); cycleInput(); break;
    case 'KeyH': if(SES.settings.hintBtn) hint(); break;
    case 'KeyA': if(SES.settings.autoBtn&&SP.maxD<=9) autoNotes(); break;
    case 'KeyR': openRules(G.mode); break;
    case 'KeyP': setPaused(!G.paused); break;
    case 'Enter': if(SP.kind==='tokki'&&U.sel>=0) tokkiSet(U.sel,U.tool); break;
    case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
      e.preventDefault(); if(!G.paused) moveSel(code); break;
  }
}
/* shift and the command key borrow a mode while held */
function heldKey(e){
  if(!G||!SP||SP.kind==='tokki') return;
  const m= e.shiftKey? 'corner' : pickMod(e)&&SP.kind!=='num'? 'center' : '';
  if(m===U.held) return;
  U.held=m; paint();
}

function bindInput(){
  const b=$('board');
  b.addEventListener('pointerdown',boardDown);
  b.addEventListener('pointermove',boardMove);
  b.addEventListener('pointerup',boardUp);
  b.addEventListener('pointercancel',()=>{ P.on=false });
  b.addEventListener('contextmenu',e=>e.preventDefault());
  b.addEventListener('dblclick',e=>{ if(P.type==='touch'||!SP||SP.kind==='tokki') return; const i=cellFromPoint(e.clientX,e.clientY); if(i>=0) openPicker(i) });
  /* keyboard focus picks a cell */
  b.addEventListener('focus',()=>{ try{ if(G&&U.sel<0&&b.matches(':focus-visible')) moveSel('ArrowRight') }catch(e){} });
  document.addEventListener('keydown',gameKey);
  addEventListener('keydown',heldKey);
  addEventListener('keyup',heldKey);
  addEventListener('blur',()=>{ if(U.held){ U.held=''; if(G) paint() } });
  /* a tap outside drops the selection */
  document.addEventListener('pointerdown',e=>{
    if(!G||G.done||$('game').classList.contains('hidden')) return;
    if(e.target.closest('#board,#pad,.gbar,.menu,.sheet,.alert,.scrim,.picker')) return;
    if(U.sel>=0||U.msel.size){ U.sel=-1; U.msel.clear(); U.hl=0; paint() }
  });
  const pad=$('pad');
  /* keys act on press */
  pad.addEventListener('pointerdown',e=>{
    const k=e.target.closest('.key[data-v]');
    if(k){ e.preventDefault(); inputDigit(+k.dataset.v); return }
    if(e.target.closest('button')) e.preventDefault();
  });
  pad.addEventListener('click',e=>{
    const m=e.target.closest('#modes button');
    if(m){ setInput(m.dataset.m); return }
    const tl=e.target.closest('.tool');
    if(!tl) return;
    ({undo,redo,erase,auto:autoNotes,hint})[tl.dataset.t]();
  });
  $('cover').addEventListener('click',()=>setPaused(false));
  $('bwrap').addEventListener('scroll',()=>{ if(P.kind==='tap') P.moved=true; syncMini() },{passive:true});
  $('zoomBtn').addEventListener('click',()=>{ zoomOn=!zoomOn; fitBoard() });
  $('mini').addEventListener('pointerdown',e=>{
    e.preventDefault();
    const m=$('mini'), r=m.getBoundingClientRect(), w=$('bwrap');
    const fx=(e.clientX-r.left-5)/(r.width-10)*(SP.W+1)-.5, fy=(e.clientY-r.top-5)/(r.height-10)*(SP.H+1)-.5;
    w.scrollTo({left:fx*CS+12-w.clientWidth/2, top:fy*CS+12-w.clientHeight/2, behavior:REDUCED.matches?'auto':'smooth'});
  });
  $('gen').addEventListener('click',cancelGen);
}

/* pad at the cell, on a double or right click */
let PK=null, pkMode='digit';
function openPicker(i){
  closePicker();
  if(!G||G.done||G.paused||G.given[i]||SP.kind==='tokki') return;
  U.sel=i; U.msel.clear(); paint();
  pkMode=U.mode();
  const el=document.createElement('div');
  el.className='picker';
  const keys=SP.kind==='num'? [1,2,3,4,5,6,7,8,9,0] : Array.from({length:SP.maxD},(_,k)=>k+1);
  const modes=SP.kind==='num'? ['digit','corner'] : SP.maxD>9? ['digit','corner'] : MODES_IN;
  el.innerHTML=`<div class="seg">${modes.map(m=>`<button data-m="${m}" aria-label="${t(m)}">${GLYPH[m]}</button>`).join('')}</div>`+
    `<div class="pk-keys" style="--pc:${SP.maxD>9&&SP.kind!=='num'?4:3}">${keys.map(v=>`<button class="k${v>9?' d2':''}" data-v="${v}">${v}</button>`).join('')}<button class="k er" data-er="1" aria-label="${t('erase')}">${ic('erase')}</button></div>`;
  document.body.appendChild(el);
  const syncM=()=>el.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===pkMode));
  syncM();
  const c=CELLS[i].getBoundingClientRect(), w=el.offsetWidth, h=el.offsetHeight;
  let x=c.right+10;
  if(x+w>innerWidth-8) x=c.left-10-w;
  el.style.left=Math.max(8,x)+'px';
  el.style.top=Math.max(8,Math.min(innerHeight-h-8,c.top+c.height/2-h/2))+'px';
  if(!REDUCED.matches) el.animate([{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:160,easing:'cubic-bezier(.3,.7,.3,1)'});
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();
    const m=e.target.closest('[data-m]');
    if(m){ pkMode=m.dataset.m; syncM(); return }
    if(e.target.closest('[data-er]')){ erase(); closePicker(); return }
    const k=e.target.closest('[data-v]');
    if(!k) return;
    inputDigit(+k.dataset.v, SP.kind==='num'? '' : pkMode);
    if(SP.kind==='num'&&U.numOpen) return;
    if(pkMode==='digit') closePicker();
  });
  PK=el;
  setTimeout(()=>document.addEventListener('pointerdown',pkOutside,true),0);
}
function pkOutside(e){ if(PK&&!PK.contains(e.target)) closePicker() }
function closePicker(){
  if(!PK) return false;
  PK.remove(); PK=null;
  document.removeEventListener('pointerdown',pkOutside,true);
  return true;
}
