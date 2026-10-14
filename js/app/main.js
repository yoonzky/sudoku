/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
'use strict';

const DARK_Q=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const th=SES.settings.theme, dark= th==='dark' || (th==='auto' && DARK_Q.matches);
  document.documentElement.dataset.theme= dark? 'dark' : 'light';
  const meta=$('metaTheme'); if(meta) meta.content= dark? '#131417' : '#eceef2';
}
function applyLang(){
  document.documentElement.lang=SES.settings.lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=t(el.dataset.i18n) });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));
}
function showScreen(name){
  $('home').classList.toggle('hidden',name!=='home');
  $('game').classList.toggle('hidden',name!=='game');
  document.body.classList.toggle('in-game',name==='game');
  if(name==='home') scrollTo(0,0);
}

function openRules(m){
  openSheet(`<div class="msheet"><span class="art" style="--art:${innerWidth<=640?200:240}px">${modeArt(m,innerWidth<=640?200:240)}</span><div><h1>${t('m_'+m)}</h1><div class="grp">${t(groupOf(m))}</div><p>${t('r_'+m)}</p></div></div>`,{cls:'rules'});
}

function swRow(key,title,desc,dis){
  return `<label class="li"><span class="tx">${t(title)}<small>${t(desc)}</small></span><span class="sw" style="margin-left:auto"><input type="checkbox" data-opt="${key}"${SES.settings[key]?' checked':''}${dis?' disabled':''}><i></i></span></label>`;
}
function keysHTML(){
  const M=MAC? 'Cmd' : 'Ctrl';
  const row=(a,k)=>`<div class="li"><span class="tx">${t(a).charAt(0).toUpperCase()+t(a).slice(1)}</span><span class="meta">${k}</span></div>`;
  const kb=s=>s.split(' ').map(x=>x==='/'? ` ${t('kOr')} ` : x==='+'? ' + ' : `<kbd>${x}</kbd>`).join('');
  return `<div class="lcap">${t('sGame')}</div><div class="list">`+
    row('kDigit',kb('1 ... 9'))+row('kBig',kb('A B C'))+row('kCorner',kb('Shift + 1'))+row('kCenter',kb(M+' + 1'))+row('kErase',kb('Backspace / 0'))+
    '</div><div class="list" style="margin-top:12px">'+
    row('kModes',kb('Z X C'))+row('kNext',`<kbd>${t('kSpace')}</kbd>`)+row('kMulti',kb(M)+' + '+t('kClick')+` ${t('kOr')} `+t('kDrag'))+
    '</div><div class="list" style="margin-top:12px">'+
    row('kUndo',kb(M+' + Z'))+row('kRedo',kb(M+' + Y'))+row('kHint',kb('H'))+row('kAuto',kb('A'))+
    '</div><div class="list" style="margin-top:12px">'+
    row('kMove',kb('Arrows').replace('Arrows','&#8592; &#8593; &#8595; &#8594;'))+row('kRules',kb('R'))+row('kPause',kb('P'))+row('kBack',kb('Esc'))+'</div>';
}
let setTab='view';
function openSettings(){
  const tabs=[['view','sView'],['game','sGame']].concat(COARSE? [] : [['keys','sKeys']]);
  const body=()=>{
    const s=SES.settings;
    if(setTab==='view') return `<div class="lcap">${t('theme')}</div><div class="seg" data-set="theme">${[['auto','thAuto'],['light','thLight'],['dark','thDark']].map(([v,k])=>`<button data-v="${v}" class="${s.theme===v?'on':''}">${t(k)}</button>`).join('')}</div>
      <div class="lcap">${t('lang')}</div><div class="seg" data-set="lang"><button data-v="ru" class="${s.lang==='ru'?'on':''}">Русский</button><button data-v="en" class="${s.lang==='en'?'on':''}">English</button></div>
      <div class="lcap">${t('about')}</div><div class="list"><a class="li" href="https://yoonzky.github.io/links/" target="_blank" rel="noopener"><span class="tx">${t('author')}</span><span class="meta">yoonzky</span>${ic('chev','chev')}</a><a class="li" href="https://github.com/yoonzky/yoondoku" target="_blank" rel="noopener"><span class="tx">${t('srcCode')}<small>${t('srcInfo')}</small></span><span class="meta">GitHub</span>${ic('chev','chev')}</a></div>`;
    if(setTab==='game') return `<div class="lcap">${t('grpCheck')}</div><div class="list">${swRow('instant','instantT','instantD')}${swRow('limit','limitT','limitD',!s.instant)}</div>
      <div class="lcap">${t('grpBoard')}</div><div class="list">${swRow('peers','peersT','peersD')}${swRow('same','sameT','sameD')}</div>
      <div class="lcap">${t('grpPad')}</div><div class="list">${swRow('counts','countsT','countsD')}${swRow('hintBtn','hintT','hintD')}${swRow('autoBtn','autoT','autoD')}</div>`;
    return keysHTML();
  };
  const html=()=>`<div class="sh-title">${t('settings')}</div><div class="seg tabs" style="margin-top:14px">${tabs.map(([k,n])=>`<button data-tab="${k}" class="${setTab===k?'on':''}">${t(n)}</button>`).join('')}</div><div id="setBody">${body()}</div>`;
  const sh=openSheet(html(),{cls:'narrow'});
  const redraw=()=>{ sh.querySelector('.sh-body').innerHTML=html(); if(SH&&!SH.phone) place(SH) };
  sh.addEventListener('click',e=>{
    const tb=e.target.closest('[data-tab]');
    if(tb){ setTab=tb.dataset.tab; redraw(); return }
    const sb=e.target.closest('[data-set] button');
    if(sb){
      const k=sb.parentNode.dataset.set;
      SES.settings[k]=sb.dataset.v; saveSoon();
      if(k==='theme') applyTheme();
      if(k==='lang'){ applyLang(); renderHome(); if(G&&SP){ $('gMode').textContent=t('m_'+G.mode); $('gDiff').textContent=t('d_'+G.diff); setPaused(G.paused); if(!G.done) renderPad(); paint() } }
      redraw();
    }
  });
  sh.addEventListener('change',e=>{
    const k=e.target.dataset.opt; if(!k) return;
    SES.settings[k]=e.target.checked; saveSoon();
    if(k==='instant') redraw();
    if(G&&SP&&!G.done){ if(k==='hintBtn'||k==='autoBtn') renderPad(); paint() }
  });
}

