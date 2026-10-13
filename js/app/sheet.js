'use strict';

let SH=null;
const FOCUSABLE='button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])';
/* tab stays inside an open dialog */
function trap(e,box){
  if(e.key!=='Tab') return;
  const f=[...box.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null);
  if(!f.length) return;
  const a=f[0], z=f[f.length-1];
  if(!box.contains(document.activeElement)){ e.preventDefault(); a.focus(); return }
  if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus() }
  else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus() }
}
document.addEventListener('keydown',e=>{
  const al=document.querySelector('.alert');
  if(al) return trap(e,al);
  if(SH) trap(e,SH.el);
});
const phoneSheet=()=>innerWidth<=640;

/* wide screen: the card grows out of its tile; phone: a bottom sheet */
function openSheet(html,o={}){
  if(SH) closeSheet(true);
  const scrim=document.createElement('div'), el=document.createElement('div');
  scrim.className='scrim';
  el.className='sheet'+(o.cls?' '+o.cls:'');
  el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
  el.innerHTML=`<div class="grab" aria-hidden="true"></div><button class="sh-x" aria-label="${t('close')}">${ic('close')}</button><div class="sh-body">${html}</div>`;
  document.body.append(scrim,el);
  const head=el.querySelector('.sh-body h1,.sh-body .sh-title');
  if(head){ head.id='shT'+Date.now(); el.setAttribute('aria-labelledby',head.id) }
  const s=SH={el,scrim,from:o.from||null,anim:null,p:0,y:0,h:0,phone:phoneSheet(),ret:o.from||document.activeElement,onClose:o.onClose};
  scrim.addEventListener('click',()=>closeSheet());
  el.querySelector('.sh-x').addEventListener('click',()=>closeSheet());
  if(s.phone){
    s.h=el.offsetHeight;
    s.y=s.h; setY(s);
    s.anim=spring({from:s.h,to:0,response:.38,update:y=>{ s.y=y; setY(s) }});
    dragSheet(s);
  } else {
    place(s);
    s.anim=spring({from:0,to:1,response:.42,update:p=>{ s.p=p; setP(s) }});
  }
  el.tabIndex=-1;
  setTimeout(()=>{ try{ (viaKeys? el.querySelector('.sh-body button, .sh-body input, .sh-body [tabindex]') : el)?.focus({preventScroll:true}) }catch(e){} },30);
  return el;
}
function place(s){
  const el=s.el;
  el.style.left=Math.round((innerWidth-el.offsetWidth)/2)+'px';
  el.style.top=Math.round(Math.max(24,(innerHeight-el.offsetHeight)/2))+'px';
}
/* p runs from the tile (0) to the open card (1) */
function setP(s){
  const el=s.el, p=s.p;
  s.scrim.style.opacity=Math.max(0,Math.min(1,p));
  const f=s.from&&s.from.isConnected? s.from.getBoundingClientRect() : null;
  if(!f||REDUCED.matches){ el.style.opacity=Math.max(0,Math.min(1,p)); el.style.transform=`scale(${.96+.04*p})`; el.style.transformOrigin='50% 50%'; return }
  const w=el.offsetWidth, h=el.offsetHeight, x1=parseFloat(el.style.left), y1=parseFloat(el.style.top);
  const k0=f.width/w, k=k0+(1-k0)*p;
  const cx=(f.left+f.width/2)+((x1+w/2)-(f.left+f.width/2))*p, cy=(f.top+f.height/2)+((y1+h/2)-(f.top+f.height/2))*p;
  el.style.transform=`translate(${cx-k*w/2-x1}px,${cy-k*h/2-y1}px) scale(${k})`;
  el.style.opacity=Math.max(0,Math.min(1,p*2.2));
}
function setY(s){
  s.el.style.transform=`translateY(${s.y}px)`;
  s.scrim.style.opacity=Math.max(0,Math.min(1,1-s.y/s.h));
}
function closeSheet(now){
  const s=SH; if(!s) return;
  SH=null;
  if(s.anim) s.anim.stop();
  const end=()=>{ s.el.remove(); s.scrim.remove(); if(s.onClose) s.onClose() };
  try{ if(viaKeys&&s.ret&&s.ret.isConnected) s.ret.focus({preventScroll:true}) }catch(e){}
  if(now===true){ end(); return }
  s.scrim.style.pointerEvents='none'; s.el.style.pointerEvents='none';
  if(s.phone) spring({from:s.y,to:s.h,velocity:s.v||0,response:.32,update:y=>{ s.y=y; setY(s) },done:end});
  else spring({from:s.p,to:0,response:.3,update:p=>{ s.p=p; setP(s) },done:end,rest:.01});
}

