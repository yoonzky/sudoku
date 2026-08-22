'use strict';

let SPEC=null;
const cells=[];
const merged=(g,i)=>g.values[i]||g.hyp[i];

function cellNum(v){ return v==null||v===0? '' : String(v) }

function buildBoard(sp){
  SPEC=sp;
  const b=$('board');
  b.innerHTML=''; cells.length=0;
  b.style.gridTemplateColumns=`repeat(${sp.W},1fr)`;
  b.style.gridTemplateRows=`repeat(${sp.H},1fr)`;
  b.style.aspectRatio=`${sp.W} / ${sp.H}`;
  b.style.setProperty('--bw',sp.W);
  b.style.setProperty('--bh',sp.H);
  const nc = sp.maxD<=9? 3 : 4;
  b.style.setProperty('--nc',nc);
  b.style.setProperty('--nr',Math.ceil(sp.maxD/nc));
  document.body.classList.toggle('board-wide', sp.W>12);
  document.body.classList.toggle('board-num', sp.kind==='num');

  for(const bl of sp.blocks||[]){
    const d=document.createElement('div');
    d.className='blk';
    d.style.gridColumn=bl.x+1; d.style.gridRow=bl.y+1;
    b.appendChild(d);
  }
  for(const c of sp.clues||[]){
    const d=document.createElement('div');
    d.className='clue';
    d.style.gridColumn=c.x+1; d.style.gridRow=c.y+1;
    d.innerHTML='<svg viewBox="0 0 10 10" preserveAspectRatio="none"><line x1="0" y1="0" x2="10" y2="10"/></svg>'+
      `<u>${c.r||''}</u><s>${c.d||''}</s>`;
    b.appendChild(d);
  }
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const d=document.createElement('div');
    d.className='cell';
    d.style.gridColumn=c.x+1; d.style.gridRow=c.y+1;
    if(sp.zone[i]===1) d.classList.add('zone');
    if(sp.zone[i]===2) d.classList.add('even');
    d.dataset.i=i;
    b.appendChild(d); cells.push(d);
  }
  buildGrid(sp);
  buildDeco(sp);
  const sb=document.createElement('div');
  sb.id='selBox'; sb.className='hidden';
  b.appendChild(sb);
}

function buildGrid(sp){
  const b=$('board');
  const old=b.querySelector('.grid'); if(old) old.remove();
  let thin='', thick='';
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i], x=c.x, y=c.y;
    const up=cellAt(sp,x,y-1), lf=cellAt(sp,x-1,y);
    const dn=cellAt(sp,x,y+1), rt=cellAt(sp,x+1,y);
    const wall=n=> n<0 || sp.region[n]!==sp.region[i];
    (wall(up)? thick=thick+`M${x} ${y}H${x+1}` : thin=thin+`M${x} ${y}H${x+1}`);
    (wall(lf)? thick=thick+`M${x} ${y}V${y+1}` : thin=thin+`M${x} ${y}V${y+1}`);
    if(dn<0) thick+=`M${x} ${y+1}H${x+1}`;
    if(rt<0) thick+=`M${x+1} ${y}V${y+1}`;
  }
  const g=document.createElement('div');
  g.className='grid';
  g.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}" shape-rendering="crispEdges">`+
    `<path d="${thin}" fill="none" stroke="var(--line)" stroke-width=".022"/>`+
    `<path d="${thick}" fill="none" stroke="var(--rule)" stroke-width=".05"/></svg>`;
  b.appendChild(g);
}

function joinSegments(segs){
  const key=(x,y)=>x.toFixed(4)+','+y.toFixed(4);
  const at=new Map();
  for(const s of segs){
    for(const k of [key(s[0],s[1]),key(s[2],s[3])]){
      if(!at.has(k)) at.set(k,[]);
      at.get(k).push(s);
    }
  }
  const used=new Set();
  const same=(a,b)=>Math.abs(a-b)<1e-6;
  let d='';
  for(const seed of segs){
    if(used.has(seed)) continue;
    used.add(seed);
    const chain=[seed.slice()];
    let end=[seed[2],seed[3]];
    for(;;){
      const list=at.get(key(end[0],end[1]))||[];
      const next=list.find(t=>!used.has(t));
      if(!next) break;
      used.add(next);
      const fromStart=same(next[0],end[0])&&same(next[1],end[1]);
      const seg=fromStart? next.slice() : [next[2],next[3],next[0],next[1]];
      chain.push(seg);
      end=[seg[2],seg[3]];
    }
    let start=[chain[0][0],chain[0][1]];
    for(;;){
      const list=at.get(key(start[0],start[1]))||[];
      const prev=list.find(t=>!used.has(t));
      if(!prev) break;
      used.add(prev);
      const toStart=same(prev[2],start[0])&&same(prev[3],start[1]);
      const seg=toStart? prev.slice() : [prev[2],prev[3],prev[0],prev[1]];
      chain.unshift(seg);
      start=[seg[0],seg[1]];
    }
    d+=`M${chain[0][0]} ${chain[0][1]}`;
    for(const c of chain) d+=`L${c[2]} ${c[3]}`;
  }
  return d;
}

