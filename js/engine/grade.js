'use strict';

function gradeSolve(sp,puz){
  const n=sp.cells.length, b=Array.from(puz), cand=new Int32Array(n);
  for(let i=0;i<n;i++) cand[i]= b[i]?0:candMask(sp,b,i);
  let placed=0; for(let i=0;i<n;i++) if(b[i]) placed++;
  let grade=0, guard=0;
  const place=(i,v)=>{
    b[i]=v; cand[i]=0; placed++;
    for(const j of sp.peers[i]) if(!b[j]) cand[j]=candMask(sp,b,j);
  };
  while(placed<n){
    if(++guard>4000) return {solved:false,grade:5};
    let prog=false;
    for(let i=0;i<n;i++) if(!b[i]){
      if(!cand[i]) return {solved:false,grade:5};
      if(popc(cand[i])===1){ place(i,lowV(cand[i])); grade=Math.max(grade,1); prog=true }
    }
    if(prog) continue;
    for(const g of sp.groups){
      const dmax=g.length;
      for(let v=1;v<=dmax;v++){
        let pos=-1,cnt=0,have=false;
        for(const i of g){ if(b[i]===v){ have=true; break } if(!b[i]&&(cand[i]&(1<<v))){ cnt++; pos=i; if(cnt>1) break } }
        if(have) continue;
        if(cnt===0) return {solved:false,grade:5};
        if(cnt===1){ place(pos,v); grade=Math.max(grade,2); prog=true }
      }
    }
    if(prog){ grade=Math.max(grade,2); continue }

    for(let gi=0;gi<sp.groups.length;gi++){
      const g=sp.groups[gi], dmax=g.length;
      for(let v=1;v<=dmax;v++){
        const pos=g.filter(i=>!b[i]&&(cand[i]&(1<<v)));
        if(pos.length<2||pos.length>4) continue;
        const shared=sp.gOf[pos[0]].filter(x=>x!==gi&&pos.every(i=>sp.gOf[i].includes(x)));
        for(const hi of shared){
          for(const i of sp.groups[hi]) if(!b[i]&&!pos.includes(i)&&(cand[i]&(1<<v))){ cand[i]&=~(1<<v); prog=true }
        }
      }
    }
    if(prog){ grade=Math.max(grade,3); continue }

    /* suguru: a value pinned to cells that all touch one neighbour cannot sit
       in that neighbour. Without this the solver stalled on most hard deals
       and declared them unsolvable */
    if(sp.neq.length){
      for(const g of sp.groups){
        for(let v=1;v<=g.length;v++){
          let have=false; const pos=[];
          for(const i of g){
            if(b[i]===v){ have=true; break }
            if(!b[i]&&(cand[i]&(1<<v))) pos.push(i);
          }
          if(have||pos.length<2||pos.length>4) continue;
          let common=sp.nOf[pos[0]].slice();
          for(let k=1;k<pos.length&&common.length;k++){
            const nb=sp.nOf[pos[k]];
            common=common.filter(x=>nb.indexOf(x)>=0);
          }
          for(const j of common)
            if(!b[j]&&pos.indexOf(j)<0&&(cand[j]&(1<<v))){ cand[j]&=~(1<<v); prog=true }
        }
      }
      if(prog){ grade=Math.max(grade,3); continue }
    }

    if(sp.cages.length){
      for(let ci=0;ci<sp.cages.length;ci++){
        const masks=cageCombo(sp,b,cand,ci);
        if(!masks) continue;
        const cg=sp.cages[ci];
        for(let t=0;t<cg.cells.length;t++){ const i=cg.cells[t];
          if(!b[i] && (cand[i]&~masks[t])){ cand[i]&=masks[t]; prog=true } }
      }
    }
    if(prog){ grade=Math.max(grade,3); continue }

    for(const g of sp.groups){
      const em=g.filter(i=>!b[i]);
      for(let a=0;a<em.length;a++){
        if(popc(cand[em[a]])!==2) continue;
        for(let c=a+1;c<em.length;c++) if(cand[em[c]]===cand[em[a]]){
          for(const i of em) if(i!==em[a]&&i!==em[c]&&(cand[i]&cand[em[a]])){ cand[i]&=~cand[em[a]]; prog=true }
        }
      }
    }
    if(prog){ grade=Math.max(grade,3); continue }

    for(const g of sp.groups){
      const dmax=g.length;
      for(let v1=1;v1<=dmax-1;v1++) for(let v2=v1+1;v2<=dmax;v2++){
        const p1=g.filter(i=>!b[i]&&(cand[i]&(1<<v1)));
        const p2=g.filter(i=>!b[i]&&(cand[i]&(1<<v2)));
        if(p1.length===2&&p2.length===2&&p1[0]===p2[0]&&p1[1]===p2[1]){
          const mk=(1<<v1)|(1<<v2);
          for(const i of p1) if(cand[i]!==(cand[i]&mk)){ cand[i]&=mk; prog=true }
        }
      }
    }
    if(prog){ grade=Math.max(grade,4); continue }

    for(const g of sp.groups){
      const em=g.filter(i=>!b[i]&&popc(cand[i])<=3&&popc(cand[i])>1);
      for(let a=0;a<em.length;a++) for(let c=a+1;c<em.length;c++) for(let e=c+1;e<em.length;e++){
        const u=cand[em[a]]|cand[em[c]]|cand[em[e]];
        if(popc(u)!==3) continue;
        for(const i of g) if(!b[i]&&i!==em[a]&&i!==em[c]&&i!==em[e]&&(cand[i]&u)){ cand[i]&=~u; prog=true }
      }
    }
    if(prog){ grade=Math.max(grade,4); continue }

    if(sp.plain){
      const rows=sp.lines[0][0], cols=sp.lines[0][1];
      for(let v=1;v<=sp.maxD && !prog;v++) for(let byRow=1;byRow>=0;byRow--){
        const A=byRow?rows:cols, B=byRow?cols:rows;
        const pos=A.map(u=>u.filter(i=>!b[i]&&(cand[i]&(1<<v))));
        const key=i=> byRow? sp.cells[i].x : sp.cells[i].y;
        for(let l1=0;l1<A.length-1;l1++){
          if(pos[l1].length!==2) continue;
          for(let l2=l1+1;l2<A.length;l2++){
            if(pos[l2].length!==2) continue;
            const a1=key(pos[l1][0]), a2=key(pos[l1][1]);
            if(key(pos[l2][0])!==a1 || key(pos[l2][1])!==a2) continue;
            for(const kk of [a1,a2]) for(const i of B[kk])
              if(!b[i]&&(cand[i]&(1<<v))&&pos[l1].indexOf(i)<0&&pos[l2].indexOf(i)<0){ cand[i]&=~(1<<v); prog=true }
          }
        }
      }
    }
    if(prog){ grade=Math.max(grade,4); continue }
    return {solved:false,grade:5};
  }
  return {solved:true,grade:grade||1};
}

