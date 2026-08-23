'use strict';

const MEOW_N={easy:7,medium:8,hard:9,expert:10};
const MEOW_CAT=1, MEOW_MARK=2;

function meowBuild(ex){
  const n=ex.n||8, reg=ex.reg;
  const sp=newSpec('meow');
  sp.kind='meow';
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const i=addCell(sp,x,y,1);
    sp.region[i]=reg[y*n+x];
  }
  sp.n=n; sp.maxD=1; sp.mask=null;
  sp.gOf=[]; sp.nOf=[]; sp.cOf=[]; sp.dOf=[]; sp.peers=[];
  const byReg={};
  for(let i=0;i<sp.cells.length;i++){
    sp.gOf.push([]); sp.nOf.push([]); sp.cOf.push([]); sp.dOf.push([]);
    (byReg[sp.region[i]]=byReg[sp.region[i]]||[]).push(i);
  }
  /* строка, столбец, область и восемь соседей — всё, что кот держит под собой */
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i], s=new Set();
    for(let k=0;k<n;k++){
      const a=cellAt(sp,k,c.y), b=cellAt(sp,c.x,k);
      if(a>=0) s.add(a);
      if(b>=0) s.add(b);
    }
    for(const j of byReg[sp.region[i]]) s.add(j);
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
      const j=cellAt(sp,c.x+dx,c.y+dy);
      if(j>=0) s.add(j);
    }
    s.delete(i);
    sp.peers.push([...s]);
  }
  return sp;
}

/* кот бьёт свою строку, свой столбец и восемь соседних клеток */
function meowCount(n,reg,limit){
  const col=new Array(n).fill(false), zone=new Array(n).fill(false), at=new Array(n).fill(-1);
  let cnt=0;
  const rec=r=>{
    if(cnt>=limit) return;
    if(r===n){ cnt++; return }
    for(let c=0;c<n;c++){
      if(col[c]) continue;
      const g=reg[r*n+c];
      if(zone[g]) continue;
      if(r>0 && Math.abs(at[r-1]-c)<=1) continue;
      col[c]=true; zone[g]=true; at[r]=c;
      rec(r+1);
      col[c]=false; zone[g]=false; at[r]=-1;
      if(cnt>=limit) return;
    }
  };
  rec(0);
  return cnt;
}

function meowCats(n){
  for(let t=0;t<600;t++){
    const cols=SHUF([...Array(n).keys()]);
    let ok=true;
    for(let r=1;r<n;r++) if(Math.abs(cols[r]-cols[r-1])<=1){ ok=false; break }
    if(ok) return cols;
  }
  return null;
}

/* области растут от котов вразнобой, поэтому выходят разной формы */
function meowRegions(n,cols){
  const reg=new Array(n*n).fill(-1);
  cols.forEach((c,r)=>{ reg[r*n+c]=r });
  let left=n*n-n, guard=0;
  while(left>0 && ++guard<n*n*40){
    let moved=false;
    for(let k=0;k<n && left>0;k++){
      if(RND(4)===0) continue;
      const cand=[];
      for(let i=0;i<n*n;i++){
        if(reg[i]!==k) continue;
        const x=i%n, y=(i/n)|0;
        if(x>0 && reg[i-1]<0) cand.push(i-1);
        if(x<n-1 && reg[i+1]<0) cand.push(i+1);
        if(y>0 && reg[i-n]<0) cand.push(i-n);
        if(y<n-1 && reg[i+n]<0) cand.push(i+n);
      }
      if(!cand.length) continue;
      reg[cand[RND(cand.length)]]=k;
      left--; moved=true;
    }
    if(!moved){
      /* остаток раздаём соседям, чтобы поле не осталось дырявым */
      for(let i=0;i<n*n;i++){
        if(reg[i]>=0) continue;
        const x=i%n, y=(i/n)|0, nb=[];
        if(x>0&&reg[i-1]>=0) nb.push(reg[i-1]);
        if(x<n-1&&reg[i+1]>=0) nb.push(reg[i+1]);
        if(y>0&&reg[i-n]>=0) nb.push(reg[i-n]);
        if(y<n-1&&reg[i+n]>=0) nb.push(reg[i+n]);
        if(nb.length){ reg[i]=nb[RND(nb.length)]; left-- }
      }
      if(left>0) return null;
    }
  }
  return left? null : reg;
}

function meowMake(diff,deadline){
  const n=MEOW_N[diff]||8;
  const stop=deadline||(Date.now()+8000);
  let loose=null;
  while(Date.now()<stop){
    const cols=meowCats(n); if(!cols) continue;
    const reg=meowRegions(n,cols); if(!reg) continue;
    const sizes=new Array(n).fill(0);
    for(const r of reg) sizes[r]++;
    if(Math.min(...sizes)<2) continue;
    const found=meowCount(n,reg,2);
    if(found!==1){ if(found>1 && !loose) loose={cols,reg}; continue }
    return meowDeal(diff,n,cols,reg);
  }
  return loose? meowDeal(diff,n,loose.cols,loose.reg) : null;
}
function meowDeal(diff,n,cols,reg){
  const sol=new Array(n*n).fill(0);
  cols.forEach((c,r)=>{ sol[r*n+c]=MEOW_CAT });
  const ex={n,reg};
  return {mode:'meow', diff, ex, sp:meowBuild(ex), sol,
    puz:new Array(n*n).fill(0), grade:2};
}
