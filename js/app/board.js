'use strict';

let SPEC=null;
const cells=[];
const EMPTY=[];
/* what the cell already shows, so a move touches one cell */
const cellKey=[];
const merged=(g,i)=>g.values[i]||g.hyp[i];

function cellNum(v){ return v==null||v===0? '' : String(v) }

const CAT_SVG='<svg class="cat" viewBox="0 0 24 24" aria-hidden="true">'+
  '<path d="M4.6 9.2 4 4.4l4 2.6a9 9 0 0 1 8 0l4-2.6-.6 4.8"/>'+
  '<path d="M20 12.4c0 4.3-3.6 7.2-8 7.2s-8-2.9-8-7.2"/>'+
  '<path d="M9.4 12.2v.9M14.6 12.2v.9"/>'+
  '<path d="M12 15.4v.9M10.6 17.1c.5.5 1.9.5 2.4 0"/>'+
  '<path d="M2.6 14.6h3.2M2.6 16.8h3.2M18.2 14.6h3.2M18.2 16.8h3.2"/></svg>';
const MARK_SVG='<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">'+
  '<path d="M6 6l12 12M18 6 6 18"/></svg>';

function buildBoard(sp){
  SPEC=sp;
  const b=$('board');
  b.innerHTML=''; cells.length=0; cellKey.length=0;
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
  document.body.classList.toggle('board-meow', sp.kind==='meow');

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
    if(sp.kind==='meow') d.classList.add('z'+((sp.region[i]%10)+1));
    d.dataset.i=i;
    b.appendChild(d); cells.push(d);
  }
  b.classList.toggle('cages', !!(sp.cages||[]).length && sp.kind!=='kakuro');
  buildGlow(sp);
  buildGrid(sp);
  buildDeco(sp);
  const sb=document.createElement('div');
  sb.id='selBox'; sb.className='hidden';
  b.appendChild(sb);
}

/* halo: blur of the shape minus the shape itself */
let glowSeq=0;
function buildGlow(sp){
  const b=$('board');
  const old=b.querySelector('.glow'); if(old) old.remove();
  const boxes=(sp.frames&&sp.frames.length)? sp.frames : [{x:0,y:0,w:sp.W,h:sp.H}];
  const rects=boxes.map(f=>`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx=".1"/>`).join('');
  const id='g'+(++glowSeq);
  const halo=(dev,dy)=>`<filter id="${id}${dy?'u':'e'}" x="-40%" y="-40%" width="180%" height="180%">`+
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${dev}" result="b"/>`+
    (dy? `<feOffset in="b" dy="${dy}" result="b"/>` : '')+
    `<feComposite in="b" in2="SourceGraphic" operator="out"/></filter>`;
  const d=document.createElement('div');
  d.className='glow';
  d.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}" preserveAspectRatio="none">`+
    `<defs>${halo(.18,0)}${halo(.5,-.34)}</defs>`+
    `<g fill="var(--glow-edge)" filter="url(#${id}u)" opacity=".9">${rects}</g>`+
    `<g fill="var(--glow-edge)" filter="url(#${id}e)">${rects}</g></svg>`;
  b.insertBefore(d,b.firstChild);
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
  g.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}">`+
    `<path d="${thin}" fill="none" stroke="var(--line)" stroke-width=".022" shape-rendering="crispEdges"/>`+
    `<path d="${thick}" fill="none" stroke="var(--rule)" stroke-width=".05" stroke-linecap="square"/></svg>`;
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

