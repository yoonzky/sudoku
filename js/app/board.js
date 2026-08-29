'use strict';

let SPEC=null;
const cells=[];
const EMPTY=[];
/* what the cell drew last, so a move repaints one cell */
const cellKey=[];

function cellNum(v){ return v==null||v===0? '' : String(v) }

/* six faces, one per member: head, two letters, muzzle under them. One
   round outline, no straight sides. Every head shares the same lower
   half, so whiskers meet the line wherever they are drawn. Whiskers on
   all but the bear and the dog */
const FACE_MUZZLE='<path d="M12 10.8v5.8"/>'+
  '<path d="M8 16.6a2 2 0 0 0 4 0"/><path d="M12 16.6a2 2 0 0 0 4 0"/>';
const FACE_WHISKERS='<path d="M3.6 15.4H.8M4.4 17.2H1.6M5.8 19H3"/>'+
  '<path d="M20.4 15.4h2.8M19.6 17.2h2.8M18.2 19h2.8"/>';
const FACE_LEFT={
  N:'<path d="M6.4 14.4V11l3 3.4V11"/>',
  M:'<path d="M6.4 14.4V11l1.5 2 1.5-2v3.4"/>',
  H:'<path d="M6.4 11v3.4M9.4 11v3.4M6.4 12.7h3"/>',
  D:'<path d="M6.4 14.4V11h1.2a1.7 1.7 0 0 1 0 3.4H6.4"/>'
};
const FACE_RIGHT={
  Z:'<path d="M14.6 11h3l-3 3.4h3"/>',
  J:'<path d="M17.6 11v2.2a1.4 1.4 0 0 1-2.8 0"/>',
  N:'<path d="M14.6 14.4V11l3 3.4V11"/>',
  R:'<path d="M14.6 14.4V11h1.4a1.1 1.1 0 0 1 0 2.2h-1.4l2.4 1.2"/>',
  I:'<path d="M14.8 11h2.8M16.2 11v3.4M14.8 14.4h2.8"/>'
};
const FACE_HEADS=[
  ['nz','N','Z',1,'<path d="M3.4 12.6C3.4 9.6 3.4 7.6 3.6 6a3.2 3.2 0 0 1 6.4 0c.2 2.2.8 4.6 2 4.6s1.8-2.4 2-4.6a3.2 3.2 0 0 1 6.4 0c.2 1.6.2 3.6.2 6.6a8.6 9 0 0 1-17.2 0Z"/>'],
  ['mj','M','J',0,'<path d="M3.4 12.6c0-1.8.3-3.3.9-4.5a2.5 2.5 0 1 1 3.9-2.6 10.4 10.4 0 0 1 7.6 0 2.5 2.5 0 1 1 3.9 2.6c.6 1.2.9 2.7.9 4.5a8.6 9 0 0 1-17.2 0Z"/>'],
  ['hn','H','N',1,'<path d="M3.2 12.6c0-2 .3-3.6.9-4.8a2 2 0 1 1 2.9-2.4 11.5 11.5 0 0 1 10 0 2 2 0 1 1 2.9 2.4c.6 1.2.9 2.8.9 4.8a8.8 9 0 0 1-17.6 0Z"/>'],
  ['hr','H','R',1,'<path d="M3.4 12.6C3.4 10 3.6 8 4.2 6.6L4.6 2.9 8.6 5.4a10 10 0 0 1 6.8 0l4-2.5.4 3.7c.6 1.4.8 3.4.8 6a8.6 9 0 0 1-17.2 0Z"/>'],
  ['hi','H','I',1,'<path d="M3.2 12.6c0-1.2.1-2.3.3-3.2a3.8 3.8 0 1 1 5-5 10 10 0 0 1 7 0 3.8 3.8 0 1 1 5 5c.2.9.3 2 .3 3.2a8.8 9 0 0 1-17.6 0Z"/>'],
  ['dn','D','N',0,'<path d="M3.6 12.6C3.6 11.4 3.7 10.4 3.9 9.5 2.6 10.2 1.6 11.2 2 11.8c.6.8 2.4-2.8 4.2-6a10 10 0 0 1 11.6 0c1.8 3.2 3.6 6.8 4.2 6 .4-.6-.6-1.6-1.9-2.3.2.9.3 1.9.3 3.1a8.4 9 0 0 1-16.8 0Z"/>']
];
const FACE_SVGS=FACE_HEADS.map(f=>'<svg class="face f-'+f[0]+'" viewBox="0 0 24 24" aria-hidden="true">'+
  f[4]+FACE_LEFT[f[1]]+FACE_RIGHT[f[2]]+FACE_MUZZLE+(f[3]? FACE_WHISKERS : '')+'</svg>');
