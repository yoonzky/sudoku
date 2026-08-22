'use strict';

function numBuild(ex){
  const w=(ex&&ex.w)||9, h=(ex&&ex.h)||9;
  const sp=newSpec('numerator');
  sp.kind='num';
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=addCell(sp,x,y,w*h); sp.region[i]=0 }
  sp.gOf=[]; sp.nOf=[]; sp.cOf=[]; sp.dOf=[]; sp.peers=[]; sp.nbr=[];
  for(let i=0;i<sp.cells.length;i++){
    sp.gOf.push([]); sp.nOf.push([]); sp.cOf.push([]); sp.dOf.push([]); sp.peers.push([]);
    sp.nbr.push(orthN(sp,i));
  }
  sp.maxD=w*h; sp.mask=null;
  return sp;
}
function numDist(sp,a,b){
  const p=sp.cells[a], q=sp.cells[b];
  return Math.abs(p.x-q.x)+Math.abs(p.y-q.y);
}

function numCount(sp,b,limit,budget){
  const n=sp.cells.length;
  const posOf=new Array(n+2).fill(-1), used=new Array(n).fill(false);
  for(let i=0;i<n;i++) if(b[i]){ posOf[b[i]]=i; used[i]=true }
  const nextKnown=new Array(n+2).fill(-1);
  for(let v=n;v>=1;v--) nextKnown[v]= posOf[v]>=0? v : nextKnown[v+1];
  const st={cnt:0,nodes:0,budget:budget||400000,over:false};
  const step=(v,pos)=>{
    if(st.over||st.cnt>=limit) return;
    if(++st.nodes>st.budget){ st.over=true; return }
    if(v>n){ st.cnt++; return }
    const k=nextKnown[v];
    if(k>0 && k>v){

      const d=numDist(sp,pos,posOf[k]), gap=k-v+1;
      if(d>gap || ((gap-d)&1)) return;
    }
    if(posOf[v]>=0){
      if(sp.nbr[pos].indexOf(posOf[v])<0) return;
      step(v+1,posOf[v]);
      return;
    }
    for(const j of sp.nbr[pos]) if(!used[j]){
      used[j]=true; step(v+1,j); used[j]=false;
      if(st.over||st.cnt>=limit) return;
    }
  };
  if(posOf[1]>=0) step(2,posOf[1]);
  else for(let i=0;i<n && !st.over && st.cnt<limit;i++) if(!used[i]){ used[i]=true; step(2,i); used[i]=false }
  return st.over? -1 : st.cnt;
}

function randomPath(w,h){
  const n=w*h, p=[];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) p.push(y*w+(y%2? w-1-x : x));
  const idx=new Array(n);
  p.forEach((c,k)=>idx[c]=k);
  const nb=c=>{ const x=c%w, y=(c/w)|0, r=[];
    if(x>0) r.push(c-1); if(x<w-1) r.push(c+1);
    if(y>0) r.push(c-w); if(y<h-1) r.push(c+w); return r };
  const rev=(a,b)=>{ while(a<b){ const t=p[a]; p[a]=p[b]; p[b]=t; idx[p[a]]=a; idx[p[b]]=b; a++; b-- } };
  for(let t=0;t<n*300;t++){
    if(RND(2)){
      const opts=nb(p[0]), j=idx[opts[RND(opts.length)]];
      if(j>1) rev(0,j-1);
    } else {
      const last=n-1, opts=nb(p[last]), j=idx[opts[RND(opts.length)]];
      if(j<last-1) rev(j+1,last);
    }
  }
  return p;
}
const NUM_KEEP={easy:30,medium:24,hard:19,expert:15};
function numMake(diff){
  const w=9,h=9,n=w*h;
  const sp=numBuild({w,h});
  const path=randomPath(w,h);
  const sol=new Array(n);
  path.forEach((cell,k)=>{ sol[cell]=k+1 });
  const keep=NUM_KEEP[diff];
  const b=sol.slice();
  let filled=n;
  const lock=new Set([path[0],path[n-1]]);
  for(const i of SHUF([...Array(n).keys()])){
    if(filled<=keep) break;
    if(lock.has(i)) continue;
    const t=b[i]; b[i]=0;
    if(numCount(sp,b,2,300000)!==1) b[i]=t; else filled--;
  }
  return {mode:'numerator',diff,ex:{w,h},sp,sol,puz:b,grade:0};
}
