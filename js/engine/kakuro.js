'use strict';

function kakCells(w,h,mask){
  const sp=newSpec('kakuro');
  sp.kind='kakuro';
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(mask[y*w+x]) addCell(sp,x,y,9);
  sp.W=w; sp.H=h;
  return sp;
}
function kakRuns(sp,w,h,mask){
  const runs=[];
  const flush=(seg,dir)=>{ if(seg.length>=2) runs.push({dir,cells:seg.slice()}) };
  for(let y=0;y<h;y++){
    let seg=[];
    for(let x=0;x<=w;x++){
      if(x<w&&mask[y*w+x]) seg.push(cellAt(sp,x,y));
      else { flush(seg,'h'); seg=[] }
    }
  }
  for(let x=0;x<w;x++){
    let seg=[];
    for(let y=0;y<=h;y++){
      if(y<h&&mask[y*w+x]) seg.push(cellAt(sp,x,y));
      else { flush(seg,'v'); seg=[] }
    }
  }
  return runs;
}
function kakBuild(ex){
  const {w,h,mask,sums}=ex;
  const sp=kakCells(w,h,mask);
  const runs=kakRuns(sp,w,h,mask);
  runs.forEach((r,k)=>{ r.sum=sums[k] });
  sp.cages=runs.map(r=>({cells:r.cells.slice(), sum:r.sum}));
  const cl={};
  for(const r of runs){
    const first=sp.cells[r.cells[0]];
    const cx=r.dir==='h'? first.x-1 : first.x;
    const cy=r.dir==='h'? first.y : first.y-1;
    const k=cx+','+cy;
    cl[k]=cl[k]||{x:cx,y:cy,r:0,d:0};
    if(r.dir==='h') cl[k].r=r.sum; else cl[k].d=r.sum;
  }
  sp.clues=Object.keys(cl).map(k=>cl[k]);
  sp.blocks=[];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++)
    if(!mask[y*w+x] && !cl[x+','+y]) sp.blocks.push({x,y});
  prep(sp);
  sp.W=w; sp.H=h;
  return sp;
}

function kakSegments(mask,w,h){
  const segs=[];
  for(let y=1;y<h;y++){ let seg=[];
    for(let x=1;x<=w;x++){
      if(x<w&&mask[y*w+x]) seg.push(y*w+x);
      else { if(seg.length) segs.push({dir:'h',cells:seg}); seg=[] }
    } }
  for(let x=1;x<w;x++){ let seg=[];
    for(let y=1;y<=h;y++){
      if(y<h&&mask[y*w+x]) seg.push(y*w+x);
      else { if(seg.length) segs.push({dir:'v',cells:seg}); seg=[] }
    } }
  return segs;
}
function kakPattern(w,h,maxRun,extra){
  for(let attempt=0;attempt<40;attempt++){
    const mask=new Array(w*h).fill(0);
    for(let y=1;y<h;y++) for(let x=1;x<w;x++) mask[y*w+x]=1;
    let guard=0, ok=true;
    while(++guard<w*h*3){
      const segs=kakSegments(mask,w,h);
      const long=segs.filter(s=>s.cells.length>maxRun);
      const short=segs.filter(s=>s.cells.length===1);
      if(short.length){ mask[short[0].cells[0]]=0; continue }
      if(!long.length) break;
      const seg=long[RND(long.length)], L=seg.cells.length;
      const spots=[0,L-1];
      for(let i=2;i<=L-3;i++) spots.push(i);
      mask[seg.cells[spots[RND(spots.length)]]]=0;
    }

    const cand=[];
    for(let y=1;y<h;y++) for(let x=1;x<w;x++) if(mask[y*w+x]) cand.push(y*w+x);
    SHUF(cand);
    let added=0;
    for(const i of cand){
      if(added>=(extra||0)) break;
      mask[i]=0;
      const segs=kakSegments(mask,w,h);
      if(segs.some(s=>s.cells.length===1||s.cells.length>maxRun)) mask[i]=1; else added++;
    }
    const segs=kakSegments(mask,w,h);
    ok = segs.length>0 && segs.every(s=>s.cells.length>=2 && s.cells.length<=maxRun);
    let white=0; for(const m of mask) white+=m;
    if(ok && white>=Math.round((w-1)*(h-1)*0.5)) return mask;
  }
  return null;
}
const KAK_CFG={easy:{n:8,run:4,extra:3},medium:{n:9,run:5,extra:4},hard:{n:10,run:5,extra:5},expert:{n:11,run:6,extra:5}};
function kakMake(diff,deadline){
  const cfg=KAK_CFG[diff], stop=deadline||(Date.now()+9000);
  let best=null;
  for(let att=0;att<20&&Date.now()<stop;att++){
    const w=cfg.n, h=cfg.n;
    const mask=kakPattern(w,h,cfg.run,cfg.extra);
    if(!mask) continue;
    const tmp=kakCells(w,h,mask);
    const runs=kakRuns(tmp,w,h,mask);
    if(!runs.length) continue;
    for(const r of runs) for(let a=0;a<r.cells.length-1;a++) for(let b=a+1;b<r.cells.length;b++) tmp.neq.push([r.cells[a],r.cells[b]]);
    prep(tmp);
    const sol=fillSpec(tmp,8,200000);
    if(!sol) continue;
    const sums=runs.map(r=>r.cells.reduce((s,i)=>s+sol[i],0));
    const ex={w,h,mask,sums};
    const sp=kakBuild(ex);
    const puz=new Array(sp.cells.length).fill(0);

    let uniq=false;
    for(let guard=0;guard<24;guard++){
      const sols=solveList(sp,puz,2,400000);
      if(sols.length<2){ uniq=sols.length===1; break }
      const spots=[];
      for(let k=0;k<puz.length;k++) if(!puz[k] && sols[0][k]!==sols[1][k]) spots.push(k);
      if(!spots.length) break;
      const pick=spots[RND(spots.length)];
      puz[pick]=sol[pick];
    }
    if(!uniq) continue;
    const g=gradeSolve(sp,puz);
    const res={mode:'kakuro',diff,ex,sp,sol,puz,grade:g.solved?g.grade:5};
    const hi=BAND[diff][1];
    if(g.solved && g.grade<=hi) return res;
    if(!best) best=res;
  }
  return best;
}
