'use strict';

const EVEN_MASK=(1<<2)|(1<<4)|(1<<6)|(1<<8);
const ODD_MASK=(1<<1)|(1<<3)|(1<<5)|(1<<7)|(1<<9);

function orthN(sp,i){
  const c=sp.cells[i], out=[];
  const d=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const s of d){ const j=cellAt(sp,c.x+s[0],c.y+s[1]); if(j>=0) out.push(j) }
  return out;
}
function allN(sp,i){
  const c=sp.cells[i], out=[];
  for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
    if(!dx&&!dy) continue;
    const j=cellAt(sp,c.x+dx,c.y+dy); if(j>=0) out.push(j);
  }
  return out;
}
function applyExtra(sp,ex){
  if(!ex) return sp;
  if(ex.even){
    const s=new Set(ex.even);
    for(let i=0;i<sp.cells.length;i++){ const e=s.has(i); sp.fix[i]=e?EVEN_MASK:ODD_MASK; if(e) sp.zone[i]=2 }
  }
  if(ex.cages) sp.cages=ex.cages.map(c=>({cells:c.cells.slice(), sum:c.sum, anchor:c.anchor}));
  if(ex.dots) sp.dots=ex.dots.map(d=>({a:d.a,b:d.b,k:d.k}));
  return sp;
}
function markZone(sp,list){ for(const i of list) sp.zone[i]=1; return list }
function lineSets(sp,ids){
  const rows=ids.map(r=>r.slice());
  const cols=ids[0].map((_,c)=>ids.map(r=>r[c]));
  sp.lines=[[rows,cols]];
  sp.plain=ids.length;
}

function multi(id,offs){
  const sp=newSpec(id);
  for(const o of offs) addGrid(sp,o[0],o[1],9,3,3);
  sp.frames=offs.map(o=>({x:o[0],y:o[1],w:9,h:9}));
  return sp;
}

function makeRegions(w,h,lo,hi){
  const n=w*h, reg=new Array(n).fill(-1);
  const at=(x,y)=> (x<0||y<0||x>=w||y>=h)? -1 : y*w+x;
  const nb=i=>{ const x=i%w,y=(i/w)|0, r=[];
    for(const s of [[1,0],[-1,0],[0,1],[0,-1]]){ const j=at(x+s[0],y+s[1]); if(j>=0) r.push(j) } return r };
  let rid=0;
  for(let guard=0;guard<n*4;guard++){
    const free=[]; for(let i=0;i<n;i++) if(reg[i]<0) free.push(i);
    if(!free.length) break;
    const start=free[RND(free.length)];
    const target=lo+RND(hi-lo+1);
    const cur=[start]; reg[start]=rid;
    while(cur.length<target){
      const cands=[];
      for(const i of cur) for(const j of nb(i)) if(reg[j]<0&&!cands.includes(j)) cands.push(j);
      if(!cands.length) break;
      const pick=cands[RND(cands.length)];
      reg[pick]=rid; cur.push(pick);
    }
    rid++;
  }

  let changed=true;
  while(changed){
    changed=false;
    const size={};
    for(const r of reg) size[r]=(size[r]||0)+1;
    for(let r=0;r<rid;r++){
      if(!size[r]||size[r]>=lo) continue;
      const cells=[]; for(let i=0;i<n;i++) if(reg[i]===r) cells.push(i);
      let host=-1;
      for(const i of cells) for(const j of nb(i)) if(reg[j]!==r && size[reg[j]]+size[r]<=hi){ host=reg[j]; break }
      if(host<0) continue;
      for(const i of cells) reg[i]=host;
      changed=true; break;
    }
  }
  const map={}, out=new Array(n);
  let k=0;
  for(let i=0;i<n;i++){ const r=reg[i]; if(map[r]===undefined) map[r]=k++; out[i]=map[r] }
  const sizes=new Array(k).fill(0);
  for(const r of out) sizes[r]++;
  return {reg:out, count:k, min:Math.min(...sizes), max:Math.max(...sizes)};
}

