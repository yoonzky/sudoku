/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
'use strict';

let SP=null;
const CELLS=[];
const cellKey=[];
let CS=40, BR=12;

/* six faces, one per member; every head shares the lower half */
const FACE_MUZZLE='<path d="M12 10.8v5.8"/><path d="M8 16.6a2 2 0 0 0 4 0"/><path d="M12 16.6a2 2 0 0 0 4 0"/>';
const FACE_WHISKERS='<path d="M3.6 15.4H.8M4.4 17.2H1.6M5.8 19H3"/><path d="M20.4 15.4h2.8M19.6 17.2h2.8M18.2 19h2.8"/>';
const FACE_L={N:'<path d="M6.4 14.4V11l3 3.4V11"/>', M:'<path d="M6.4 14.4V11l1.5 2 1.5-2v3.4"/>',
  H:'<path d="M6.4 11v3.4M9.4 11v3.4M6.4 12.7h3"/>', D:'<path d="M6.4 14.4V11h1.2a1.7 1.7 0 0 1 0 3.4H6.4"/>'};
const FACE_R={Z:'<path d="M14.6 11h3l-3 3.4h3"/>', J:'<path d="M17.6 11v2.2a1.4 1.4 0 0 1-2.8 0"/>', N:'<path d="M14.6 14.4V11l3 3.4V11"/>',
  R:'<path d="M14.6 14.4V11h1.4a1.1 1.1 0 0 1 0 2.2h-1.4l2.4 1.2"/>', I:'<path d="M14.8 11h2.8M16.2 11v3.4M14.8 14.4h2.8"/>'};
const FACE_HEADS=[
  ['N','Z',1,'<path d="M3.4 12.6C3.4 9.6 3.4 7.6 3.6 6a3.2 3.2 0 0 1 6.4 0c.2 2.2.8 4.6 2 4.6s1.8-2.4 2-4.6a3.2 3.2 0 0 1 6.4 0c.2 1.6.2 3.6.2 6.6a8.6 9 0 0 1-17.2 0Z"/>'],
  ['M','J',0,'<path d="M3.4 12.6c0-1.8.3-3.3.9-4.5a2.5 2.5 0 1 1 3.9-2.6 10.4 10.4 0 0 1 7.6 0 2.5 2.5 0 1 1 3.9 2.6c.6 1.2.9 2.7.9 4.5a8.6 9 0 0 1-17.2 0Z"/>'],
  ['H','N',1,'<path d="M3.2 12.6c0-2 .3-3.6.9-4.8a2 2 0 1 1 2.9-2.4 11.5 11.5 0 0 1 10 0 2 2 0 1 1 2.9 2.4c.6 1.2.9 2.8.9 4.8a8.8 9 0 0 1-17.6 0Z"/>'],
  ['H','R',1,'<path d="M3.4 12.6C3.4 10 3.6 8 4.2 6.6L4.6 2.9 8.6 5.4a10 10 0 0 1 6.8 0l4-2.5.4 3.7c.6 1.4.8 3.4.8 6a8.6 9 0 0 1-17.2 0Z"/>'],
  ['H','I',1,'<path d="M3.2 12.6c0-1.2.1-2.3.3-3.2a3.8 3.8 0 1 1 5-5 10 10 0 0 1 7 0 3.8 3.8 0 1 1 5 5c.2.9.3 2 .3 3.2a8.8 9 0 0 1-17.6 0Z"/>'],
  ['D','N',0,'<path d="M3.6 12.6C3.6 11.4 3.7 10.4 3.9 9.5 2.6 10.2 1.6 11.2 2 11.8c.6.8 2.4-2.8 4.2-6a10 10 0 0 1 11.6 0c1.8 3.2 3.6 6.8 4.2 6 .4-.6-.6-1.6-1.9-2.3.2.9.3 1.9.3 3.1a8.4 9 0 0 1-16.8 0Z"/>']];
