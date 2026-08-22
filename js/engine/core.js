const BITS=(()=>{const a=new Uint8Array(8192);for(let i=1;i<8192;i++)a[i]=a[i>>1]+(i&1);return a})();
const popc=m=>BITS[m];
const lowV=m=>{for(let v=1;v<=12;v++) if(m&(1<<v)) return v; return 0};
const RND=n=>Math.floor(Math.random()*n);
const SHUF=a=>{for(let i=a.length-1;i>0;i--){const j=RND(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const FULL=d=>((1<<(d+1))-1)&~1;
const ALLM=0x1FFE;

function newSpec(id){
  return {id, W:0, H:0, cells:[], at:Object.create(null), dom:[], fix:[], region:[], zone:[],
          groups:[], neq:[], cages:[], dots:[], blocks:[], clues:[], frames:null, kind:'std'};
}
function addCell(sp,x,y,dom){
  const k=x+','+y;
  if(sp.at[k]!==undefined) return sp.at[k];
  const i=sp.cells.length;
  sp.cells.push({x,y}); sp.at[k]=i; sp.dom.push(dom||9); sp.fix.push(0); sp.region.push(-1); sp.zone.push(0);
  if(x+1>sp.W) sp.W=x+1;
  if(y+1>sp.H) sp.H=y+1;
  return i;
}
const cellAt=(sp,x,y)=>{const k=x+','+y; return sp.at[k]===undefined? -1 : sp.at[k]};

function addGrid(sp,ox,oy,n,bw,bh){
  const ids=[];
  for(let r=0;r<n;r++){ const row=[]; for(let c=0;c<n;c++) row.push(addCell(sp,ox+c,oy+r,n)); ids.push(row); }
  for(let r=0;r<n;r++) sp.groups.push(ids[r].slice());
  for(let c=0;c<n;c++) sp.groups.push(ids.map(row=>row[c]));
  const bc=n/bw, br=n/bh;
  for(let R=0;R<br;R++) for(let C=0;C<bc;C++){
    const g=[], rid=sp.groups.length;
    for(let r=0;r<bh;r++) for(let c=0;c<bw;c++){ const i=ids[R*bh+r][C*bw+c]; g.push(i); sp.region[i]=rid; }
    sp.groups.push(g);
  }
  return ids;
}

function prep(sp){
  const n=sp.cells.length;
  sp.gOf=[]; sp.nOf=[]; sp.cOf=[]; sp.dOf=[];
  for(let i=0;i<n;i++){ sp.gOf.push([]); sp.nOf.push([]); sp.cOf.push([]); sp.dOf.push([]); }
  sp.groups.forEach((g,gi)=>{ for(const i of g) sp.gOf[i].push(gi); });
  for(let i=0;i<n;i++) for(const gi of sp.gOf[i]) if(sp.groups[gi].length<sp.dom[i]) sp.dom[i]=sp.groups[gi].length;
  for(const p of sp.neq){ if(!sp.nOf[p[0]].includes(p[1])) sp.nOf[p[0]].push(p[1]); if(!sp.nOf[p[1]].includes(p[0])) sp.nOf[p[1]].push(p[0]); }
  sp.cages.forEach((c,ci)=>{ for(const i of c.cells) sp.cOf[i].push(ci); });
  for(const d of sp.dots){ sp.dOf[d.a].push({j:d.b,k:d.k}); sp.dOf[d.b].push({j:d.a,k:d.k}); }
  sp.mask=new Int32Array(n);
  for(let i=0;i<n;i++) sp.mask[i]=FULL(sp.dom[i]) & (sp.fix[i]||ALLM);
  sp.peers=[];
  for(let i=0;i<n;i++){
    const s=new Set();
    for(const gi of sp.gOf[i]) for(const j of sp.groups[gi]) s.add(j);
    for(const j of sp.nOf[i]) s.add(j);
    for(const d of sp.dOf[i]) s.add(d.j);
    for(const ci of sp.cOf[i]) for(const j of sp.cages[ci].cells) s.add(j);
    s.delete(i); sp.peers.push([...s]);
  }
  sp.maxD=Math.max(...sp.dom);
  return sp;
}

function dotOk(v,u,k){ return k===1 ? Math.abs(v-u)===1 : (v===u*2 || u===v*2) }
function dotMask(u,k,dom){
  let m=0;
  for(let v=1;v<=dom;v++) if(dotOk(v,u,k)) m|=1<<v;
  return m;
}
function cageFilter(sp,b,ci,i,m){
  const cg=sp.cages[ci];
  let used=0, sum=0, rem=0;
  for(const j of cg.cells){
    if(j===i){ rem++; continue; }
    if(b[j]){ used|=1<<b[j]; sum+=b[j]; } else rem++;
  }
  let out=0;
  const k=rem-1, left=cg.sum-sum;
  for(let v=1;v<=9;v++) if(m&(1<<v)){
    if(used&(1<<v)) continue;
    const need=left-v;
    if(k===0){ if(need===0) out|=1<<v; continue; }
    if(need<=0) continue;
    const av=[]; const bad=used|(1<<v);
    for(let u=1;u<=9;u++) if(!(bad&(1<<u))) av.push(u);
    if(av.length<k) continue;
    let mn=0,mx=0;
    for(let t=0;t<k;t++){ mn+=av[t]; mx+=av[av.length-1-t]; }
    if(need>=mn&&need<=mx) out|=1<<v;
  }
  return out;
}
function candMask(sp,b,i){
  let m=sp.mask[i];
  for(const gi of sp.gOf[i]){ const g=sp.groups[gi]; for(let t=0;t<g.length;t++){ const v=b[g[t]]; if(v) m&=~(1<<v); } }
  if(!m) return 0;
  for(const j of sp.nOf[i]) if(b[j]) m&=~(1<<b[j]);
  if(!m) return 0;
  for(const d of sp.dOf[i]) if(b[d.j]) m&=dotMask(b[d.j],d.k,sp.dom[i]);
  if(!m) return 0;
  for(const ci of sp.cOf[i]){ m=cageFilter(sp,b,ci,i,m); if(!m) return 0; }
  return m;
}

function dfsCount(sp,b,cand,limit,st){
  if(++st.nodes>st.budget){ st.over=true; return 0 }
  const n=b.length;
  let bi=-1,bn=99,bm=0;
  for(let i=0;i<n;i++) if(!b[i]){
    const c=popc(cand[i]);
    if(!c) return 0;
    if(c<bn){ bn=c; bi=i; bm=cand[i]; if(c===1) break }
  }
  if(bi<0) return 1;
  let cnt=0;
  for(let v=1;v<=12;v++) if(bm&(1<<v)){
    const saved=[[bi,cand[bi]]];
    b[bi]=v; cand[bi]=0;
    let ok=true;
    for(const j of sp.peers[bi]) if(!b[j]){ saved.push([j,cand[j]]); const nm=candMask(sp,b,j); cand[j]=nm; if(!nm){ ok=false; break } }
    if(ok) cnt+=dfsCount(sp,b,cand,limit-cnt,st);
    b[bi]=0;
    for(const s of saved) cand[s[0]]=s[1];
    if(st.over) return cnt;
    if(cnt>=limit) return cnt;
  }
  return cnt;
}

function countSol(sp,b,limit,budget){
  const n=sp.cells.length, cand=new Int32Array(n);
  for(let i=0;i<n;i++){ cand[i]=b[i]?0:candMask(sp,b,i); if(!b[i]&&!cand[i]) return 0 }
  const st={nodes:0,budget:budget||120000,over:false};
  const r=dfsCount(sp,Array.from(b),cand,limit,st);
  return st.over? -1 : r;
}

function dfsList(sp,b,cand,limit,st,out){
  if(++st.nodes>st.budget){ st.over=true; return }
  const n=b.length;
  let bi=-1,bn=99,bm=0;
  for(let i=0;i<n;i++) if(!b[i]){
    const c=popc(cand[i]);
    if(!c) return;
    if(c<bn){ bn=c; bi=i; bm=cand[i]; if(c===1) break }
  }
  if(bi<0){ out.push(b.slice()); return }
  for(let v=1;v<=12;v++) if(bm&(1<<v)){
    const saved=[[bi,cand[bi]]];
    b[bi]=v; cand[bi]=0;
    let ok=true;
    for(const j of sp.peers[bi]) if(!b[j]){ saved.push([j,cand[j]]); const nm=candMask(sp,b,j); cand[j]=nm; if(!nm){ ok=false; break } }
    if(ok) dfsList(sp,b,cand,limit,st,out);
    b[bi]=0;
    for(const s of saved) cand[s[0]]=s[1];
    if(st.over||out.length>=limit) return;
  }
}
function solveList(sp,b,limit,budget){
  const n=sp.cells.length, cand=new Int32Array(n);
  for(let i=0;i<n;i++){ cand[i]=b[i]?0:candMask(sp,b,i); if(!b[i]&&!cand[i]) return [] }
  const st={nodes:0,budget:budget||300000,over:false}, out=[];
  dfsList(sp,Array.from(b),cand,limit,st,out);
  return out;
}

function dfsFill(sp,b,cand,st){
  if(++st.nodes>st.budget){ st.over=true; return false }
  const n=b.length;
  let bi=-1,bn=99,bm=0;
  for(let i=0;i<n;i++) if(!b[i]){
    const c=popc(cand[i]);
    if(!c) return false;
    if(c<bn){ bn=c; bi=i; bm=cand[i]; if(c===1) break }
  }
  if(bi<0) return true;
  const vs=[];
  for(let v=1;v<=12;v++) if(bm&(1<<v)) vs.push(v);
  SHUF(vs);
  for(const v of vs){
    const saved=[[bi,cand[bi]]];
    b[bi]=v; cand[bi]=0;
    let ok=true;
    for(const j of sp.peers[bi]) if(!b[j]){ saved.push([j,cand[j]]); const nm=candMask(sp,b,j); cand[j]=nm; if(!nm){ ok=false; break } }
    if(ok && dfsFill(sp,b,cand,st)) return true;
    b[bi]=0;
    for(const s of saved) cand[s[0]]=s[1];
    if(st.over) return false;
  }
  return false;
}
function fillSpec(sp,tries,budget){
  const n=sp.cells.length;
  for(let t=0;t<(tries||24);t++){
    const b=new Array(n).fill(0), cand=new Int32Array(n);
    for(let i=0;i<n;i++) cand[i]=candMask(sp,b,i);
    const st={nodes:0,budget:budget||400000,over:false};
    if(dfsFill(sp,b,cand,st)) return b;
  }
  return null;
}

function digPuzzle(sp,sol,keepMin,budget,passes,stop){
  const n=sp.cells.length, b=Array.from(sol);
  let filled=n;
  const removed=[];
  for(let pass=0; pass<(passes||2); pass++){
    if(filled<=keepMin) break;
    for(const i of SHUF([...Array(n).keys()])){
      if(filled<=keepMin) break;
      if(stop && Date.now()>stop) return {puz:b, removed};
      if(!b[i]) continue;
      const keep=b[i]; b[i]=0;
      if(countSol(sp,b,2,budget)!==1) b[i]=keep;
      else { filled--; removed.push(i) }
    }
  }
  return {puz:b, removed};
}