function buildDeco(sp){
  const b=$('board');
  const old=b.querySelector('.deco'); if(old) old.remove();
  if(sp.kind==='kakuro') return;
  const hasZone=sp.zone.some(z=>z===1);
  if(!sp.cages.length && !sp.dots.length && !hasZone) return;
  const deco=document.createElement('div');
  deco.className='deco';
  const d=0.13;
  const cageSegs=[];
  let sums='';
  const inCage=(cg,x,y)=>{ const j=cellAt(sp,x,y); return j>=0 && cg.cells.indexOf(j)>=0 };
  for(const cg of sp.cages){
    for(const i of cg.cells){
      const c=sp.cells[i], x=c.x, y=c.y;
      const up=inCage(cg,x,y-1), dn=inCage(cg,x,y+1), lf=inCage(cg,x-1,y), rt=inCage(cg,x+1,y);
      const x0=lf? x : x+d, x1=rt? x+1 : x+1-d;
      const y0=up? y : y+d, y1=dn? y+1 : y+1-d;
      if(!up) cageSegs.push([x0,y+d,x1,y+d]);
      if(!dn) cageSegs.push([x0,y+1-d,x1,y+1-d]);
      if(!lf) cageSegs.push([x+d,y0,x+d,y1]);
      if(!rt) cageSegs.push([x+1-d,y0,x+1-d,y1]);
    }
    const a=sp.cells[cg.anchor!=null? cg.anchor : cg.cells[0]];
    sums+=`<text x="${a.x+0.19}" y="${a.y+0.36}">${cg.sum}</text>`;
  }
  const zoneSegs=[];
  if(hasZone){
    const inZone=(x,y)=>{ const j=cellAt(sp,x,y); return j>=0 && sp.zone[j]===1 };
    const z=0.06;
    for(let i=0;i<sp.cells.length;i++){
      if(sp.zone[i]!==1) continue;
      const c=sp.cells[i], x=c.x, y=c.y;
      const up=inZone(x,y-1), dn=inZone(x,y+1), lf=inZone(x-1,y), rt=inZone(x+1,y);
      const x0=lf? x : x+z, x1=rt? x+1 : x+1-z;
      const y0=up? y : y+z, y1=dn? y+1 : y+1-z;
      if(!up) zoneSegs.push([x0,y+z,x1,y+z]);
      if(!dn) zoneSegs.push([x0,y+1-z,x1,y+1-z]);
      if(!lf) zoneSegs.push([x+z,y0,x+z,y1]);
      if(!rt) zoneSegs.push([x+1-z,y0,x+1-z,y1]);
    }
  }
  let dots='';
  for(const dt of sp.dots){
    const a=sp.cells[dt.a], c=sp.cells[dt.b];
    const cx=(a.x+c.x+1)/2, cy=(a.y+c.y+1)/2;
    const fill=dt.k===2? 'var(--dot-b-bg)' : 'var(--dot-w-bg)';
    const line=dt.k===2? 'var(--dot-b-line)' : 'var(--dot-w-line)';
    dots+=`<circle cx="${cx}" cy="${cy}" r=".095" fill="${fill}" stroke="${line}" stroke-width=".026"/>`;
  }
  const cagePath=joinSegments(cageSegs), zonePath=joinSegments(zoneSegs);
  deco.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}">`+
    (zonePath? `<path d="${zonePath}" fill="none" stroke="var(--zone-edge)" stroke-width=".035" stroke-linejoin="round"/>`:'')+
    (cagePath? `<path d="${cagePath}" fill="none" stroke="var(--cage)" stroke-width=".026" stroke-dasharray=".07 .06" stroke-linejoin="round" stroke-linecap="butt"/>`:'')+
    (sums? `<g class="sums" font-size=".26">${sums}</g>`:'')+
    dots+'</svg>';
  b.appendChild(deco);
}

function buildNumpad(sp){
  const np=$('numpad');
  np.innerHTML='';
  const max=sp.kind==='num'? 9 : sp.maxD;
  const cols = sp.kind==='num'? 5 : max>9? Math.ceil(max/2) : max;
  np.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  np.classList.toggle('two-row', sp.kind!=='num' && max>9);
  document.body.classList.toggle('pad-two', sp.kind==='num' || max>9);
  const keys=[];
  for(let v=1;v<=max;v++) keys.push(v);
  if(sp.kind==='num') keys.push(0);
  for(const v of keys){
    const btn=document.createElement('button');
    btn.className='num'; btn.dataset.v=v;
    btn.innerHTML=`${v}<small></small>`;
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); numpadPress(v) });
    np.appendChild(btn);
  }
}