const FACES=FACE_HEADS.map((f,k)=>`<svg class="face f${k}" viewBox="0 0 24 24" aria-hidden="true">${f[3]}${FACE_L[f[0]]}${FACE_R[f[1]]}${FACE_MUZZLE}${f[2]?FACE_WHISKERS:''}</svg>`);
/* four leaves and a stem: the gaps are what make it a clover */
const CLOVER='<svg class="clover" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.6 12.4c1.2 2.6 1.3 5.4.4 8.2l-1.9-.5c.8-2.5.7-4.9-.4-7.1Z"/>'+
  [225,315,45,135].map(a=>`<ellipse cx="12" cy="7.2" rx="3.7" ry="4.6" transform="rotate(${a} 12 12)"/>`).join('')+'</svg>';

const fullBoard=sp=>sp.cells.length+(sp.blocks||[]).length+(sp.clues||[]).length===sp.W*sp.H;

function buildBoard(sp){
  SP=sp;
  const b=$('board');
  b.innerHTML='<svg class="under" preserveAspectRatio="none"></svg><div class="cells"></div><svg class="over" preserveAspectRatio="none"></svg><div class="selbox hidden" id="selbox"></div>';
  b.style.setProperty('--w',sp.W); b.style.setProperty('--h',sp.H);
  const nc=sp.maxD<=9? 3 : 4;
  b.style.setProperty('--nc',nc); b.style.setProperty('--nr',Math.ceil(Math.min(sp.maxD,12)/nc));
  b.classList.toggle('full',fullBoard(sp));
  b.setAttribute('role','grid');
  b.setAttribute('tabindex','0');
  b.setAttribute('aria-label',t('a11yBoard'));
  const box=b.querySelector('.cells');
  CELLS.length=0; cellKey.length=0;
  const anchors=new Set(sp.kind==='kakuro'? [] : sp.cages.map(c=>c.anchor!=null? c.anchor : c.cells[0]));
  /* rows for screen readers only: display contents keeps the grid flat */
  const rows=[];
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i], d=document.createElement('div');
    d.className='c'+(anchors.has(i)?' anc':'');
    d.setAttribute('role','gridcell');
    d.style.gridColumn=c.x+1; d.style.gridRow=c.y+1;
    d.id='c'+i;
    if(!rows[c.y]){ rows[c.y]=document.createElement('div'); rows[c.y].className='row'; rows[c.y].setAttribute('role','row') }
    rows[c.y].appendChild(d); CELLS.push(d);
  }
  for(const r of rows) if(r) box.appendChild(r);
}