function suguruRegions(w,h,lo,hi){
  let best=null;
  for(let k=0;k<40;k++){
    const r=makeRegions(w,h,lo,hi);
    if(r.min>=lo && r.max<=hi) return r.reg;
    if(!best || (r.max-r.min)<(best.max-best.min)) best=r;
  }
  return best.reg;
}

function makeCages(sp,sol,maxSize){
  const n=sp.cells.length, cage=new Array(n).fill(-1), cages=[];
  const order=SHUF([...Array(n).keys()]);
  for(const start of order){
    if(cage[start]>=0) continue;
    const id=cages.length, cells=[start], used=1<<sol[start];
    cage[start]=id;
    const target=2+RND(maxSize-1);
    let mask=used;
    while(cells.length<target){
      const cand=[];
      for(const i of cells) for(const j of orthN(sp,i))
        if(cage[j]<0 && !(mask&(1<<sol[j])) && !cand.includes(j)) cand.push(j);
      if(!cand.length) break;
      const pick=cand[RND(cand.length)];
      cage[pick]=id; cells.push(pick); mask|=1<<sol[pick];
    }
    cages.push({cells});
  }

  for(let pass=0;pass<3;pass++) for(const cg of cages){
    if(cg.cells.length!==1) continue;
    const i=cg.cells[0];
    let host=null;
    for(const j of orthN(sp,i)){
      const h=cages[cage[j]];
      if(h===cg||h.cells.length>=maxSize) continue;
      if(h.cells.some(k=>sol[k]===sol[i])) continue;
      host=h; break;
    }
    if(!host) continue;
    host.cells.push(i); cage[i]=cages.indexOf(host); cg.cells=[];
  }
  const out=[];
  for(const cg of cages){
    if(!cg.cells.length) continue;
    let sum=0, anchor=cg.cells[0];
    for(const i of cg.cells){
      sum+=sol[i];
      const a=sp.cells[anchor], c=sp.cells[i];
      if(c.y<a.y||(c.y===a.y&&c.x<a.x)) anchor=i;
    }
    out.push({cells:cg.cells.slice(), sum, anchor});
  }
  return out;
}

function makeDots(sp,sol){
  const out=[];
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    for(const s of [[1,0],[0,1]]){
      const j=cellAt(sp,c.x+s[0],c.y+s[1]);
      if(j<0) continue;
      const a=sol[i], b=sol[j];
      const w=Math.abs(a-b)===1, bl=(a===b*2||b===a*2);
      if(w&&bl) out.push({a:i,b:j,k:RND(2)?1:2});
      else if(w) out.push({a:i,b:j,k:1});
      else if(bl) out.push({a:i,b:j,k:2});
    }
  }
  return out;
}

const SUG_MAX=9;
const SUG_CFG={
  easy:  {w:9, h:9, lo:5, hi:7},
  medium:{w:10,h:10,lo:4, hi:6},
  hard:  {w:11,h:11,lo:5, hi:7},
  expert:{w:12,h:12,lo:6, hi:8},
};

