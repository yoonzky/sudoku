'use strict';

let SPEC=null;
const cells=[];
const merged=(g,i)=>g.values[i]||g.hyp[i];

function cellNum(v){ return v==null||v===0? '' : String(v) }

function buildBoard(sp){
  SPEC=sp;
  const b=$('board');
  b.innerHTML=''; cells.length=0;
  b.style.gridTemplateColumns=`repeat(${sp.W},1fr)`;
  b.style.gridTemplateRows=`repeat(${sp.H},1fr)`;
  b.style.aspectRatio=`${sp.W} / ${sp.H}`;
  b.style.setProperty('--bw',sp.W);
  b.style.setProperty('--bh',sp.H);
  const nc = sp.maxD<=9? 3 : 4;
  b.style.setProperty('--nc',nc);
  b.style.setProperty('--nr',Math.ceil(sp.maxD/nc));
  document.body.classList.toggle('board-wide', sp.W>12);
  document.body.classList.toggle('board-num', sp.kind==='num');

  for(const bl of sp.blocks||[]){
    const d=document.createElement('div');
    d.className='blk';
    d.style.gridColumn=bl.x+1; d.style.gridRow=bl.y+1;
    b.appendChild(d);
  }
  for(const c of sp.clues||[]){
    const d=document.createElement('div');
    d.className='clue';
    d.style.gridColumn=c.x+1; d.style.gridRow=c.y+1;
    d.innerHTML='<svg viewBox="0 0 10 10" preserveAspectRatio="none"><line x1="0" y1="0" x2="10" y2="10"/></svg>'+
      `<u>${c.r||''}</u><s>${c.d||''}</s>`;
    b.appendChild(d);
  }
  for(let i=0;i<sp.cells.length;i++){
    const c=sp.cells[i];
    const d=document.createElement('div');
    d.className='cell';
    d.style.gridColumn=c.x+1; d.style.gridRow=c.y+1;
    const up=cellAt(sp,c.x,c.y-1), lf=cellAt(sp,c.x-1,c.y);
    const dn=cellAt(sp,c.x,c.y+1), rt=cellAt(sp,c.x+1,c.y);
    const edge=(n)=> n<0? 'strong' : (sp.region[n]!==sp.region[i]? 'strong' : 'thin');
    const line=k=> k==='strong'? '2px solid var(--rule)' : '1px solid var(--line)';
    d.style.setProperty('--bt',line(edge(up)));
    d.style.setProperty('--bl',line(edge(lf)));
    if(dn<0) d.style.setProperty('--bb',line('strong'));
    if(rt<0) d.style.setProperty('--br',line('strong'));
    if(sp.zone[i]===1) d.classList.add('zone');
    if(sp.zone[i]===2) d.classList.add('even');
    d.dataset.i=i;
    b.appendChild(d); cells.push(d);
  }
  buildDeco(sp);
}

function buildDeco(sp){
  const b=$('board');
  const old=b.querySelector('.deco'); if(old) old.remove();
  if(sp.kind==='kakuro') return;
  if(!sp.cages.length && !sp.dots.length && !sp.frames) return;
  const deco=document.createElement('div');
  deco.className='deco';
  const d=0.1;
  let path='';
  const inCage=(cg,x,y)=>{ const j=cellAt(sp,x,y); return j>=0 && cg.cells.indexOf(j)>=0 };
  for(const cg of sp.cages){
    for(const i of cg.cells){
      const c=sp.cells[i], x=c.x, y=c.y;
      if(!inCage(cg,x,y-1)) path+=`M${x+d} ${y+d}H${x+1-d}`;
      if(!inCage(cg,x,y+1)) path+=`M${x+d} ${y+1-d}H${x+1-d}`;
      if(!inCage(cg,x-1,y)) path+=`M${x+d} ${y+d}V${y+1-d}`;
      if(!inCage(cg,x+1,y)) path+=`M${x+1-d} ${y+d}V${y+1-d}`;
    }
  }
  let frames='';
  if(sp.frames) for(const f of sp.frames)
    frames+=`<rect x="${f.x+0.04}" y="${f.y+0.04}" width="${f.w-0.08}" height="${f.h-0.08}" rx=".14"/>`;
  let dots='';
  for(const dt of sp.dots){
    const a=sp.cells[dt.a], c=sp.cells[dt.b];
    const cx=(a.x+c.x+1)/2, cy=(a.y+c.y+1)/2;
    dots+=`<circle cx="${cx}" cy="${cy}" r=".12" fill="${dt.k===2?'var(--text)':'var(--panel2)'}" stroke="var(--text)" stroke-width=".04"/>`;
  }
  deco.innerHTML=`<svg viewBox="0 0 ${sp.W} ${sp.H}" preserveAspectRatio="none">`+
    (frames? `<g fill="none" stroke="var(--accent)" stroke-width=".05" opacity=".55">${frames}</g>`:'')+
    (path? `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width=".035" stroke-dasharray=".11 .09" stroke-linecap="butt"/>`:'')+
    dots+'</svg>';
  for(const cg of sp.cages){
    const a=sp.cells[cg.anchor!=null? cg.anchor : cg.cells[0]];
    const lab=document.createElement('u');
    lab.className='cgs';
    lab.style.left=(a.x/sp.W*100)+'%';
    lab.style.top=(a.y/sp.H*100)+'%';
    lab.style.width=(100/sp.W)+'%';
    lab.style.height=(100/sp.H)+'%';
    lab.textContent=cg.sum;
    deco.appendChild(lab);
  }
  b.appendChild(deco);
}