/* rule widths in px, redrawn on resize */
function drawLayers(){
  const sp=SP, b=$('board'), W=sp.W, H=sp.H, u=1/CS;
  const full=fullBoard(sp);
  const thin=u, thick=(CS>=34? 1.8 : 1.4)*u;
  b.style.setProperty('--kw',(thick*CS)+'px');
  let under='';
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const fill = sp.kind==='tokki'? `var(--z${(sp.region[i]%10)+1})` : sp.zone[i]? 'var(--zone)' : 'var(--surface)';
    under+=`<rect x="${c.x}" y="${c.y}" width="1.01" height="1.01" fill="${fill}"/>`;
  }
  for(const k of sp.blocks||[]) under+=`<rect x="${k.x}" y="${k.y}" width="1.01" height="1.01" fill="var(--kk-block)"/>`;
  for(const k of sp.clues||[]) under+=`<rect x="${k.x}" y="${k.y}" width="1.01" height="1.01" fill="var(--kk)"/>`;
  const us=b.querySelector('.under'), os=b.querySelector('.over');
  us.setAttribute('viewBox',`0 0 ${W} ${H}`); us.innerHTML=under;

  let tn='', tk='';
  if(sp.kind==='kakuro'){
    for(let x=1;x<W;x++) tn+=`M${x} 0V${H}`;
    for(let y=1;y<H;y++) tn+=`M0 ${y}H${W}`;
  } else for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i], x=c.x, y=c.y;
    const rt=cellAt(sp,x+1,y), dn=cellAt(sp,x,y+1);
    if(rt>=0){ if(sp.region[rt]!==sp.region[i]) tk+=`M${x+1} ${y}v1`; else tn+=`M${x+1} ${y}v1` }
    if(dn>=0){ if(sp.region[dn]!==sp.region[i]) tk+=`M${x} ${y+1}h1`; else tn+=`M${x} ${y+1}h1` }
  }
  let over=`<path d="${tn}" stroke="var(--cell-line)" stroke-width="${thin}" fill="none"/>`+
    `<path d="${tk}" stroke="var(--rule)" stroke-width="${thick}" fill="none" stroke-linecap="square"/>`;
  /* linked boards: rounded contour clips the board, its inner half is the rule */
  b.style.clipPath= full? '' : `path('${outlinePath(sp,BR/CS,CS)}')`;
  if(!full) over+=`<path d="${outlinePath(sp,BR/CS)}" stroke="var(--rule)" stroke-width="${2*thick}" fill="none"/>`;
  if(sp.kind==='kakuro'){
    for(const k of sp.clues||[]){
      over+=`<path d="M${k.x} ${k.y}l1 1" stroke="var(--rule)" stroke-width="${thin}"/>`;
      /* baseline from the digit height: engines place a central baseline differently */
      if(k.r) over+=`<text x="${k.x+.7}" y="${k.y+.432}" font-size=".29" font-weight="600" fill="var(--text-2)" text-anchor="middle">${k.r}</text>`;
      if(k.d) over+=`<text x="${k.x+.3}" y="${k.y+.792}" font-size=".29" font-weight="600" fill="var(--text-2)" text-anchor="middle">${k.d}</text>`;
    }
  } else if(sp.cages.length){
    const segs=[], d=.085;
    let sums='';
    for(const cg of sp.cages){
      const inC=(x,y)=>{ const j=cellAt(sp,x,y); return j>=0 && cg.cells.includes(j) };
      for(const i of cg.cells){
        const c=sp.cells[i], x=c.x, y=c.y;
        const up=inC(x,y-1), dn=inC(x,y+1), lf=inC(x-1,y), rt=inC(x+1,y);
        const x0=lf? x : x+d, x1=rt? x+1 : x+1-d, y0=up? y : y+d, y1=dn? y+1 : y+1-d;
        if(!up) segs.push([x0,y+d,x1,y+d]);
        if(!dn) segs.push([x0,y+1-d,x1,y+1-d]);
        if(!lf) segs.push([x+d,y0,x+d,y1]);
        if(!rt) segs.push([x+1-d,y0,x+1-d,y1]);
      }
      const a=sp.cells[cg.anchor!=null? cg.anchor : cg.cells[0]];
      sums+=`<text x="${a.x+.14}" y="${a.y+.29}" font-size=".19">${cg.sum}</text>`;
    }
    over+=`<path d="${dashLine(segs,.08,.07)}" stroke="var(--cage)" stroke-width="${u}" fill="none"/>`;
    over+=`<g font-weight="600" fill="var(--text-2)" font-family="var(--font)">${sums}</g>`;
  }
  for(const dt of sp.dots){
    const a=sp.cells[dt.a], c=sp.cells[dt.b];
    const black=dt.k===2;
    over+=`<circle cx="${(a.x+c.x+1)/2}" cy="${(a.y+c.y+1)/2}" r=".1" fill="${black?'var(--dot)':'var(--surface)'}" stroke="var(--dot)" stroke-width="${1.2*u}"/>`;
  }
  os.setAttribute('viewBox',`0 0 ${W} ${H}`); os.innerHTML=over;
}
/* dash step fitted to each edge so corners meet */
function dashLine(segs,dash,gap){
  let d='';
  for(const s of segs){
    const dx=s[2]-s[0], dy=s[3]-s[1], len=Math.hypot(dx,dy);
    if(!len) continue;
    const n=Math.max(1,Math.round((len+gap)/(dash+gap))), step=(len+gap)/n, run=step-gap, ux=dx/len, uy=dy/len;
    for(let k=0;k<n;k++){
      const a=k*step, e=a+run;
      d+=`M${(s[0]+ux*a).toFixed(3)} ${(s[1]+uy*a).toFixed(3)}L${(s[0]+ux*e).toFixed(3)} ${(s[1]+uy*e).toFixed(3)}`;
    }
  }
  return d;
}