function cageCombo(sp,b,cand,ci){
  const cg=sp.cages[ci], cells=cg.cells;
  if(cells.length>8) return null;
  const out=new Array(cells.length).fill(0);
  let need=cg.sum, free=[];
  for(let t=0;t<cells.length;t++){ const i=cells[t];
    if(b[i]){ need-=b[i]; out[t]=1<<b[i]; } else free.push(t); }
  if(!free.length) return out;
  const used=[];
  let found=0;
  const rec=(k,sum,mask)=>{
    if(found>4000) return;
    if(k===free.length){ if(sum===need){ found++; for(let t=0;t<free.length;t++) out[free[t]]|=1<<used[t] } return }
    const i=cells[free[k]];
    for(let v=1;v<=9;v++) if((cand[i]&(1<<v))&&!(mask&(1<<v))){
      if(sum+v>need) continue;
      used[k]=v; rec(k+1,sum+v,mask|(1<<v));
    }
  };
  rec(0,0,0);
  return found? out : null;
}

function easeTo(sp,puz,sol,removed,hi){
  const b=Array.from(puz);
  let g=gradeSolve(sp,b);
  const back=SHUF(removed.slice()), added=[];
  let guard=0;
  while((!g.solved||g.grade>hi) && back.length && ++guard<400){
    const step=Math.max(1,Math.round(back.length*0.06));
    for(let k=0;k<step&&back.length;k++){ const i=back.pop(); b[i]=sol[i]; added.push(i) }
    g=gradeSolve(sp,b);
  }
  /* the limit follows board size: on 12x12 and linked boards more than fifty cells
     come back, and with no tightening expert came out easier than medium */
  if(g.solved && added.length<=Math.max(48,Math.round(sp.cells.length*0.5))) for(const i of SHUF(added.slice())){
    const t=b[i]; b[i]=0;
    const g2=gradeSolve(sp,b);
    if(g2.solved && g2.grade<=hi) g=g2; else b[i]=t;
  }
  return {puz:b, grade:g.grade, solved:g.solved};
}