/* rubber band above the top, release by the projected rest point */
function dragSheet(s){
  const g=s.el.querySelector('.grab'), body=s.el.querySelector('.sh-body');
  let y0=null, trail=[];
  const down=e=>{
    if(e.target.closest('.sh-body')&&(body.scrollTop>0||e.target.closest('button,input,.pool,.shelf'))) return;
    if(s.anim) s.anim.stop();
    y0=e.clientY-s.y; trail=[[e.clientY,e.timeStamp]];
    try{ e.currentTarget.setPointerCapture(e.pointerId) }catch(err){}
  };
  const move=e=>{
    if(y0==null) return;
    const y=e.clientY-y0;
    s.y= y>=0? y : rubber(y,s.h);
    setY(s);
    trail.push([e.clientY,e.timeStamp]); if(trail.length>6) trail.shift();
  };
  const up=e=>{
    if(y0==null) return;
    y0=null;
    /* speed over the last 100 ms; a finger that stopped before release throws nothing */
    const now=e.timeStamp, recent=trail.filter(p=>now-p[1]<=100), [py,pt]=recent[0]||[e.clientY,now], dt=now-pt;
    const v=dt>=8? Math.max(-5000,Math.min(5000,(e.clientY-py)/dt*1000)) : 0;
    const shut=s.y+project(v,.99)>s.h*.4;
    if(shut){ s.v=v; closeSheet(); return }
    s.anim=spring({from:s.y,to:0,velocity:v,response:.34,damping:.86,update:y=>{ s.y=y; setY(s) }});
  };
  for(const el of [g,s.el.querySelector('.sh-body')]){
    el.addEventListener('pointerdown',down);
    el.addEventListener('pointermove',move);
    el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up);
  }
}

/* resolves 'ok', 'alt' or false */
function ask(o){
  return new Promise(res=>{
    const bg=document.createElement('div');
    bg.className='alert-bg';
    bg.innerHTML=`<div class="alert" role="alertdialog" aria-modal="true">${o.title? `<b>${o.title}</b>` : ''}<p>${o.text}</p>
      <div class="acts">${o.alt? `<button data-r="alt">${o.alt}</button>` : `<button data-r="no">${t('cancel')}</button>`}<button data-r="ok" class="${o.danger?'danger':'strong'}">${o.ok}</button></div></div>`;
    document.body.appendChild(bg);
    requestAnimationFrame(()=>bg.classList.add('on'));
    const done=r=>{ bg.remove(); removeEventListener('keydown',key,true); res(r==='ok'? 'ok' : r==='alt'? 'alt' : false) };
    const key=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(o.alt? 'none' : 'no') } else if(e.key==='Enter'){ e.stopPropagation(); e.preventDefault(); done('ok') } };
    addEventListener('keydown',key,true);
    bg.addEventListener('click',e=>{ const b=e.target.closest('[data-r]'); if(b) done(b.dataset.r); else if(e.target===bg&&!o.alt) done('no') });
    const box=bg.querySelector('.alert'); box.tabIndex=-1;
    setTimeout(()=>(viaKeys? bg.querySelector('[data-r="ok"]') : box).focus(),20);
  });
}

let MENU=null;
function openMenu(btn,items){
  if(closeMenu()) return;
  const m=document.createElement('div');
  m.className='menu'; m.setAttribute('role','menu');
  m.innerHTML=items.map((it,k)=>`<button role="menuitem" data-k="${k}">${ic(it.icon)}${it.label}${it.kb? `<span class="kb">${it.kb}</span>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect();
  m.style.top=(r.bottom+8)+'px';
  m.style.left=Math.max(8,Math.min(innerWidth-m.offsetWidth-8,r.right-m.offsetWidth))+'px';
  m.addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; closeMenu(); items[+b.dataset.k].run() });
  MENU=m;
  if(!REDUCED.matches) m.animate([{opacity:0,transform:'scale(.92)'},{opacity:1,transform:'scale(1)'}],{duration:180,easing:'cubic-bezier(.3,.7,.3,1)'});
  setTimeout(()=>document.addEventListener('pointerdown',outside,true),0);
}
function outside(e){ if(MENU&&!MENU.contains(e.target)&&!e.target.closest('#moreBtn')) closeMenu() }
function closeMenu(){
  if(!MENU) return false;
  MENU.remove(); MENU=null;
  document.removeEventListener('pointerdown',outside,true);
  return true;
}