/* cell size from the free room */
function fitBoard(){
  if(!SP) return;
  const col=document.body.classList.contains('col');
  let aw, ah;
  if(col){
    const w=$('bwrap'); aw=w.clientWidth-16; ah=w.clientHeight-16;
  } else {
    const short=innerHeight<=560;
    aw=innerWidth-(short?300+24+48:324+40+64); ah=innerHeight-(short?58+10:80+28);
  }
  const fit=Math.max(10,Math.min(Math.floor(Math.min(aw/SP.W,ah/SP.H)),SP.W<=8? 84 : 74));
  /* too fine for a finger: magnified, with a minimap */
  const big=col && fit<ZOOM_MIN, zoom=big && zoomOn, w=$('bwrap'), was=w.classList.contains('zoom');
  w.classList.toggle('zoom',zoom);
  $('zoomBtn').classList.toggle('hidden',!big);
  $('zoomBtn').innerHTML=ic(zoom?'zoomOut':'zoomIn');
  if(big) $('zoomBtn').style.bottom=($('pad').offsetHeight+12)+'px';
  const cs=zoom? ZOOM_CS : fit;
  CS=cs;
  BR=Math.round(Math.min(18,Math.max(8,cs*.26)));
  const b=$('board');
  b.style.setProperty('--cs',cs+'px');
  b.style.setProperty('--br',BR+'px');
  $('bwrap').style.setProperty('--br',fullBoard(SP)? BR+'px' : '0px');
  drawLayers();
  paint();
  if(zoom&&!was){ w.scrollLeft=(w.scrollWidth-w.clientWidth)/2; w.scrollTop=(w.scrollHeight-w.clientHeight)/2 }
  buildMini(zoom);
}
const ZOOM_MIN=25, ZOOM_CS=36;
let zoomOn=true;
function buildMini(on){
  const m=$('mini');
  m.classList.toggle('hidden',!on);
  if(!on) return;
  const boxes=(SP.frames&&SP.frames.length)? SP.frames : [{x:0,y:0,w:SP.W,h:SP.H}];
  m.innerHTML=`<svg viewBox="-.5 -.5 ${SP.W+1} ${SP.H+1}">${boxes.map(f=>`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx=".6"/>`).join('')}<rect class="view" rx=".8"/></svg>`;
  m.style.width='88px'; m.style.height=Math.round(88*(SP.H+1)/(SP.W+1))+'px';
  m.style.bottom=($('pad').offsetHeight+12)+'px';
  syncMini();
}
function syncMini(){
  const m=$('mini'), w=$('bwrap');
  if(m.classList.contains('hidden')) return;
  const v=m.querySelector('.view'), pad=12;
  v.setAttribute('x',(w.scrollLeft-pad)/CS); v.setAttribute('y',(w.scrollTop-pad)/CS);
  v.setAttribute('width',w.clientWidth/CS); v.setAttribute('height',w.clientHeight/CS);
}
function revealCell(i){
  const w=$('bwrap'); if(!w.classList.contains('zoom')||i<0) return;
  const c=SP.cells[i], x=c.x*CS+12, y=c.y*CS+12;
  if(x<w.scrollLeft+CS) w.scrollLeft=x-CS; else if(x+CS>w.scrollLeft+w.clientWidth-CS) w.scrollLeft=x+2*CS-w.clientWidth;
  if(y<w.scrollTop+CS) w.scrollTop=y-CS; else if(y+CS>w.scrollTop+w.clientHeight-CS) w.scrollTop=y+2*CS-w.clientHeight;
}

const MID_ROW=5;
function midHTML(mid){
  const sep=SP.maxD>9? ' ' : '';
  const one=mid.join(sep);
  if(one.length<=MID_ROW) return {h:one, tight:one.length>3};
  const half=Math.ceil(mid.length/2);
  return {h:`<b>${mid.slice(0,half).join(sep)}</b><b>${mid.slice(half).join(sep)}</b>`, tight:true};
}

