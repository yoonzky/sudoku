'use strict';

const PREV_CACHE={};

/* previews run off a fixed seed, or suguru, kakuro and bunnydoku draw a new
   thumbnail on every load */
function seeded(seed){
  let a=seed>>>0;
  return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296 };
}
function previewSpec(mode){
  const prev=RNG;
  let h=2166136261;
  for(let i=0;i<mode.length;i++){ h^=mode.charCodeAt(i); h=Math.imul(h,16777619) }
  RNG=seeded(h);
  try{ return previewSpecRaw(mode) } finally { RNG=prev }
}
function previewSpecRaw(mode){
  if(mode==='meow'){
    const n=8, cols=meowCats(n);
    const reg=cols&&meowRegions(n,cols);
    if(!reg) return buildSpec('classic',{});
    const sp=meowBuild({n,reg});
    sp.demoCats=cols.map((c,r)=>r*n+c);
    return sp;
  }
  if(mode==='numerator') return numBuild({w:9,h:9});
  if(mode==='suguru') return MODES.suguru.build({regions:suguruRegions(9,9,4,6),w:9,h:9});
  if(mode==='kakuro'){
    const w=8,h=8;
    let mask=null;
    for(let k=0;k<8&&!mask;k++) mask=kakPattern(w,h,4,3);
    if(!mask) return buildSpec('classic',{});
    const tmp=kakCells(w,h,mask), runs=kakRuns(tmp,w,h,mask);
    return kakBuild({w,h,mask,sums:runs.map(()=>0)});
  }
  return MODES[mode].build({});
}
const DEC={
  killer:[[0,0,2,1],[2,0,1,2],[3,1,2,1],[5,0,1,2],[6,2,2,1],[0,2,1,2],[4,4,2,2],[7,5,1,2],[2,6,2,1],[5,7,2,1],[0,5,1,2],[3,3,1,2]],
  dots:[[1,0,1,0],[4,1,0,1],[6,2,1,0],[2,3,0,1],[7,4,1,0],[0,5,0,1],[3,6,1,0],[5,7,1,0],[8,1,0,1],[2,2,1,0]],
  evenodd:[0,4,6,10,13,17,20,22,26,30,33,37,40,44,47,51,54,58,60,64,68,71,75,78],
  numerator:[36,37,38,29,20,21,22,13,4,5,6,15,24,33,42,51,60,61,62],
};
function previewSVG(mode){
  if(PREV_CACHE[mode]) return PREV_CACHE[mode];
  const sp=previewSpec(mode);
  const W=sp.W, H=sp.H, u=10, pad=2;
  const px=c=>pad+c.x*u, py=c=>pad+c.y*u;
  const vw=W*u+pad*2, vh=H*u+pad*2;
  let out=`<svg viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;

  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const fill = sp.kind==='meow'? `var(--z${(sp.region[i]%10)+1})`
      : sp.zone[i]===2? 'var(--accent2-soft)' : sp.zone[i]===1? 'var(--accent-soft)' : 'var(--panel2)';
    out+=`<rect x="${px(c)}" y="${py(c)}" width="${u}" height="${u}" fill="${fill}"/>`;
  }
  if(mode==='meow') for(const i of (sp.demoCats||[]).filter((_,k)=>k%3===0)){
    const c=sp.cells[i];
    out+=`<circle cx="${px(c)+u/2}" cy="${py(c)+u/2}" r="${u*0.26}" fill="var(--cat)"/>`;
  }
  if(mode==='evenodd') for(const i of DEC.evenodd){
    const c=sp.cells[i]; if(!c) continue;
    out+=`<rect x="${px(c)}" y="${py(c)}" width="${u}" height="${u}" fill="var(--accent2-soft)"/>`;
  }

  for(const b of (sp.blocks||[])) out+=`<rect x="${pad+b.x*u}" y="${pad+b.y*u}" width="${u}" height="${u}" fill="var(--cell-same)"/>`;
  for(const c of (sp.clues||[])){
    out+=`<rect x="${pad+c.x*u}" y="${pad+c.y*u}" width="${u}" height="${u}" fill="var(--cell-same)"/>`;
    out+=`<line x1="${pad+c.x*u}" y1="${pad+c.y*u}" x2="${pad+(c.x+1)*u}" y2="${pad+(c.y+1)*u}" stroke="var(--frame)" stroke-width=".7"/>`;
  }

  let thin='', thick='';
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const up=cellAt(sp,c.x,c.y-1), lf=cellAt(sp,c.x-1,c.y);
    const dn=cellAt(sp,c.x,c.y+1), rt=cellAt(sp,c.x+1,c.y);
    const seg=(x1,y1,x2,y2,strong)=>{
      const l=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      if(strong) thick+=l; else thin+=l };
    const X=px(c), Y=py(c);
    if(up<0||sp.region[up]!==sp.region[i]) seg(X,Y,X+u,Y,true); else seg(X,Y,X+u,Y,false);
    if(lf<0||sp.region[lf]!==sp.region[i]) seg(X,Y,X,Y+u,true); else seg(X,Y,X,Y+u,false);
    if(dn<0) seg(X,Y+u,X+u,Y+u,true);
    if(rt<0) seg(X+u,Y,X+u,Y+u,true);
  }
  const wThin = W<=10? .8 : 1.5, wThick = W<=10? 1.8 : 2.8;
  out+=`<g stroke="var(--line)" stroke-width="${wThin}">${thin}</g>`;
  out+=`<g stroke="var(--rule)" stroke-width="${wThick}">${thick}</g>`;
  let zone='';
  const inZone=(x,y)=>{ const j=cellAt(sp,x,y); return j>=0 && sp.zone[j]===1 };
  const zi=u*0.1;
  for(let i=0;i<sp.cells.length;i++){
    if(sp.zone[i]!==1) continue;
    const c=sp.cells[i], X=px(c), Y=py(c);
    const up=inZone(c.x,c.y-1), dn=inZone(c.x,c.y+1), lf=inZone(c.x-1,c.y), rt=inZone(c.x+1,c.y);
    const x0=lf? X : X+zi, x1=rt? X+u : X+u-zi;
    const y0=up? Y : Y+zi, y1=dn? Y+u : Y+u-zi;
    if(!up) zone+=`<line x1="${x0}" y1="${Y+zi}" x2="${x1}" y2="${Y+zi}"/>`;
    if(!dn) zone+=`<line x1="${x0}" y1="${Y+u-zi}" x2="${x1}" y2="${Y+u-zi}"/>`;
    if(!lf) zone+=`<line x1="${X+zi}" y1="${y0}" x2="${X+zi}" y2="${y1}"/>`;
    if(!rt) zone+=`<line x1="${X+u-zi}" y1="${y0}" x2="${X+u-zi}" y2="${y1}"/>`;
  }
  if(zone) out+=`<g stroke="var(--zone-edge)" stroke-width="${wThin*1.2}">${zone}</g>`;

  if(mode==='killer'){
    for(const r of DEC.killer){
      const x=pad+r[0]*u+1.6, y=pad+r[1]*u+1.6, w=r[2]*u-3.2, h=r[3]*u-3.2;
      out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="none"
        stroke="var(--accent)" stroke-width=".7" stroke-dasharray="2 1.6" opacity=".85"/>`;
    }
  }
  if(mode==='dots'){
    for(const d of DEC.dots){
      const cx=pad+(d[0]+ (d[2]?1:.5))*u, cy=pad+(d[1]+(d[3]?1:.5))*u;
      const black=(d[0]+d[1])%3===0;
      out+=`<circle cx="${cx}" cy="${cy}" r="1.9" fill="${black?'var(--text)':'var(--panel2)'}"
        stroke="var(--text)" stroke-width=".6"/>`;
    }
  }
  if(mode==='numerator'){
    const pts=DEC.numerator.map(i=>{ const c=sp.cells[i]; return (px(c)+u/2)+' '+(py(c)+u/2) });
    out+=`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6"
      stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;
  }
  out+='</svg>';
  PREV_CACHE[mode]=out;
  return out;
}