function openStats(){
  const all=statsFor(null,null);
  let h=`<div class="sh-title">${t('stats')}</div>`;
  if(!all.solved) h+=`<p class="empty">${t('statsEmpty')}</p>`;
  else {
    h+=`<div class="st-sum"><div><b class="num">${all.solved}</b><span>${t('statsSolved')}</span></div><div><b class="num">${all.clean}</b><span>${t('statsClean')}</span></div><div><b class="num">${fmtTime(all.total)}</b><span>${t('statsTime')}</span></div></div>`;
    h+=`<div class="st-table"><div class="st-row st-hd"><span></span>${DIFFS.map(d=>`<span>${t('d_'+d)}</span>`).join('')}</div>`;
    for(const [cap,ids] of GROUPS){
      const rows=ids.filter(m=>statsFor(m,null).solved);
      if(!rows.length) continue;
      h+=`<div class="st-cap">${t(cap)}</div>`;
      for(const m of rows) h+=`<div class="st-row"><span class="nm">${modeArt(m,24)}${t('m_'+m)}</span>${DIFFS.map(d=>{ const s=statsFor(m,d); return `<span class="num">${s.best!=null? fmtTime(s.best) : ''}${s.solved>1? `<small>${s.solved}</small>` : ''}</span>` }).join('')}</div>`;
    }
    h+=`</div><button class="link danger" id="resetStats">${t('statsReset')}</button>`;
  }
  const sh=openSheet(h,{cls:'narrow stats'});
  const rb=sh.querySelector('#resetStats');
  if(rb) rb.onclick=async()=>{
    if(!(await ask({text:t('statsResetQ'), ok:t('statsReset'), danger:true}))) return;
    LOG=[]; saveLog(); closeSheet(true); renderHome(); toast(t('statsResetDone'));
  };
}

function boot(){
  loadStore();
  applyTheme(); applyLang();
  DARK_Q.addEventListener('change',applyTheme);
  bindInput(); bindHome();
  $('backBtn').addEventListener('click',goHome);
  $('pauseBtn').addEventListener('click',()=>{ if(G&&!G.done) setPaused(!G.paused) });
  $('moreBtn').addEventListener('click',e=>openMenu(e.currentTarget,[
    {icon:'book',label:t('rules'),kb:'R',run:()=>G&&openRules(G.mode)},
    {icon:'restart',label:t('restart'),run:()=>restartGame()},
    {icon:'gear',label:t('settings'),run:openSettings}]));
  $('statsBtn').addEventListener('click',openStats);
  $('setBtn').addEventListener('click',openSettings);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&SH){ e.preventDefault(); closeSheet() } },true);
  let rz=0;
  addEventListener('resize',()=>{
    cancelAnimationFrame(rz);
    rz=requestAnimationFrame(()=>{ if(G&&SP&&!$('game').classList.contains('hidden')) layoutGame(); if(SH&&!SH.phone) place(SH) });
  });
  addEventListener('pagehide',writeSes);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) writeSes() });
  renderHome();
  showScreen('home');
  const q=new URLSearchParams(location.search), m=q.get('m'), d=q.get('d');
  if(m&&(MODE_IDS.includes(m)||m==='random')&&DIFFS.includes(d)) newGame(m,d);
}
boot();
