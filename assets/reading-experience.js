/* Ordinary raster images share one resolution policy on cards and details.
 * Reviewed crops, generated World visuals and frames retain their own layout. */
(()=>{
'use strict';
const watched=new WeakSet();
function size(img){
  if(!img.naturalWidth||!img.naturalHeight||img.closest('.blank-border-trim,.world-card,.embed-card'))return;
  const density=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const maxWidth=img.naturalWidth/density*1.1;
  const maxHeight=Math.min(img.naturalHeight/density*1.1,matchMedia('(max-width:760px)').matches?innerHeight*.65:600);
  img.classList.add('resolution-aware');
  for(const [key,value] of Object.entries({'width':'100%','height':'auto','max-width':maxWidth+'px','max-height':maxHeight+'px','object-fit':'contain','margin':'0 auto','position':'static','transform':'none'}))img.style.setProperty(key,value,'important');
}
function scan(){for(const img of document.querySelectorAll('.card-visual img,.primary-visual img,.secondary-visuals img')){if(!watched.has(img)){watched.add(img);img.addEventListener('load',()=>size(img));}size(img);}}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.getElementById('content'),{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});scan();
const top=document.createElement('button');top.type='button';top.className='scroll-top';top.textContent='↑';top.setAttribute('aria-label','ページの先頭へ戻る');
top.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'}));document.body.append(top);
})();