const MODES={
  classic:{ build(){ const sp=newSpec('classic'); lineSets(sp,addGrid(sp,0,0,9,3,3)); return sp },
    keep:{easy:36,medium:30,hard:25,expert:22} },

  x:{ build(){ const sp=newSpec('x'); lineSets(sp,addGrid(sp,0,0,9,3,3));
      const d1=[],d2=[];
      for(let k=0;k<9;k++){ d1.push(cellAt(sp,k,k)); d2.push(cellAt(sp,8-k,k)) }
      sp.groups.push(d1,d2); markZone(sp,d1); markZone(sp,d2); return sp },
    keep:{easy:32,medium:27,hard:23,expert:20} },

  evenodd:{ build(ex){ const sp=newSpec('evenodd'); lineSets(sp,addGrid(sp,0,0,9,3,3)); return applyExtra(sp,ex) },
    post(sp,sol,ex){ ex.even=[]; for(let i=0;i<81;i++) if(sol[i]%2===0) ex.even.push(i) },
    keep:{easy:24,medium:18,hard:13,expert:9} },

  windoku:{ build(){ const sp=newSpec('windoku'); lineSets(sp,addGrid(sp,0,0,9,3,3));
      for(const r0 of [1,5]) for(const c0 of [1,5]){
        const g=[];
        for(let r=0;r<3;r++) for(let c=0;c<3;c++) g.push(cellAt(sp,c0+c,r0+r));
        sp.groups.push(g); markZone(sp,g);
      }
      return sp },
    keep:{easy:30,medium:25,hard:21,expert:18} },

  asterisk:{ build(){ const sp=newSpec('asterisk'); lineSets(sp,addGrid(sp,0,0,9,3,3));
      const pts=[[4,1],[2,2],[6,2],[1,4],[4,4],[7,4],[2,6],[6,6],[4,7]];
      const g=pts.map(p=>cellAt(sp,p[0],p[1]));
      sp.groups.push(g); markZone(sp,g); return sp },
    keep:{easy:30,medium:25,hard:21,expert:18} },

  mosaic:{ build(){ const sp=newSpec('mosaic'); lineSets(sp,addGrid(sp,0,0,9,3,3));
      const g=[];
      for(let br=0;br<3;br++) for(let bc=0;bc<3;bc++){
        const corner = br!==1 && bc!==1;
        const x=bc*3+(corner? (bc===0?0:2) : 1);
        const y=br*3+(corner? (br===0?0:2) : 1);
        g.push(cellAt(sp,x,y));
      }
      sp.groups.push(g); markZone(sp,g); return sp },
    keep:{easy:30,medium:25,hard:21,expert:18} },

  r10:{
    time:4500, tries:12,
    build(){ const sp=newSpec('r10'); lineSets(sp,addGrid(sp,0,0,10,5,2)); return sp },
    keep:{easy:45,medium:38,hard:33,expert:29} },

  r12:{
    time:6500, tries:3, top:3,
    build(){ const sp=newSpec('r12'); lineSets(sp,addGrid(sp,0,0,12,4,3)); return sp },
    keep:{easy:70,medium:60,hard:52,expert:46} },

  double:{ time:7000, tries:3, tight:1, top:3,
    build(){ return multi('double',[[0,0],[6,6]]) },
    keep:{easy:68,medium:58,hard:50,expert:43} },

  wing:{ time:11000, tries:2, tight:1, top:3,
    build(){ return multi('wing',[[0,0],[12,0],[6,6]]) },
    keep:{easy:92,medium:80,hard:70,expert:62} },

  butterfly:{ time:7000, tries:3, tight:1, top:3,
    build(){ return multi('butterfly',[[0,0],[3,0],[0,3],[3,3]]) },
    keep:{easy:58,medium:48,hard:41,expert:36} },

  samurai:{ time:20000, tries:2, tight:1, top:3,
    build(){ return multi('samurai',[[0,0],[12,0],[6,6],[0,12],[12,12]]) },
    keep:{easy:150,medium:132,hard:118,expert:106} },

  killer:{ time:7000, tries:10, band:{easy:[2,4],medium:[3,5],hard:[3,5],expert:[4,5]},
    build(ex){ const sp=newSpec('killer'); lineSets(sp,addGrid(sp,0,0,9,3,3)); return applyExtra(sp,ex) },
    post(sp,sol,ex,diff){ ex.cages=makeCages(sp,sol, diff==='easy'?3: diff==='medium'?4:5) },
    keep:{easy:12,medium:6,hard:2,expert:0} },

  dots:{ time:6000, tries:10, band:{easy:[1,2],medium:[2,3],hard:[3,4],expert:[3,5]},
    build(ex){ const sp=newSpec('dots'); lineSets(sp,addGrid(sp,0,0,9,3,3)); return applyExtra(sp,ex) },
    post(sp,sol,ex){ ex.dots=makeDots(sp,sol) },
    keep:{easy:22,medium:14,hard:8,expert:4} },

  suguru:{
    time:9000, tries:4, budget:200000, top:3,
    band:{easy:[1,2],medium:[2,3],hard:[2,4],expert:[3,4]},
    pre(diff){
      const c=SUG_CFG[diff]||SUG_CFG.easy;
      return {regions:suguruRegions(c.w,c.h,c.lo,c.hi), w:c.w, h:c.h};
    },
    build(ex){
      const sp=newSpec('suguru');
      const w=ex.w||9, h=ex.h||9, reg=ex.regions;
      const byReg={};
      for(let y=0;y<h;y++) for(let x=0;x<w;x++){
        const i=addCell(sp,x,y,SUG_MAX), r=reg[y*w+x];
        sp.region[i]=r; (byReg[r]=byReg[r]||[]).push(i);
      }
      for(const r in byReg) sp.groups.push(byReg[r]);
      for(let i=0;i<sp.cells.length;i++) for(const j of allN(sp,i)) if(j>i) sp.neq.push([i,j]);
      return sp },
    keep:{easy:34,medium:38,hard:42,expert:46} },
};
const MODE_IDS=['classic','x','evenodd','windoku','asterisk','mosaic','r10','r12',
  'double','wing','butterfly','samurai','killer','dots','suguru','numerator','kakuro','tokki'];