/* dash step fitted to each edge so corners always meet */
function dashLine(segs,dash,gap){
  let d='';
  for(const s of segs){
    const dx=s[2]-s[0], dy=s[3]-s[1];
    const len=Math.hypot(dx,dy);
    if(!len) continue;
    const n=Math.max(1,Math.round((len+gap)/(dash+gap)));
    const step=(len+gap)/n, run=step-gap;
    const ux=dx/len, uy=dy/len;
    for(let k=0;k<n;k++){
      const a=k*step, b=a+run;
      d+=`M${(s[0]+ux*a).toFixed(3)} ${(s[1]+uy*a).toFixed(3)}`+
         `L${(s[0]+ux*b).toFixed(3)} ${(s[1]+uy*b).toFixed(3)}`;
    }
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
  const d=0.055;
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
    sums+=`<text x="${a.x+0.15}" y="${a.y+0.31}">${cg.sum}</text>`;
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
  const zonePath=joinSegments(zoneSegs);
  const cageDash=dashLine(cageSegs,0.075,0.055);
  deco.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}">`+
    (zonePath? `<path d="${zonePath}" fill="none" stroke="var(--zone-edge)" stroke-width=".035" stroke-linejoin="round"/>`:'')+
    (cageDash? `<path d="${cageDash}" fill="none" stroke="var(--cage)" stroke-width=".042" stroke-linecap="butt"/>`:'')+
    (sums? `<g class="sums" font-size=".21">${sums}</g>`:'')+
    dots+'</svg>';
  b.appendChild(deco);
}