function paint(){
  const g=G; if(!g||!SP) return;
  const sp=SP, n=sp.cells.length, num=sp.kind==='num', tok=sp.kind==='tokki';
  const st=SES.settings, multi=U.msel.size>1;
  const selV=U.sel>=0? g.val[U.sel] : 0;
  const act=(st.same&&!num&&!tok)? (selV||U.hl) : 0;
  const peers=(U.sel>=0&&st.peers&&!tok&&!multi)? new Set(sp.peers[U.sel]) : null;
  for(let i=0;i<n;i++){
    const d=CELLS[i], v=g.val[i], cn=g.notes[i], md=g.mid[i];
    let key;
    if(tok) key='t'+v;
    else if(v) key='v'+v;
    else if(cn.length||md.length) key='n'+cn.join(',')+'/'+md.join(',')+'|'+act;
    else key='';
    if(cellKey[i]!==key){
      let h='';
      if(tok) h = v===TOKKI_BUN? FACES[faceOf(g,i)] : v===TOKKI_MARK? CLOVER : '';
      else if(v) h=`<span class="v${v>9?' d2':''}">${v}</span>`;
      else if(num&&cn.length) h='<div class="nt wide">'+cn.slice(0,6).map(x=>`<span>${x}</span>`).join('')+'</div>';
      else {
        if(cn.length){
          h+='<div class="nt">';
          for(let k=1;k<=sp.maxD;k++) h+=`<span${act===k?' class="hl"':''}>${cn.includes(k)?k:''}</span>`;
          h+='</div>';
        }
        if(md.length){ const m=midHTML(md); h+=`<span class="md${m.tight?' tight':''}${md.includes(act)?' hl':''}">${m.h}</span>` }
      }
      d.innerHTML=h;
      d.setAttribute('aria-label',cellLabel(g,i));
      cellKey[i]=key;
    }
    let cls='c'+(d.classList.contains('anc')?' anc':'');
    if(g.given[i]) cls+=' g';
    const wrong = tok? (v===TOKKI_BUN && g.instant && (g.sol[i]!==TOKKI_BUN || tokkiClash(g,i)))
      : (v && !g.given[i] && g.instant && v!==g.sol[i]) || (!g.instant && g.endErr.includes(i));
    if(wrong) cls+=' err';
    else if(multi && U.msel.has(i)) cls+=' ms';
    else if(i!==U.sel && act && (v===act || (!v && (cn.includes(act)||md.includes(act))))) cls+=' sm';
    else if(peers && peers.has(i)) cls+=' pe';
    if(d.classList.contains('pop')) cls+=' pop';
    if(d.className!==cls) d.className=cls;
  }
  const bd=$('board');
  if(U.sel>=0) bd.setAttribute('aria-activedescendant','c'+U.sel); else bd.removeAttribute('aria-activedescendant');
  placeSel();
  paintPad();
}
function cellLabel(g,i){
  const c=SP.cells[i], v=g.val[i];
  const pos=tf('a11yCell',{r:c.y+1,c:c.x+1});
  if(SP.kind==='tokki') return pos+', '+t(v===TOKKI_BUN?'a11yBun':v===TOKKI_MARK?'a11yClover':'a11yEmpty');
  if(v) return pos+', '+v+(g.given[i]? ', '+t('a11yGiven') : '');
  const marks=g.notes[i].concat(g.mid[i]);
  return pos+', '+(marks.length? tf('a11yNote',{v:marks.join(' ')}) : t('a11yEmpty'));
}
function tokkiClash(g,i){
  for(const j of SP.peers[i]) if(g.val[j]===TOKKI_BUN) return true;
  return false;
}
/* faces come from a bag: each member is seated once before any repeats */
function faceOf(g,i){
  if(!g.face) g.face={};
  if(g.face[i]==null){
    if(!g.bag||!g.bag.length){ g.bag=[0,1,2,3,4,5]; for(let k=5;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [g.bag[k],g.bag[j]]=[g.bag[j],g.bag[k]] } }
    g.face[i]=g.bag.pop();
  }
  return g.face[i]%FACES.length;
}

/* fill of the picked cell under the digits; the board clips it at the corners */
function placeSel(){
  const sb=$('selbox'); if(!sb) return;
  const g=G;
  if(U.sel<0||U.msel.size>1||SP.kind==='tokki'||!g||g.done){ sb.classList.add('hidden'); return }
  const c=SP.cells[U.sel];
  sb.style.left=(c.x*CS)+'px'; sb.style.top=(c.y*CS)+'px';
  sb.style.width=CS+'px'; sb.style.height=CS+'px';
  const wrong=g.val[U.sel] && !g.given[U.sel] && g.instant && g.val[U.sel]!==g.sol[U.sel];
  sb.className='selbox'+(wrong?' err':'');
}
