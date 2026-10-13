'use strict';

/* fixed seed: suguru, kakuro and tokkidoku keep their picture */
function seeded(seed){
  let a=seed>>>0;
  return ()=>{ a=(a+0x6D2B79F5)>>>0; let r=Math.imul(a^(a>>>15),1|a);
    r=(r+Math.imul(r^(r>>>7),61|r))^r; return ((r^(r>>>14))>>>0)/4294967296 };
}
function artSpec(mode){
  const prev=RNG;
  let h=2166136261;
  for(let i=0;i<mode.length;i++){ h^=mode.charCodeAt(i); h=Math.imul(h,16777619) }
  RNG=seeded(h);
  try{
    if(mode==='tokki'){
      const n=8, cols=tokkiSeating(n), reg=cols&&tokkiRegions(n,cols);
      if(!reg) return buildSpec('classic',{});
      const sp=tokkiBuild({n,reg});
      sp.seats=cols.map((c,r)=>r*n+c);
      return sp;
    }
    if(mode==='numerator') return numBuild({w:9,h:9});
    if(mode==='suguru') return prep(MODES.suguru.build({regions:suguruRegions(9,9,4,6),w:9,h:9}));
    if(mode==='kakuro'){
      let mask=null;
      for(let k=0;k<8&&!mask;k++) mask=kakPattern(8,8,4,3);
      if(!mask) return buildSpec('classic',{});
      const tmp=kakCells(8,8,mask), runs=kakRuns(tmp,8,8,mask);
      return kakBuild({w:8,h:8,mask,sums:runs.map(()=>0)});
    }
    return buildSpec(mode,{});
  } finally { RNG=prev }
}
/* decoration for modes whose marks come from a solution */
const DEC={
  killer:[[0,0,2,1],[2,0,1,2],[3,1,2,1],[5,0,1,2],[6,2,2,1],[0,2,1,2],[4,4,2,2],[7,5,1,2],[2,6,2,1],[5,7,2,1],[0,5,1,2],[3,3,1,2]],
  dots:[[1,0,1,0],[4,1,0,1],[6,2,1,0],[2,3,0,1],[7,4,1,0],[0,5,0,1],[3,6,1,0],[5,7,1,0],[8,1,0,1],[2,2,1,0]],
  evenodd:[0,4,6,10,13,17,20,22,26,30,33,37,40,44,47,51,54,58,60,64,68,71,75,78],
  numerator:[36,37,38,29,20,21,22,13,4,5,6,15,24,33,42,51,60,61,62],
};
const ART_CACHE={};
const isFull=sp=>sp.cells.length+(sp.blocks||[]).length+(sp.clues||[]).length===sp.W*sp.H;