/* the face is dealt when the bunny is seated and stays with the cell; a game
   saved before the faces existed gets its own on the first draw */
function tokkiFace(g,i){
  if(g && (!g.face || g.face[i]==null)) dealFace(g,i);
  const n=(g&&g.face&&g.face[i]!=null)? g.face[i] : 0;
  return FACE_SVGS[n%FACE_SVGS.length];
}
const MARK_SVG='<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">'+
  '<path d="M12 12c0-2.7 1-4.3 2.9-4.3 1.8 0 3 1.2 3 3 0 1.9-1.6 2.9-4.3 2.9 2.7 0 4.3 1 4.3 2.9 0 1.8-1.2 3-3 3-1.9 0-2.9-1.6-2.9-4.3 0 2.7-1 4.3-2.9 4.3-1.8 0-3-1.2-3-3 0-1.9 1.6-2.9 4.3-2.9-2.7 0-4.3-1-4.3-2.9 0-1.8 1.2-3 3-3 1.9 0 2.9 1.6 2.9 4.3Z"/></svg>';

/* what a screen reader gets instead of the drawing: where the cell is and what
   stands in it */
function cellLabel(g,sp,i){
  const c=sp.cells[i];
  const pos=t('a11yCell').replace('{r}',c.y+1).replace('{c}',c.x+1);
  const v=g.values[i];
  let val;
  if(sp.kind==='tokki')
    val = v===TOKKI_BUN? t('a11yBun') : v===TOKKI_MARK? t('a11yMark') : t('a11yEmpty');
  else if(v) val = v+(g.given[i]? ', '+t('a11yGiven') : '');
  else if(g.notes[i].length) val = t('a11yNote').replace('{v}',g.notes[i].join(' '));
  else val = t('a11yEmpty');
  return pos+', '+val;
}

/* the cell keeps what it drew last, so a language switch has to forget it or
   the spoken labels stay in the old one */
function invalidateCells(){ cellKey.length=0 }

