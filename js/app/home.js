'use strict';

const MODE_GROUPS=[
  {key:'clean', ids:['classic','x','evenodd','windoku','asterisk','mosaic']},
  {key:'size',  ids:['r10','r12']},
  {key:'multi', ids:['double','wing','butterfly','samurai']},
  {key:'extra', ids:['killer','dots','suguru','numerator','kakuro','meow']},
];
const DICE='<svg class="dice" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>';
const LEVEL_N={easy:1,medium:2,hard:3,expert:4};
let pickedMode='classic';
let contSel=null;

function renderHome(){
  if(!MODE_IDS.includes(pickedMode)&&pickedMode!=='random') pickedMode='classic';
  renderContinue(); renderModeList(); renderModePanel(); renderTotals();
}
function renderContinue(){
  const list=$('contList');
  const has=SES.games.length>0;
  $('continueCard').style.display=has? '' : 'none';
  if(!has) contSel=null;
  const picking=!!contSel;
  if(contSel) for(const id of [...contSel]) if(!SES.games.some(g=>g.id===id)) contSel.delete(id);
  $('contBar').classList.toggle('hidden',!picking);
  $('contPick').classList.toggle('hidden',picking);
  $('contPick').textContent=t('pickMany');
  if(picking) $('contCount').textContent=t('selCount').replace('{n}',contSel.size);
  list.innerHTML=SES.games.map((g,idx)=>{
    const n=g.solution.length;
    const filled=g.values.filter(v=>v).length+g.hyp.filter(v=>v).length;
    const on=picking&&contSel.has(g.id);
    return `<button class="cont-card${on?' on':''}" data-idx="${idx}" data-id="${g.id}">
      <b>${t('m_'+g.mode)}</b><span>${t('d_'+g.diff)} · ${filled}/${n}</span>
      <small>${fmtTime(g.time)}</small>
      ${picking? `<i class="cbox${on?' on':''}"></i>`
        : `<i class="cont-x" data-del="${idx}"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></i>`}
    </button>`;
  }).join('');
}
function contPickStart(){ contSel=new Set(); renderContinue() }
function contPickStop(){ contSel=null; renderContinue() }
function contToggle(id){
  if(!contSel) return;
  if(contSel.has(id)) contSel.delete(id); else contSel.add(id);
  renderContinue();
}
function contMark(all){
  if(!contSel) return;
  contSel = all? new Set(SES.games.map(g=>g.id)) : new Set();
  renderContinue();
}
async function contDelete(){
  if(!contSel||!contSel.size) return;
  const all=contSel.size===SES.games.length;
  const ask = all? t('delAllConfirm') : t('delSelConfirm').replace('{n}',contSel.size);
  if(!await askConfirm(ask)) return;
  const curId=SES.cur>=0? SES.games[SES.cur].id : null;
  SES.games=SES.games.filter(g=>!contSel.has(g.id));
  SES.cur = curId? SES.games.findIndex(g=>g.id===curId) : -1;
  contSel=null;
  persistNow(); renderHome(); toast(t('delDone'));
}
function renderModeList(){
  let h=`<button class="mrand${pickedMode==='random'?' on':''}" data-mode="random">${DICE}
    <b>${t('m_random')}</b><small>${t('poolCount').replace('{n}',poolList().length)}</small></button>`;
  h+='<div class="mgroups">';
  for(const grp of MODE_GROUPS){
    h+=`<section class="mgrp" style="--span:${grp.ids.length}"><div class="mgroup">${t('g_'+grp.key)}</div><div class="mode-grid">`;
    for(const id of grp.ids){
      const st=statsFor(id,null);
      const note=st.solved? fmtTime(st.best) : '';
      h+=`<button class="mcard${pickedMode===id?' on':''}" data-mode="${id}">
        <span class="mcard-prev">${previewSVG(id)}</span>
        <b>${t('m_'+id)}</b><small>${note}</small></button>`;
    }
    h+='</div></section>';
  }
  $('modeList').innerHTML=h+'</div>';
  const on=$('modeList').querySelector('.mcard.on');
  if(on && on.scrollIntoView && !isPhone()) on.scrollIntoView({block:'nearest'});
}
function renderModePanel(){
  const m=pickedMode;
  $('mpPrev').innerHTML = m==='random'? previewSVG(poolList()[0]||'classic') : previewSVG(m);
  $('mpName').textContent=t('m_'+m);
  $('mpRules').textContent=t('r_'+m);
  $('mpPool').classList.toggle('hidden', m!=='random');
  $('poolCount').textContent=t('poolCount').replace('{n}',poolList().length);
  let h='';
  for(const d of DIFFS){
    const st = m==='random'? statsFor(null,d) : statsFor(m,d);
    const note = st.solved? `${st.solved} · ${fmtTime(st.best)}` : t('notPlayed');
    const bars=[1,2,3,4].map(k=>`<b class="${k<=LEVEL_N[d]?'on':''}"></b>`).join('');
    h+=`<button class="diff-btn" data-diff="${d}"><i class="lvl">${bars}</i><span>${t('d_'+d)}</span><em>${note}</em></button>`;
  }
  $('diffGrid').innerHTML=h;
}
function renderTotals(){
  let won=0,perfect=0,total=0;
  for(const g of allGames()){
    won++; total+=g.time;
    if(g.mistakes===0&&g.hints===0) perfect++;
  }
  $('tot-won').textContent=won;
  $('tot-perfect').textContent=perfect;
  $('tot-time').textContent=total? fmtTime(total) : '—';
}
function pickMode(id){
  pickedMode=id;
  SES.settings.mode=id; persistCache();
  renderModeList(); renderModePanel();
  openSheet();
}

function openPool(){
  const on=new Set(poolList());
  let h='';
  for(const grp of MODE_GROUPS) for(const id of grp.ids)
    h+=`<label class="pool-item"><input type="checkbox" data-m="${id}"${on.has(id)?' checked':''}><span>${t('m_'+id)}</span></label>`;
  $('poolGrid').innerHTML=h;
  $('poolModal').classList.remove('hidden');
}
function savePool(){
  const picked=[...document.querySelectorAll('#poolGrid input')].filter(i=>i.checked).map(i=>i.dataset.m);
  if(!picked.length){ toast(t('poolEmpty')); return false }
  SES.settings.pool = picked.length===MODE_IDS.length? null : picked;
  persistCache(); renderModeList(); renderModePanel();
  return true;
}
