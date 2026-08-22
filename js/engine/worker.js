'use strict';

importScripts('core.js','grade.js','modes.js','numerator.js','kakuro.js');

self.onmessage=e=>{
  const d=e.data||{};
  let r=null, err=null;
  try{ r=makePuzzle(d.mode,d.diff) }catch(ex){ err=String(ex&&ex.message||ex) }
  if(err||!r){ self.postMessage({seq:d.seq, error:err||'empty'}); return }
  self.postMessage({seq:d.seq, mode:r.mode, diff:r.diff, ex:r.ex, sol:r.sol, puz:r.puz, grade:r.grade});
};