const DIFFS=['easy','medium','hard','expert'];
const BAND={easy:[1,2],medium:[2,3],hard:[3,4],expert:[3,4]};
/* the band says what passes, the target says what to aim for. With no target
   hard and expert matched: same band, and both kept landing on 3 */
const TARGET={easy:1,medium:2,hard:3,expert:4};

function buildSpec(id,ex){
  if(id==='numerator') return numBuild(ex);
  if(id==='kakuro') return kakBuild(ex);
  if(id==='tokki') return tokkiBuild(ex);
  const sp=MODES[id].build(ex||{});
  return prep(sp);
}

/* last resort: a deal the solver cannot reason through takes clues back
   until it can */
function fillToSolvable(res){
  const sp=res.sp, b=Array.from(res.puz);
  let g=gradeSolve(sp,b);
  if(g.solved){ res.grade=g.grade; return res }
  const holes=[];
  for(let i=0;i<b.length;i++) if(!b[i]) holes.push(i);
  SHUF(holes);
  const step=Math.max(1,Math.round(holes.length*0.05));
  for(let k=0;k<holes.length;k+=step){
    for(let t=k;t<k+step&&t<holes.length;t++) b[holes[t]]=res.sol[holes[t]];
    g=gradeSolve(sp,b);
    if(g.solved) break;
  }
  res.puz=b; res.grade=g.grade;
  res.clues=b.reduce((s,v)=>s+(v?1:0),0);
  return res;
}

/* expert killer opens no digit: the cage sums pin it down */
function killerBlank(diff,deadline){
  let blankFallback=null;
  const stop=deadline||(Date.now()+12000);
  const half=Date.now()+(stop-Date.now())/2;
  while(Date.now()<stop){
    const ex={};
    let sp=buildSpec('killer',ex);
    const sol=fillSpec(sp,14,600000);
    if(!sol) continue;
    ex.cages=makeCages(sp,sol, Date.now()<half? 4 : 3);
    sp=buildSpec('killer',ex);
    const puz=new Array(sp.cells.length).fill(0);
    if(countSol(sp,puz,2,900000)!==1) continue;
    const g=gradeSolve(sp,puz);
    const res={mode:'killer',diff,ex,sp,sol,puz,grade:g.solved?g.grade:5,clues:0};
    if(g.solved) return res;
    if(!blankFallback) blankFallback=res;
  }
  return blankFallback;
}