function buildNumpad(sp){
  const np=$('numpad');
  np.innerHTML='';
  const max=sp.kind==='num'? 9 : sp.maxD;
  np.style.gridTemplateColumns=`repeat(${sp.kind==='num'? 10 : max},1fr)`;
  const keys=[];
  for(let v=1;v<=max;v++) keys.push(v);
  if(sp.kind==='num') keys.push(0);
  for(const v of keys){
    const btn=document.createElement('button');
    btn.className='num'; btn.dataset.v=v;
    btn.innerHTML=`${v}<small></small>`;
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); numpadPress(v) });
    np.appendChild(btn);
  }
}

const TOT_CACHE={};
function digitTotals(g){
  if(TOT_CACHE.id===g.id) return TOT_CACHE.map;
  const m={};
  for(const v of g.solution) m[v]=(m[v]||0)+1;
  TOT_CACHE.id=g.id; TOT_CACHE.map=m;
  return m;
}

function renderBoard(){
  const g=cur(); if(!g||!SPEC) return;
  const sp=SPEC, n=sp.cells.length;
  const isNum=sp.kind==='num';
  const hlSame=SES.settings.highlightSame!==false;
  const selVal=sel>=0? merged(g,sel) : 0;
  const activeVal=hlSame? (selVal||hlDigit) : 0;
  const counts={};
  for(let i=0;i<n;i++){ const v=merged(g,i); if(v) counts[v]=(counts[v]||0)+1 }
  const peers=sel>=0? sp.peers[sel] : null;
  for(let i=0;i<n;i++){
    const d=cells[i], v=g.values[i], hv=g.hyp[i];
    d.className=d.className.replace(/ (sel|hl|same|err|given|hypv|d2)/g,'');
    if(g.given[i]) d.classList.add('given');
    if(v){
      d.textContent=cellNum(v);
      if(v>9) d.classList.add('d2');
      if(g.instant && !g.given[i] && v!==g.solution[i]) d.classList.add('err');
    } else if(hv){
      d.textContent=cellNum(hv); d.classList.add('hypv');
      if(hv>9) d.classList.add('d2');
    } else if(!isNum && g.notes[i].length){
      let h='<div class="notes">';
      for(let k=1;k<=sp.maxD;k++)
        h+=`<span${activeVal&&k===activeVal?' class="nhl"':''}>${g.notes[i].includes(k)?k:''}</span>`;
      d.innerHTML=h+'</div>';
    } else d.textContent='';
    if(!g.instant && g.endErr && g.endErr.includes(i)) d.classList.add('err');
    if(sel>=0){
      if(i===sel) d.classList.add('sel');
      else if(peers.indexOf(i)>=0) d.classList.add('hl');
    }
    if(activeVal && i!==sel){
      const hasNote=!v&&!hv&&!isNum&&g.notes[i].includes(activeVal);
      if(merged(g,i)===activeVal||hasNote) d.classList.add('same');
    }
  }
  const showCounts=SES.settings.showCounts!==false && !isNum;
  const tot=digitTotals(g);
  document.querySelectorAll('.num').forEach(btn=>{
    const v=+btn.dataset.v;
    const left=(tot[v]||0)-(counts[v]||0);
    const small=btn.querySelector('small');
    if(small) small.textContent=(showCounts&&left>0)?left:'';
    btn.classList.toggle('done', !isNum && left<=0);
    btn.classList.toggle('hl', v>0 && hlDigit===v);
    btn.classList.toggle('armed', v>0 && SES.settings.digitFirst && armed===v);
  });
  const np=$('numpad');
  if(np){ np.classList.toggle('mode-note', inputMode==='note'); np.classList.toggle('mode-hyp', inputMode==='hyp') }
  $('gMistWrap').style.display=g.instant? '' : 'none';
  $('gMist').textContent=(SES.settings.limit&&g.instant&&!g.noLimit)? `${g.mistakes}/3` : g.mistakes;
  $('gMode').textContent=t('m_'+g.mode);
  $('gDiff').textContent=t('d_'+g.diff);
  $('board').classList.toggle('notes-on', inputMode==='note');
  $('board').classList.toggle('hyp-on', inputMode==='hyp');
  $('undoBtn').disabled=!undoStack.length;
  $('redoBtn').disabled=!redoStack.length;
}

function snapBoard(){
  const b=$('board'); if(!b||!SPEC) return;
  b.style.width='';
  const w=b.getBoundingClientRect().width;
  const bw=(parseFloat(getComputedStyle(b).borderLeftWidth)||0)*2;
  const c=Math.floor((w-bw)/SPEC.W);
  if(c>0) b.style.width=(c*SPEC.W+bw)+'px';
}
