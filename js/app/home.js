'use strict';

/* one grid, no headings: the modes stand in the order they get harder to
   explain. Eighteen of them fill six columns by three without a stray tile, and
   the draw stands under the grid on its own, since it is a choice about the
   grid rather than another mode in it */
const MODE_ORDER=['classic','x','evenodd','windoku','asterisk','mosaic',
  'r10','r12','double','wing','butterfly','samurai',
  'killer','dots','suguru','kakuro','numerator','tokki'];
/* the draw shows a board with a question in it, in the same hand as the previews */
const RANDOM_PREV='<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">'+
  '<rect x=".6" y=".6" width="38.8" height="38.8" fill="var(--panel2)" stroke="var(--prev-rule)" stroke-width="1.1"/>'+
  '<path d="M13.7.6v38.8M26.3.6v38.8M.6 13.7h38.8M.6 26.3h38.8" stroke="var(--line)" stroke-width=".8" fill="none"/>'+
  '<text x="20" y="28.6" text-anchor="middle" font-family="Lora,Georgia,serif" font-size="22" font-weight="600" fill="var(--accent)">?</text></svg>';
const LEVEL_N={easy:1,medium:2,hard:3,expert:4};
const LEVEL_RN={easy:'I',medium:'II',hard:'III',expert:'IV'};
let pickedMode='tokki';
let contSel=null;

function renderHome(){
  if(!MODE_IDS.includes(pickedMode)&&pickedMode!=='random') pickedMode='tokki';
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
  /* the newest game sits at the head of the strip */
  list.innerHTML=SES.games.map((g,idx)=>[g,idx]).reverse().map(([g,idx])=>{
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
  let h='<div class="mode-grid" style="--span:6">';
  for(const id of MODE_ORDER){
    const st=statsFor(id,null);
    /* the time under the name says what it is: a bare figure read as anything */
    const note=st.solved? t('bestShort').replace('{t}',fmtTime(st.best)) : '';
    h+=`<button class="mcard${pickedMode===id?' on':''}" data-mode="${id}">
      <span class="mcard-prev">${previewSVG(id)}</span>
      <b>${t('m_'+id)}</b><small>${note}</small></button>`;
  }
  h+='</div>';
  h+=`<button class="rnd-card${pickedMode==='random'?' on':''}" data-mode="random">
    <span class="rnd-prev">${RANDOM_PREV}</span>
    <span class="rnd-txt"><b>${t('m_random')}</b>
      <small>${t('poolCount').replace('{n}',poolList().length)}</small></span></button>`;
  $('modeList').innerHTML=h;
  const on=$('modeList').querySelector('.mcard.on');
  if(on && on.scrollIntoView && !sheetWidth()) on.scrollIntoView({block:'nearest'});
}
function renderModePanel(){
  const m=pickedMode;
  $('mpPrev').innerHTML = m==='random'? previewSVG(poolList()[0]||'classic') : previewSVG(m);
  $('mpName').textContent=t('m_'+m);
  $('mpRules').textContent=t('r_'+m);
  const tag=I18N[SES.settings.lang]&&I18N[SES.settings.lang]['tag_'+m] || I18N.en['tag_'+m] || '';
  $('mpTag').textContent=tag;
  $('mpTag').classList.toggle('hidden', !tag);
  $('mpPool').classList.toggle('hidden', m!=='random');
  $('poolCount').textContent=t('poolCount').replace('{n}',poolList().length);
  let h='';
  for(const d of DIFFS){
    const st = m==='random'? statsFor(null,d) : statsFor(m,d);
    const note = st.solved? t('bestShort').replace('{t}',fmtTime(st.best)) : t('notPlayed');
    h+=`<button class="diff-btn" data-diff="${d}"><i class="lvl${st.solved?' on':''}">${LEVEL_RN[d]}</i><span>${t('d_'+d)}</span><em>${note}</em></button>`;
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
  if(typeof syncUrl==='function') syncUrl(id);
  openSheet();
}

function openPool(){
  const on=new Set(poolList());
  let h='';
  for(const id of MODE_ORDER)
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