function makePuzzle(id,diff,deadline){
  if(id==='numerator') return numMake(diff,deadline);
  if(id==='kakuro') return kakMake(diff,deadline);
  if(id==='tokki') return tokkiMake(diff,deadline);
  if(id==='killer'&&diff==='expert'){
    /* a blank deal takes a while to find; uncapped it ate the whole budget */
    const blank=killerBlank(diff, deadline||(Date.now()+8000));
    if(blank) return blank;
  }
  const M=MODES[id], band=(M.band&&M.band[diff])||BAND[diff];
  /* M.top is the ceiling of a mode: suguru has no fourth-level techniques,
     and chasing them burns the budget for nothing */
  const target=Math.min(band[1], TARGET[diff]||2, M.top||9);
  /* the spare time only helps where the fourth level is reachable at all */
  const chase = diff==='expert' && (M.top||9)>=4;
  const stop=deadline||(Date.now()+(M.time||3500)+(chase? Math.min(M.time||3500,4000) : 0));
  /* the target is chased for part of the budget, then anything sound will do,
     or expert keeps the player waiting. Where a try is cheap, the hunt runs longer */
  const half=Date.now()+(stop-Date.now())*((M.time||3500)<=4000? .6 : .34);
  let best=null, bestScore=Infinity;
  for(let att=0; att<(M.tries||30) && (att===0||Date.now()<stop); att++){
    const ex=M.pre? M.pre(diff) : {};
    let sp=buildSpec(id,ex);
    const sol=fillSpec(sp, M.tight?40:14, 600000);
    if(!sol) continue;
    if(M.post){ M.post(sp,sol,ex,diff); sp=buildSpec(id,ex) }
    const dug=digPuzzle(sp,sol,M.keep[diff],M.budget||140000,M.passes||2,stop);
    let eased=easeTo(sp,dug.puz,sol,dug.removed,band[1]);
    let clues=eased.puz.reduce((s,v)=>s+(v?1:0),0);

    /* fall back to the barer deal only while it still yields to reasoning:
       six clues more beat a board that only search can crack */
    const cap=M.keep[diff]+((diff==='hard'||diff==='expert')?6:999);
    if(clues>cap){
      const g0=gradeSolve(sp,dug.puz);
      if(g0.solved){
        eased={puz:dug.puz, grade:g0.grade, solved:true};
        clues=dug.puz.reduce((s,v)=>s+(v?1:0),0);
      }
    }
    const inBand=eased.solved && eased.grade>=band[0] && eased.grade<=band[1];
    const off=eased.solved? Math.abs(eased.grade-target) : 9;
    const score=(inBand?0:1000)+off*60+clues;
    if(score<bestScore){ bestScore=score; best={mode:id,diff,ex,sp,sol,puz:eased.puz,grade:eased.grade,clues} }
    const tight = clues<=M.keep[diff]+(diff==='expert'?2:4);
    if(inBand && (eased.grade>=target || Date.now()>half) && (diff!=='expert'||tight)) break;
  }
  if(best) return best.grade>=5? fillToSolvable(best) : best;

  for(let att=0;att<12;att++){
    const ex=M.pre? M.pre(diff) : {};
    let sp=buildSpec(id,ex);
    const sol=fillSpec(sp, 60, 900000);
    if(!sol) continue;
    if(M.post){ M.post(sp,sol,ex,diff); sp=buildSpec(id,ex) }
    const dug=digPuzzle(sp,sol,Math.round(sp.cells.length*0.55),80000,1);
    const g=gradeSolve(sp,dug.puz);
    const res={mode:id,diff,ex,sp,sol,puz:dug.puz,grade:g.grade,clues:dug.puz.reduce((s,v)=>s+(v?1:0),0)};
    return g.solved? res : fillToSolvable(res);
  }
  return null;
}
