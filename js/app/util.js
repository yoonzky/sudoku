'use strict';

const $=id=>document.getElementById(id);
const t=k=>{ const L=I18N[SES.settings.lang]||I18N.ru; return L[k]!=null? L[k] : (I18N.ru[k]!=null? I18N.ru[k] : k) };
const tf=(k,o)=>t(k).replace(/\{(\w+)\}/g,(m,n)=>o[n]!=null? o[n] : m);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)');
const MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const COARSE=matchMedia('(pointer:coarse)').matches;
/* focus moves into a dialog only for keyboard users: a tap must not leave a ring */
let viaKeys=false;
addEventListener('keydown',e=>{ if(e.key==='Tab'||e.key==='Enter'||e.key===' '||e.key.startsWith('Arrow')) viaKeys=true },true);
addEventListener('pointerdown',()=>{ viaKeys=false },true);
/* ios safari applies :active only when the page listens to touches */
addEventListener('touchstart',()=>{},{passive:true});

function fmtTime(s){
  if(s==null) return '';
  const h=(s/3600)|0, m=((s%3600)/60)|0, x=s%60;
  return h? `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}` : `${m}:${String(x).padStart(2,'0')}`;
}

const ICON={
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  erase:'<path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m16 9-5 6M11 9l5 6"/>',
  wand:'<path d="m4 20 10-10M15 4v2M15 12v2M11 8h2M17 8h2M17.8 5.2 17 6M12.2 10.8 13 10M17.8 10.8 17 10"/>',
  bulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
  pause:'<path d="M9 6v12M15 6v12"/>',
  play:'<path d="M8 5.5v13l10.5-6.5Z"/>',
  chart:'<path d="M6 19v-7M12 19V6M18 19v-10"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  close:'<path d="M17 7 7 17M7 7l10 10"/>',
  more:'<circle cx="6" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="18" cy="12" r=".6"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01"/>',
  restart:'<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/>',
  book:'<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  minus:'<path d="M6 12h12"/>',
  zoomIn:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.4 11h5.2M11 8.4v5.2"/>',
  zoomOut:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.4 11h5.2"/>',
};
const ic=(n,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
/* glyphs of the three input modes */
const GLYPH={
  digit:'<svg viewBox="0 0 20 20"><text x="10" y="15.5" text-anchor="middle" font-size="16" font-weight="500" fill="currentColor" font-family="system-ui,sans-serif">5</text></svg>',
  corner:'<svg viewBox="0 0 20 20" fill="currentColor" font-size="8.6" font-weight="600" font-family="system-ui,sans-serif" text-anchor="middle"><text x="4.5" y="8">1</text><text x="15.5" y="8">2</text><text x="4.5" y="18.5">3</text><text x="15.5" y="18.5">4</text></svg>',
  center:'<svg viewBox="0 0 20 20"><text x="10" y="14" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor" font-family="system-ui,sans-serif" letter-spacing="-.4">123</text></svg>',
};

let toastTimer=null;
function toast(msg){
  const el=$('toast');
  el.textContent=msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('on'),1600+msg.length*45);
}

/* spring by damping ratio and response, as in UIKit; mass 1 */
function spring(o){
  const k=Math.pow(2*Math.PI/(o.response||.4),2), c=4*Math.PI*(o.damping??1)/(o.response||.4);
  let x=o.from, v=o.velocity||0, last=0, raf=0, live=true;
  const to=o.to;
  const step=ts=>{
    if(!live) return;
    let dt=last? Math.min(.064,(ts-last)/1000) : 1/60;
    last=ts;
    /* sub-steps keep a stiff spring stable */
    const n=Math.ceil(dt/.004); dt/=n;
    for(let i=0;i<n;i++){ const a=-k*(x-to)-c*v; v+=a*dt; x+=v*dt }
    if(Math.abs(x-to)<(o.rest||.001)*Math.max(1,Math.abs(to-o.from)) && Math.abs(v)<(o.restV||.01)*Math.max(1,Math.abs(to-o.from))){
      x=to; v=0; o.update(x); live=false; if(o.done) o.done(); return;
    }
    o.update(x);
    raf=requestAnimationFrame(step);
  };
  if(REDUCED.matches && !o.keep){ o.update(to); if(o.done) o.done(); return {stop(){}, get v(){ return 0 }} }
  raf=requestAnimationFrame(step);
  return {stop(){ live=false; cancelAnimationFrame(raf) }, get v(){ return v }, get x(){ return x }};
}
/* where a flick comes to rest, as UIScrollView decelerates */
const project=(v,d=.998)=>v/1000*d/(1-d);
const rubber=(over,dim,c=.55)=>over*dim*c/(dim+c*Math.abs(over));