function buildBoard(sp){
  SPEC=sp;
  const b=$('board');
  b.innerHTML=''; cells.length=0; cellKey.length=0;
  /* the board is driven by the arrow keys rather than read as a table: the
     cells sit in a css grid with holes in it, and rows would have to be faked.
     The picked cell is announced through aria-activedescendant instead */
  b.setAttribute('role','application');
  b.setAttribute('tabindex','0');
  b.setAttribute('aria-label',t('a11yBoard'));
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
  document.body.classList.toggle('board-tokki', sp.kind==='tokki');

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
    if(sp.kind==='tokki') d.classList.add('z'+((sp.region[i]%10)+1));
    d.dataset.i=i; d.id='cell'+i;
    b.appendChild(d); cells.push(d);
  }
  b.classList.toggle('cages', !!(sp.cages||[]).length && sp.kind!=='kakuro');
  /* corner ticks need a cell in every corner, or they hang in empty space */
  b.classList.toggle('corners', [[0,0],[sp.W-1,0],[0,sp.H-1],[sp.W-1,sp.H-1]]
    .every(([x,y])=>cellAt(sp,x,y)>=0));
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
    `<path d="${thin}" fill="none" stroke="var(--rule-thin)" stroke-width=".022" shape-rendering="crispEdges"/>`+
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
  const hasEven=sp.zone.some(z=>z===2);
  if(!sp.cages.length && !sp.dots.length && !hasZone && !hasEven) return;
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
  /* a region is outlined along its outer rim only: where the neighbour belongs
     to the same region the side is left undrawn */
  const outline=(mark,z,boxed)=>{
    const segs=[];
    for(let i=0;i<sp.cells.length;i++){
      if(sp.zone[i]!==mark) continue;
      const c=sp.cells[i], x=c.x, y=c.y;
      /* even cells join up inside their own box only: across a box wall the
         marks belong to different threes and are ringed apart */
      const reg=sp.region[i];
      const inSame=(px,py)=>{ const j=cellAt(sp,px,py);
        return j>=0 && sp.zone[j]===mark && (!boxed || sp.region[j]===reg) };
      const up=inSame(x,y-1), dn=inSame(x,y+1), lf=inSame(x-1,y), rt=inSame(x+1,y);
      const x0=lf? x : x+z, x1=rt? x+1 : x+1-z;
      const y0=up? y : y+z, y1=dn? y+1 : y+1-z;
      if(!up) segs.push([x0,y+z,x1,y+z]);
      if(!dn) segs.push([x0,y+1-z,x1,y+1-z]);
      if(!lf) segs.push([x+z,y0,x+z,y1]);
      if(!rt) segs.push([x+1-z,y0,x+1-z,y1]);
      /* a concave corner: both neighbours are in the region, the diagonal one is
         not. Without these two short strokes an L shaped turn stays open */
      const dia=(dx,dy)=>{ const j=cellAt(sp,x+dx,y+dy);
        return j>=0 && sp.zone[j]===mark && (!boxed || sp.region[j]===reg) };
      if(lf&&up&&!dia(-1,-1)){ segs.push([x+z,y,x+z,y+z]); segs.push([x,y+z,x+z,y+z]) }
      if(rt&&up&&!dia(1,-1)){ segs.push([x+1-z,y,x+1-z,y+z]); segs.push([x+1-z,y+z,x+1,y+z]) }
      if(lf&&dn&&!dia(-1,1)){ segs.push([x+z,y+1-z,x+z,y+1]); segs.push([x,y+1-z,x+z,y+1-z]) }
      if(rt&&dn&&!dia(1,1)){ segs.push([x+1-z,y+1-z,x+1-z,y+1]); segs.push([x+1-z,y+1-z,x+1,y+1-z]) }
    }
    return segs;
  };
  const zoneSegs = hasZone? outline(1,0.06) : [];
  const evenSegs = hasEven? outline(2,0.06,true) : [];
  let dots='';
  for(const dt of sp.dots){
    const a=sp.cells[dt.a], c=sp.cells[dt.b];
    const cx=(a.x+c.x+1)/2, cy=(a.y+c.y+1)/2;
    const fill=dt.k===2? 'var(--dot-b-bg)' : 'var(--dot-w-bg)';
    const line=dt.k===2? 'var(--dot-b-line)' : 'var(--dot-w-line)';
    dots+=`<circle cx="${cx}" cy="${cy}" r=".095" fill="${fill}" stroke="${line}" stroke-width=".026"/>`;
  }
  const zonePath=joinSegments(zoneSegs);
  const evenPath=joinSegments(evenSegs);
  const cageDash=dashLine(cageSegs,0.075,0.055);
  deco.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}">`+
    (zonePath? `<path d="${zonePath}" fill="none" stroke="var(--zone-edge)" stroke-width=".035" stroke-linejoin="round"/>`:'')+
    (evenPath? `<path d="${evenPath}" fill="none" stroke="var(--zone-edge)" stroke-width=".035" stroke-linejoin="round"/>`:'')+
    (cageDash? `<path d="${cageDash}" fill="none" stroke="var(--cage)" stroke-width=".042" stroke-linecap="butt"/>`:'')+
    (sums? `<g class="sums" font-size=".21">${sums}</g>`:'')+
    dots+'</svg>';
  b.appendChild(deco);
}