const TOT_CACHE={};
function digitTotals(g){
  if(TOT_CACHE.id===g.id) return TOT_CACHE.map;
  const m={};
  for(const v of g.solution) m[v]=(m[v]||0)+1;
  TOT_CACHE.id=g.id; TOT_CACHE.map=m;
  return m;
}

function renderBoard(){
  const g=cur(); if(!g||!SPEC) return;
  const sp=SPEC, n=sp.cells.length;
  const isNum=sp.kind==='num';
  const hlSame=SES.settings.highlightSame!==false;
  const selVal=sel>=0? merged(g,sel) : 0;
  const activeVal=(hlSame && sp.kind!=='num')? (selVal||hlDigit) : 0;
  const counts={};
  for(let i=0;i<n;i++){ const v=merged(g,i); if(v) counts[v]=(counts[v]||0)+1 }
  const peers=sel>=0? sp.peers[sel] : null;
  for(let i=0;i<n;i++){
    const d=cells[i], v=g.values[i], hv=g.hyp[i];
    d.className=d.className.replace(/ (sel|hl|same|err|given|hypv|d2)/g,'');
    if(g.given[i]) d.classList.add('given');
    if(v){
      d.textContent=cellNum(v);
      if(v>9) d.classList.add('d2');
      if(g.instant && !g.given[i] && v!==g.solution[i]) d.classList.add('err');
    } else if(hv){
      d.textContent=cellNum(hv); d.classList.add('hypv');
      if(hv>9) d.classList.add('d2');
    } else if(g.notes[i].length){
      if(isNum){
        d.innerHTML='<div class="notes wide">'+g.notes[i].slice(0,6).map(v=>`<span>${v}</span>`).join('')+'</div>';
      } else {
        let h='<div class="notes">';
        for(let k=1;k<=sp.maxD;k++)
          h+=`<span${activeVal&&k===activeVal?' class="nhl"':''}>${g.notes[i].includes(k)?k:''}</span>`;
        d.innerHTML=h+'</div>';
      }
    } else d.textContent='';
    if(!g.instant && g.endErr && g.endErr.includes(i)) d.classList.add('err');
    if(sel>=0){
      if(i===sel) d.classList.add('sel');
      else if(peers.indexOf(i)>=0) d.classList.add('hl');
    }
    if(activeVal && i!==sel){
      const hasNote=!v&&!hv&&!isNum&&g.notes[i].includes(activeVal);
      if(merged(g,i)===activeVal||hasNote) d.classList.add('same');
    }
  }
  const showCounts=SES.settings.showCounts!==false && !isNum;
  const tot=digitTotals(g);
  document.querySelectorAll('.num').forEach(btn=>{
    const v=+btn.dataset.v;
    const left=(tot[v]||0)-(counts[v]||0);
    const small=btn.querySelector('small');
    if(small) small.textContent=(showCounts&&left>0)?left:'';
    btn.classList.toggle('done', !isNum && left<=0);
    btn.classList.toggle('hl', v>0 && hlDigit===v);
    btn.classList.toggle('armed', v>0 && SES.settings.digitFirst && armed===v);
  });
  const np=$('numpad');
  if(np){ np.classList.toggle('mode-note', inputMode==='note'); np.classList.toggle('mode-hyp', inputMode==='hyp') }
  placeSelBox(g,sp);
  $('gMistWrap').style.display=g.instant? '' : 'none';
  $('gMist').textContent=(SES.settings.limit&&g.instant&&!g.noLimit)? `${g.mistakes}/3` : g.mistakes;
  $('gMode').textContent=t('m_'+g.mode);
  $('gDiff').textContent=t('d_'+g.diff);
  $('board').classList.toggle('notes-on', inputMode==='note');
  $('board').classList.toggle('hyp-on', inputMode==='hyp');
  $('undoBtn').disabled=!undoStack.length;
  $('redoBtn').disabled=!redoStack.length;
}

function placeSelBox(g,sp){
  const sb=$('selBox'); if(!sb) return;
  if(sel<0){ sb.classList.add('hidden'); return }
  const c=sp.cells[sel];
  sb.style.left=(c.x/sp.W*100)+'%';
  sb.style.top=(c.y/sp.H*100)+'%';
  sb.style.width=(100/sp.W)+'%';
  sb.style.height=(100/sp.H)+'%';
  sb.className='';
  if(g.instant && g.values[sel] && !g.given[sel] && g.values[sel]!==g.solution[sel]) sb.classList.add('err');
  else if(inputMode==='hyp' || g.hyp[sel]) sb.classList.add('hyp');
}

function snapBoard(){
  const b=$('board'); if(!b||!SPEC) return;
  b.style.width='';
  const w=b.getBoundingClientRect().width;
  const bw=(parseFloat(getComputedStyle(b).borderLeftWidth)||0)*2;
  const c=Math.floor((w-bw)/SPEC.W);
  if(c>0){
    const px=c*SPEC.W+bw;
    b.style.width=px+'px';
    $('game').style.setProperty('--board-px',px+'px');
  }
}
