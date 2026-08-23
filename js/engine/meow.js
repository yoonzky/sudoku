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
  /* a cat holds its row, column, region and the eight cells around */
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

/* plays the deal the way a person would: singles, then lines locked to a region */
function meowLogic(n,reg){
  const N=n*n;
  const cand=new Array(N).fill(true), cat=new Array(N).fill(false);
  const byReg={};
  for(let i=0;i<N;i++) (byReg[reg[i]]=byReg[reg[i]]||[]).push(i);
  const groups=[];
  for(let r=0;r<n;r++){ const cells=[]; for(let c=0;c<n;c++) cells.push(r*n+c); groups.push({kind:'r',id:r,cells}) }
  for(let c=0;c<n;c++){ const cells=[]; for(let r=0;r<n;r++) cells.push(r*n+c); groups.push({kind:'c',id:c,cells}) }
  for(const k in byReg) groups.push({kind:'z',id:+k,cells:byReg[k]});
  let placed=0;
  const place=i=>{
    cat[i]=true; placed++;
    const r=(i/n)|0, c=i%n;
    for(let k=0;k<n;k++){ cand[r*n+k]=false; cand[k*n+c]=false }
    for(const j of byReg[reg[i]]) cand[j]=false;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      const rr=r+dr, cc=c+dc;
      if(rr>=0&&cc>=0&&rr<n&&cc<n) cand[rr*n+cc]=false;
    }
  };
  let guard=0;
  while(placed<n && ++guard<N*8){
    let moved=false;
    for(const g of groups){
      if(g.cells.some(i=>cat[i])) continue;
      const open=g.cells.filter(i=>cand[i]);
      if(!open.length) return false;
      if(open.length===1){ place(open[0]); moved=true }
    }
    if(moved) continue;
    for(const g of groups){
      if(g.cells.some(i=>cat[i])) continue;
      const open=g.cells.filter(i=>cand[i]);
      if(!open.length) return false;
      if(g.kind==='z'){
        const rs=new Set(open.map(i=>(i/n)|0));
        if(rs.size===1){
          const r=[...rs][0];
          for(let c=0;c<n;c++){ const j=r*n+c; if(cand[j]&&reg[j]!==g.id){ cand[j]=false; moved=true } }
        }
        const cs=new Set(open.map(i=>i%n));
        if(cs.size===1){
          const c=[...cs][0];
          for(let r=0;r<n;r++){ const j=r*n+c; if(cand[j]&&reg[j]!==g.id){ cand[j]=false; moved=true } }
        }
      } else {
        const zs=new Set(open.map(i=>reg[i]));
        if(zs.size===1){
          const inLine=new Set(g.cells);
          for(const j of byReg[[...zs][0]]) if(cand[j]&&!inLine.has(j)){ cand[j]=false; moved=true }
        }
      }
    }
    if(moved) continue;
    const free=groups.filter(g=>!g.cells.some(i=>cat[i]));
    const zs=free.filter(g=>g.kind==='z');
    for(const key of ['r','c']){
      const line=i=> key==='r'? ((i/n)|0) : i%n;
      for(let a=0;a<zs.length-1&&!moved;a++) for(let b=a+1;b<zs.length&&!moved;b++){
        const open=[...zs[a].cells,...zs[b].cells].filter(i=>cand[i]);
        const set=new Set(open.map(line));
        if(set.size!==2) continue;
        const ids=new Set([zs[a].id,zs[b].id]);
        for(const i of cand.keys()) if(cand[i]&&set.has(line(i))&&!ids.has(reg[i])){ cand[i]=false; moved=true }
      }
      const lines=free.filter(g=>g.kind===key);
      for(let a=0;a<lines.length-1&&!moved;a++) for(let b=a+1;b<lines.length&&!moved;b++){
        const open=[...lines[a].cells,...lines[b].cells].filter(i=>cand[i]);
        const set=new Set(open.map(i=>reg[i]));
        if(set.size!==2) continue;
        const keep=new Set([...lines[a].cells,...lines[b].cells]);
        for(const i of cand.keys()) if(cand[i]&&set.has(reg[i])&&!keep.has(i)){ cand[i]=false; moved=true }
      }
    }
    if(!moved) return false;
  }
  return placed===n;
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

function meowSolutions(n,reg,limit){
  const col=new Array(n).fill(false), zone=new Array(n).fill(false), at=new Array(n).fill(-1);
  const out=[];
  const rec=r=>{
    if(out.length>=limit) return;
    if(r===n){ out.push(at.slice()); return }
    for(let c=0;c<n;c++){
      if(col[c]) continue;
      const g=reg[r*n+c];
      if(zone[g]) continue;
      if(r>0 && Math.abs(at[r-1]-c)<=1) continue;
      col[c]=true; zone[g]=true; at[r]=c;
      rec(r+1);
      col[c]=false; zone[g]=false; at[r]=-1;
      if(out.length>=limit) return;
    }
  };
  rec(0);
  return out;
}
function meowLinked(cells,n){
  if(!cells.length) return false;
  const set=new Set(cells), seen=new Set([cells[0]]), stack=[cells[0]];
  while(stack.length){
    const i=stack.pop(), x=i%n, y=(i/n)|0;
    const nb=[];
    if(x>0) nb.push(i-1);
    if(x<n-1) nb.push(i+1);
    if(y>0) nb.push(i-n);
    if(y<n-1) nb.push(i+n);
    for(const j of nb) if(set.has(j)&&!seen.has(j)){ seen.add(j); stack.push(j) }
  }
  return seen.size===cells.length;
}
/* moves one cell to another region until the spare answers die off */
function meowCarve(n,cols,reg,stop){
  const cats=new Set(cols.map((c,r)=>r*n+c));
  for(let step=0;step<300;step++){
    if(Date.now()>stop) return false;
    const sols=meowSolutions(n,reg,2);
    if(sols.length<2) return sols.length===1;
    const other=sols.find(s=>s.some((c,r)=>c!==cols[r]));
    if(!other) return false;
    const spot=other.map((c,r)=>r*n+c);
    let cut=false;
    for(const b of SHUF(spot.slice())){
      if(cats.has(b)) continue;
      const from=reg[b], rest=[];
      for(let i=0;i<n*n;i++) if(reg[i]===from&&i!==b) rest.push(i);
      if(!rest.length||!meowLinked(rest,n)) continue;
      const x=b%n, y=(b/n)|0, nb=[];
      if(x>0) nb.push(b-1);
      if(x<n-1) nb.push(b+1);
      if(y>0) nb.push(b-n);
      if(y<n-1) nb.push(b+n);
      for(const j of SHUF(nb)){
        const to=reg[j];
        if(to===from) continue;
        if(!spot.some(k=>k!==b&&reg[k]===to)) continue;
        reg[b]=to; cut=true; break;
      }
      if(cut) break;
    }
    if(!cut) return false;
  }
  return false;
}

function meowMake(diff,deadline){
  const n=MEOW_N[diff]||8;
  const stop=deadline||(Date.now()+14000);
  let loose=null;
  while(Date.now()<stop){
    const cols=meowCats(n); if(!cols) continue;
    const reg=meowRegions(n,cols); if(!reg) continue;
    if(!meowCarve(n,cols,reg,stop)) continue;
    const sizes=new Array(n).fill(0);
    for(const r of reg) sizes[r]++;
    if(Math.min(...sizes)<2) continue;
    if(!meowLogic(n,reg)){ if(!loose) loose={cols,reg}; continue }
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