function buildNumpad(sp){
  const np=$('numpad');
  np.innerHTML='';
  /* meowdoku needs no keypad: a tap walks the cell through mark, cat and empty */
  if(sp.kind==='meow'){
    document.body.classList.remove('pad-two');
    np.classList.add('hidden');
    return;
  }
  np.classList.remove('hidden');
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
  const isNum=sp.kind==='num', isMeow=sp.kind==='meow';
  /* meowdoku reads by its own colours, extra tinting only gets in the way */
  const hlSame=SES.settings.highlightSame!==false;
  const selVal=sel>=0? merged(g,sel) : 0;
  const activeVal=(hlSame && !isNum && !isMeow)? (selVal||hlDigit) : 0;
  const counts={};
  for(let i=0;i<n;i++){ const v=merged(g,i); if(v) counts[v]=(counts[v]||0)+1 }
  const peersOn=SES.settings.highlightPeers!==false && sp.id!=='evenodd' && !isMeow;
  const peers=(sel>=0&&peersOn)? sp.peers[sel] : null;
  for(let i=0;i<n;i++){
    const d=cells[i], v=g.values[i], hv=g.hyp[i];
    const mid=g.mid? g.mid[i] : EMPTY;
    d.className=d.className.replace(/ (msel|mt|mr|mb|ml|sel|hl|same|err|given|hypv|d2)/g,'');
    if(g.given[i]) d.classList.add('given');
    const key = isMeow? 'm'+v : v? 'v'+v : hv? 'h'+hv
      : (g.notes[i].length||mid.length)? 'n'+g.notes[i].join(',')+'/'+mid.join(',')+'|'+(activeVal||0) : '';
    if(cellKey[i]!==key){
      if(isMeow) d.innerHTML = v===MEOW_CAT? CAT_SVG : v===MEOW_MARK? MARK_SVG : '';
      else if(v) d.innerHTML='<i class="v">'+cellNum(v)+'</i>';
      else if(hv) d.innerHTML='<i class="v">'+cellNum(hv)+'</i>';
      else if(g.notes[i].length||mid.length){
        if(isNum){
          d.innerHTML='<div class="notes wide">'+g.notes[i].slice(0,6).map(v=>`<span>${v}</span>`).join('')+'</div>';
        } else {
          let h='';
          if(g.notes[i].length){
            const split = mid.length? (sp.maxD>9? ' split split12' : ' split') : '';
            h+='<div class="notes'+split+'">';
            for(let k=1;k<=sp.maxD;k++)
              h+=`<span${activeVal&&k===activeVal?' class="nhl"':''}>${g.notes[i].includes(k)?k:''}</span>`;
            h+='</div>';
          }
          if(mid.length){
            const txt=mid.join(sp.maxD>9? ' ' : '');
            const size = txt.length>5? ' tiny' : txt.length>3? ' tight' : '';
            const hl = activeVal&&mid.includes(activeVal)? ' nhl' : '';
            h+=`<i class="mid${size}${hl}">${txt}</i>`;
          }
          d.innerHTML=h;
        }
      } else d.textContent='';
      cellKey[i]=key;
    }
    if(isMeow){
      if(v===MEOW_CAT && g.instant && (g.solution[i]!==MEOW_CAT || meowClash(g,sp,i)))
        d.classList.add('err');
    } else if(v){
      if(v>9) d.classList.add('d2');
      if(g.instant && !g.given[i] && v!==g.solution[i]) d.classList.add('err');
    } else if(hv){
      d.classList.add('hypv');
      if(hv>9) d.classList.add('d2');
    }
    if(!g.instant && g.endErr && g.endErr.includes(i)) d.classList.add('err');
    /* the run is outlined along its rim: an edge is drawn only where the next cell is outside */
    if(msel.size>1 && msel.has(i)){
      d.classList.add('msel');
      const c=sp.cells[i];
      const kin=(dx,dy)=>{ const j=cellAt(sp,c.x+dx,c.y+dy); return j>=0 && msel.has(j) };
      if(!kin(0,-1)) d.classList.add('mt');
      if(!kin(1,0)) d.classList.add('mr');
      if(!kin(0,1)) d.classList.add('mb');
      if(!kin(-1,0)) d.classList.add('ml');
    }
    if(sel>=0){
      if(i===sel) d.classList.add('sel');
      else if(peers && peers.indexOf(i)>=0) d.classList.add('hl');
    }
    if(activeVal && i!==sel){
      const hasNote=!v&&!hv&&!isNum&&(g.notes[i].includes(activeVal)||mid.includes(activeVal));
      if(merged(g,i)===activeVal||hasNote) d.classList.add('same');
    }
  }
  const showCounts=SES.settings.showCounts!==false && !isNum && !isMeow;
  const tot=digitTotals(g);
  document.querySelectorAll('.num').forEach(btn=>{
    if(btn.dataset.v===undefined) return;
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
  const wrong = sp.kind==='meow'
    ? g.values[sel]===MEOW_CAT && g.solution[sel]!==MEOW_CAT
    : g.values[sel] && !g.given[sel] && g.values[sel]!==g.solution[sel];
  if(g.instant && wrong) sb.classList.add('err');
  else if(inputMode==='hyp' || g.hyp[sel]) sb.classList.add('hyp');
}

const ZOOM_CELL=38;
let boardZoom=false, lockFit=0;

function otherHeight(){
  let used=0;
  const parts=[document.querySelector('header'), document.querySelector('.topbar'),
    $('pickHint'), document.querySelector('.controls'), $('numpad'),
    $('winPanel'), document.querySelector('.site-foot')];
  for(const el of parts) if(el && el.offsetParent!==null) used+=el.getBoundingClientRect().height;
  const m=document.querySelector('main');
  if(m){ const cs=getComputedStyle(m); used+=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom) }
  return used+46;
}
function fitBoth(bw){
  const pan=$('boardPan'), wrap=document.querySelector('.board-wrap');
  const byW=Math.floor(((pan.clientWidth||0)-bw)/SPEC.W);
  const availH = isLand()? (wrap? wrap.clientHeight : 0) : window.innerHeight-otherHeight();
  const byH=Math.floor((availH-bw)/SPEC.H);
  return byH>0? Math.max(1,Math.min(byW,byH)) : byW;
}
function freeSpace(){
  let used=0;
  for(const el of [document.querySelector('header'), document.querySelector('main'), document.querySelector('.site-foot')])
    if(el && el.offsetParent!==null) used+=el.getBoundingClientRect().height;
  return window.innerHeight-used;
}
function fitCell(){
  const b=$('board');
  if(!b||!SPEC) return 0;
  return fitBoth((parseFloat(getComputedStyle(b).borderLeftWidth)||0)*2);
}
function zoomUseful(){ return isPhone() && SPEC && fitCell()<ZOOM_CELL-2 }
function snapBoard(){
  const b=$('board'), pan=$('boardPan'); if(!b||!SPEC||!pan) return;
  b.style.width=''; pan.style.width=''; pan.style.maxHeight='';
  pan.classList.remove('pan');
  const bw=(parseFloat(getComputedStyle(b).borderLeftWidth)||0)*2;
  const wantZoom=boardZoom && isPhone();
  document.body.classList.toggle('board-zoom',wantZoom);
  const won=document.body.classList.contains('won');
  let fit=(won&&lockFit)? lockFit : fitBoth(bw);
  const zoom=wantZoom && fit<ZOOM_CELL;
  if(wantZoom && !zoom){ document.body.classList.remove('board-zoom'); fit=(won&&lockFit)? lockFit : fitBoth(bw) }
  if(fit<=0) return;
  if(!won) lockFit=fit;
  const box=fit*SPEC.W+bw;
  $('game').style.setProperty('--board-px',box+'px');
  if(zoom){
    pan.classList.add('pan');
    const fitH=fit*SPEC.H+bw;
    pan.style.maxHeight=fitH+'px';
    b.style.width=(ZOOM_CELL*SPEC.W+bw)+'px';
    $('game').style.setProperty('--board-px',(pan.clientWidth||box)+'px');
    const grow=Math.max(0,freeSpace()-16);
    pan.style.maxHeight=Math.round(Math.min(ZOOM_CELL*SPEC.H+bw, fitH+grow))+'px';
  } else {
    b.style.width=box+'px';
  }
  syncZoomBtn();
  return fit;
}
/* keypad height follows board width, so fit twice */
function snapBoardTwice(){
  const first=snapBoard();
  const second=snapBoard();
  if(second!==first) snapBoard();
}
function syncZoomBtn(){
  const btn=$('zoomBtn'); if(!btn) return;
  const on=boardZoom && isPhone();
  btn.classList.toggle('hidden', !zoomUseful());
  btn.classList.toggle('on', on);
  btn.innerHTML = on
    ? '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8.4 11h5.2"/></svg>'
    : '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8.4 11h5.2M11 8.4v5.2"/></svg>';
  const lab=t(on? 'zoomFit' : 'zoomIn');
  btn.title=lab; btn.setAttribute('aria-label',lab);
}
function setZoom(on){
  boardZoom=!!on;
  snapBoard();
  if(!boardZoom) return;
  if(sel>=0) scrollSelIntoView(); else centerBoardPan();
  panHint();
}
function panHint(){
  if(!$('boardPan').classList.contains('pan')) return;
  try{
    if(localStorage.getItem('sudoku-panHint')) return;
    localStorage.setItem('sudoku-panHint','1');
  }catch(e){}
  toast(t('panHint'));
}
function scrollSelIntoView(){
  const pan=$('boardPan');
  if(!pan||!pan.classList.contains('pan')||sel<0||!cells[sel]) return;
  const p=pan.getBoundingClientRect(), c=cells[sel].getBoundingClientRect();
  if(c.left<p.left) pan.scrollLeft-=p.left-c.left+8;
  else if(c.right>p.right) pan.scrollLeft+=c.right-p.right+8;
  if(c.top<p.top) pan.scrollTop-=p.top-c.top+8;
  else if(c.bottom>p.bottom) pan.scrollTop+=c.bottom-p.bottom+8;
}
function centerBoardPan(){
  const pan=$('boardPan');
  if(!pan||!pan.classList.contains('pan')) return;
  pan.scrollLeft=(pan.scrollWidth-pan.clientWidth)/2;
  pan.scrollTop=(pan.scrollHeight-pan.clientHeight)/2;
}
