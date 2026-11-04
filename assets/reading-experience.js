/* Ordinary raster images share one resolution policy on cards and details.
 * Reviewed crops, generated World visuals and frames retain their own layout. */
(()=>{
'use strict';
const watched=new WeakSet();
function size(img){
  if(!img.naturalWidth||!img.naturalHeight||img.closest('.blank-border-trim,.world-card,.embed-card'))return;
  // Aim for expressive artwork without unchecked pixel stretching.
  // Cap high-DPI strictness so phone images are not reduced to tiny thumbnails.
  const density=Math.min(1.5,Math.max(1,window.devicePixelRatio||1));
  const detail=!!img.closest('.editorial-detail');
  const scale=(detail?2:1.8)/density;
  const maxWidth=img.naturalWidth*scale;
  const heightLimit=detail?Math.min(innerHeight*.9,900):
    matchMedia('(max-width:760px)').matches?Math.min(innerHeight*.8,720):720;
  const maxHeight=Math.min(img.naturalHeight*scale,heightLimit);
  img.classList.add('resolution-aware');
  for(const [key,value] of Object.entries({'width':'100%','height':'auto','max-width':maxWidth+'px','max-height':maxHeight+'px','object-fit':'contain','margin':'0 auto','position':'static','transform':'none'}))img.style.setProperty(key,value,'important');
}
function scan(){for(const img of document.querySelectorAll('.card-visual img,.primary-visual img,.secondary-visuals img')){if(!watched.has(img)){watched.add(img);img.addEventListener('load',()=>size(img));}size(img);}}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.getElementById('content'),{childList:true,subtree:true});
window.addEventListener('resize',schedule,{passive:true});scan();
function syncCurrentNav(){
  const view=(location.hash||'#home').slice(1).split(/[/?]/)[0]||'home';
  for(const anchor of document.querySelectorAll('header nav a')){
    const target=anchor.hash.slice(1);
    if(target===view)anchor.setAttribute('aria-current','page');
    else anchor.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange',syncCurrentNav);
syncCurrentNav();
const top=document.createElement('button');top.type='button';top.className='scroll-top';top.textContent='↑';
top.setAttribute('aria-label','ページの先頭へ戻る');top.hidden=true;
top.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}));
document.body.append(top);
let topQueued=false;
const syncTop=()=>{topQueued=false;top.hidden=window.scrollY<400;};
window.addEventListener('scroll',()=>{
  if(topQueued)return;topQueued=true;requestAnimationFrame(syncTop);
},{passive:true});
syncTop();
})();