/* board picture: rules, fills, optional values */
function boardPic(sp,px,o={}){
  const W=sp.W, H=sp.H, s=px/Math.max(W,H), full=isFull(sp);
  const thinW=(o.thin||.7)/s, thickW=(o.thick||1.3)/s;
  const R=full? (o.r||px*.06)/s : 0;
  const id='p'+Math.random().toString(36).slice(2,8);
  let out=`<svg viewBox="0 0 ${W} ${H}" width="${(W*s).toFixed(1)}" height="${(H*s).toFixed(1)}" aria-hidden="true">`;
  if(full) out+=`<defs><clipPath id="${id}"><rect width="${W}" height="${H}" rx="${R}"/></clipPath></defs><g clip-path="url(#${id})">`;
  else out+='<g>';
  const even=new Set(o.evenDemo? DEC.evenodd : []);
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const fill = sp.kind==='tokki'? `var(--z${(sp.region[i]%10)+1})` : (sp.zone[i]||even.has(i))? 'var(--zone)' : 'var(--surface)';
    out+=`<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${fill}"/>`;
  }
  for(const b of sp.blocks||[]) out+=`<rect x="${b.x}" y="${b.y}" width="1" height="1" fill="var(--kk-block)"/>`;
  for(const c of sp.clues||[]) out+=`<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="var(--kk)"/><path d="M${c.x} ${c.y}l1 1" stroke="var(--rule)" stroke-width="${thinW}"/>`;
  let thin='', thick='';
  const kak=sp.kind==='kakuro'||(sp.blocks&&sp.blocks.length);
  if(kak){
    for(let x=1;x<W;x++) thin+=`M${x} 0V${H}`;
    for(let y=1;y<H;y++) thin+=`M0 ${y}H${W}`;
  } else for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const rt=cellAt(sp,c.x+1,c.y), dn=cellAt(sp,c.x,c.y+1), up=cellAt(sp,c.x,c.y-1), lf=cellAt(sp,c.x-1,c.y);
    if(rt>=0){ const l=`M${c.x+1} ${c.y}v1`; if(sp.region[rt]!==sp.region[i]) thick+=l; else thin+=l }
    if(dn>=0){ const l=`M${c.x} ${c.y+1}h1`; if(sp.region[dn]!==sp.region[i]) thick+=l; else thin+=l }
    if(!full){
      if(up<0) thick+=`M${c.x} ${c.y}h1`;
      if(dn<0) thick+=`M${c.x} ${c.y+1}h1`;
      if(lf<0) thick+=`M${c.x} ${c.y}v1`;
      if(rt<0) thick+=`M${c.x+1} ${c.y}v1`;
    }
  }
  out+=`<path d="${thin}" stroke="var(--cell-line)" stroke-width="${thinW}" fill="none"/>`;
  out+=`<path d="${thick}" stroke="var(--rule)" stroke-width="${thickW}" fill="none" stroke-linecap="square"/>`;
  if(o.cages) for(const r of o.cages){
    const a=.14;
    out+=`<rect x="${r[0]+a}" y="${r[1]+a}" width="${r[2]-2*a}" height="${r[3]-2*a}" rx=".12" fill="none" stroke="var(--cage)" stroke-width="${thinW*1.1}" stroke-dasharray="${.16} ${.12}"/>`;
  }
  if(o.dots) for(const d of o.dots){
    const cx=d[0]+(d[2]?1:.5), cy=d[1]+(d[3]?1:.5), black=(d[0]+d[1])%3===0;
    out+=`<circle cx="${cx}" cy="${cy}" r=".2" fill="${black?'var(--dot)':'var(--surface)'}" stroke="var(--dot)" stroke-width="${thinW*1.2}"/>`;
  }
  if(o.path){
    const pts=o.path.map(i=>{ const c=sp.cells[i]; return (c.x+.5)+' '+(c.y+.5) });
    out+=`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="${2/s}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if(o.seats) for(const i of o.seats){ const c=sp.cells[i]; out+=`<circle cx="${c.x+.5}" cy="${c.y+.5}" r=".24" fill="var(--accent)"/>` }
  if(o.vals){
    const g=o.vals;
    for(let i=0;i<sp.cells.length;i++){
      const v=g.val[i]; if(!v) continue;
      const c=sp.cells[i];
      if(sp.kind==='tokki'){
        if(v===TOKKI_BUN) out+=`<circle cx="${c.x+.5}" cy="${c.y+.5}" r=".26" fill="var(--accent)"/>`;
        continue;
      }
      const fs=v>9? .46 : .62;
      out+=`<text x="${c.x+.5}" y="${c.y+.53}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" font-family="var(--font-disp)" font-weight="480" fill="${g.given[i]?'var(--text)':'var(--accent)'}">${v}</text>`;
    }
  }
  out+='</g>';
  if(full) out+=`<rect x="${thickW/2}" y="${thickW/2}" width="${W-thickW}" height="${H-thickW}" rx="${Math.max(0,R-thickW/2)}" fill="none" stroke="var(--rule)" stroke-width="${thickW}"/>`;
  return out+'</svg>';
}
function modeArt(mode,px){
  const key=mode+':'+px;
  if(ART_CACHE[key]) return ART_CACHE[key];
  const sp=artSpec(mode), big=px>150;
  const o={thin:big?1:.7, thick:big?1.8:1.3, r:big?14:6};
  if(mode==='killer') o.cages=DEC.killer;
  if(mode==='dots') o.dots=DEC.dots;
  if(mode==='evenodd') o.evenDemo=true;
  if(mode==='numerator') o.path=DEC.numerator;
  if(mode==='tokki') o.seats=(sp.seats||[]).filter((_,k)=>k%3===0);
  return ART_CACHE[key]=boardPic(sp,px,o);
}
function gamePic(g,px){
  const sp=buildSpec(g.mode,g.ex);
  return boardPic(sp,px,{thin:.6,thick:1.1,r:7,vals:g});
}
