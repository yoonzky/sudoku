/* Copyright (C) 2026 yoonzky. AGPL-3.0, see LICENSE */
'use strict';

(()=>{
  let s={};
  try{ s=(JSON.parse(localStorage.getItem('yoondoku-ses'))||{}).settings||{} }catch(e){}
  let lang=s.lang;
  if(lang!=='ru'&&lang!=='en'){
    lang='ru';
    for(const l of navigator.languages||[navigator.language||'ru']){ const p=String(l).slice(0,2).toLowerCase(); if(p==='ru'||p==='en'){ lang=p; break } }
  }
  const q=matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{
    const dark= s.theme==='dark' || (s.theme!=='light' && q.matches);
    document.documentElement.dataset.theme= dark? 'dark' : 'light';
    const m=document.getElementById('metaTheme'); if(m) m.content= dark? '#131417' : '#eceef2';
  };
  apply();
  q.addEventListener('change',apply);
  document.documentElement.lang=lang;
  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    document.getElementById('ru').hidden= lang!=='ru';
    document.getElementById('en').hidden= lang!=='en';
    if(lang==='en') document.title='Yoondoku: privacy policy';
  });
})();