function buildNumpad(sp){
  const np=$('numpad');
  np.innerHTML='';
  /* tokkidoku needs no keypad: a tap walks the cell through mark, bunny and empty */
  if(sp.kind==='tokki'){
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
    /* the counter in the corner is decoration for the ear: without this the key
       reads as two numbers in a row */
    btn.innerHTML=`${v}<small aria-hidden="true"></small>`;
    btn.setAttribute('aria-label',t('a11yKey').replace('{v}',v));
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
  const isNum=sp.kind==='num', isTokki=sp.kind==='tokki';
  /* tokkidoku reads by its own colours, extra tinting gets in the way */
  const hlSame=SES.settings.highlightSame!==false;
  const selVal=sel>=0? g.values[sel] : 0;
  const activeVal=(hlSame && !isNum && !isTokki)? (selVal||hlDigit) : 0;
  const counts={};
  for(let i=0;i<n;i++){ const v=g.values[i]; if(v) counts[v]=(counts[v]||0)+1 }
  const peersOn=SES.settings.highlightPeers!==false && !isTokki;
  const peers=(sel>=0&&peersOn)? sp.peers[sel] : null;
  for(let i=0;i<n;i++){
    const d=cells[i], v=g.values[i];
    const mid=g.mid? g.mid[i] : EMPTY;
    d.className=d.className.replace(/ (msel|sel|hl|same|err|given|d2)/g,'');
    if(g.given[i]) d.classList.add('given');
    const key = isTokki? 'm'+v : v? 'v'+v
      : (g.notes[i].length||mid.length)? 'n'+g.notes[i].join(',')+'/'+mid.join(',')+'|'+(activeVal||0) : '';
    if(cellKey[i]!==key){
      if(isTokki) d.innerHTML = v===TOKKI_BUN? tokkiFace(g,i) : v===TOKKI_MARK? MARK_SVG : '';
      else if(v) d.innerHTML='<i class="v">'+cellNum(v)+'</i>';
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
      d.setAttribute('aria-label',cellLabel(g,sp,i));
      cellKey[i]=key;
    }
    if(isTokki){
      if(v===TOKKI_BUN && g.instant && (g.solution[i]!==TOKKI_BUN || tokkiClash(g,sp,i)))
        d.classList.add('err');
    } else if(v){
      if(v>9) d.classList.add('d2');
      if(g.instant && !g.given[i] && v!==g.solution[i]) d.classList.add('err');
    }
    if(!g.instant && g.endErr && g.endErr.includes(i)) d.classList.add('err');
    /* every picked cell is ringed on all four sides: a rim around the whole run
       read as one box with a grid inside, not as a set of chosen cells */
    const run=msel.size>1;
    if(run && msel.has(i)) d.classList.add('msel');
    /* while a run of cells is picked the row and column of the first are left
       alone, or half the run ends up tinted differently from the rest */
    if(sel>=0 && !run){
      if(i===sel && !isTokki) d.classList.add('sel');
      else if(peers && peers.indexOf(i)>=0) d.classList.add('hl');
    }
    if(activeVal && !run && i!==sel){
      const hasNote=!v&&!isNum&&(g.notes[i].includes(activeVal)||mid.includes(activeVal));
      if(g.values[i]===activeVal||hasNote) d.classList.add('same');
    }
  }
  /* a paused board is hidden, and so is what is known about it */
  const showCounts=SES.settings.showCounts!==false && !isNum && !isTokki && !g.paused;
  /* on a linked board every digit is short by a couple of dozen, and a two
     figure count crowds the key: it appears once the end is in sight */
  const countCap = n>81? 10 : 99;
  const tot=digitTotals(g);
  document.querySelectorAll('.num').forEach(btn=>{
    if(btn.dataset.v===undefined) return;
    const v=+btn.dataset.v;
    const left=(tot[v]||0)-(counts[v]||0);
    const small=btn.querySelector('small');
    if(small) small.textContent=(showCounts&&left>0&&left<countCap)?left:'';
    btn.setAttribute('aria-label', t('a11yKey').replace('{v}',v)+
      ((showCounts&&left>0)? ', '+t('a11yLeft').replace('{n}',left) : ''));
    btn.classList.toggle('done', !isNum && left<=0);
    btn.classList.toggle('hl', v>0 && hlDigit===v);
    btn.classList.toggle('armed', v>0 && SES.settings.digitFirst && armed===v);
  });
  const np=$('numpad');
  const am=activeMode();
  if(np){ np.classList.toggle('mode-note', am==='note'); np.classList.toggle('mode-mid', am==='mid') }
  const bd=$('board');
  if(sel>=0) bd.setAttribute('aria-activedescendant','cell'+sel);
  else bd.removeAttribute('aria-activedescendant');
  placeSelBox(g,sp);
  $('gMistWrap').style.display=g.instant? '' : 'none';
  /* three marks instead of a fraction: before the first mistake the figure said
     nothing, and the dots fill up as the limit is spent */
  const limited=SES.settings.limit&&g.instant&&!g.noLimit;
  const mist=$('gMist');
  mist.classList.toggle('dots',limited);
  if(limited) mist.innerHTML=[0,1,2].map(k=>`<i${k<g.mistakes?' class="on"':''}></i>`).join('');
  else mist.textContent=g.mistakes;
  mist.setAttribute('aria-label',t('errorsL')+': '+g.mistakes+(limited? '/3' : ''));
  $('gMode').textContent=t('m_'+g.mode);
  const rn=LEVEL_RN[g.diff];
  $('gDiff').innerHTML=(rn? `<i class="rn">${rn}</i>` : '')+t('d_'+g.diff);
  const gtag=(I18N[SES.settings.lang]||{})['tag_'+g.mode] || I18N.en['tag_'+g.mode] || '';
  $('gameTag').textContent=gtag;
  $('gameTag').classList.toggle('hidden', !gtag);
  $('undoBtn').disabled=!undoStack.length;
  $('redoBtn').disabled=!redoStack.length;
}

function placeSelBox(g,sp){
  const sb=$('selBox'); if(!sb) return;
  /* tokkidoku seats a bunny on the tap itself, so a cell needs no ring around it */
  if(sel<0 || sp.kind==='tokki'){ sb.classList.add('hidden'); return }
  const c=sp.cells[sel];
  sb.style.left=(c.x/sp.W*100)+'%';
  sb.style.top=(c.y/sp.H*100)+'%';
  sb.style.width=(100/sp.W)+'%';
  sb.style.height=(100/sp.H)+'%';
  sb.className='';
  const wrong = g.values[sel] && !g.given[sel] && g.values[sel]!==g.solution[sel];
  if(g.instant && wrong) sb.classList.add('err');
  else if(activeMode()==='mid') sb.classList.add('mid');
  else if(activeMode()==='note') sb.classList.add('note');
}

const ZOOM_CELL=38;
let boardZoom=false, lockFit=0;

function otherHeight(){
  let used=0;
  /* with the pad beside the board these three stand aside and take no height */
  const side=isRail();
  const parts=[document.querySelector('header'), document.querySelector('.site-foot'), $('pickHint'),
    side? null : $('gameTag'),
    side? null : document.querySelector('.topbar'),
    side? null : document.querySelector('.controls'),
    side? null : $('numpad'),
    side? null : $('winPanel')];
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
function fitCell(){
  const b=$('board');
  if(!b||!SPEC) return 0;
  return fitBoth((parseFloat(getComputedStyle(b).borderLeftWidth)||0)*2);
}
function zoomUseful(){ return isPhone() && SPEC && fitCell()<ZOOM_CELL-2 }
function snapBoard(){
  syncRail();
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
    /* the magnifier works inside the board's own footprint: the window keeps the
       size the board had, so the pad and the plate around it stay put */
    pan.classList.add('pan');
    pan.style.width=box+'px';
    pan.style.maxHeight=(fit*SPEC.H+bw)+'px';
    b.style.width=(ZOOM_CELL*SPEC.W+bw)+'px';
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
