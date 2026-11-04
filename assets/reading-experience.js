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
  const scale=1.6/density;
  const maxWidth=img.naturalWidth*scale;
  const heightLimit=detail?Math.min(innerHeight*.9,900):
    matchMedia('(max-width:760px)').matches?Math.min(innerHeight*.8,720):720;
  const maxHeight=Math.min(img.naturalHeight*scale,heightLimit);
  img.classList.add('resolution-aware');
  for(const [key,value] of Object.entries({'width':'100%','height':'auto','max-width':maxWidth+'px','max-height':maxHeight+'px','object-fit':'contain','margin':'0 auto','position':'static','transform':'none'}))img.style.setProperty(key,value,'important');
}
function syncDetailLayout(){
  const feature=document.querySelector('#content>.editorial-detail>.detail-feature');
  if(!feature)return;
  const primary=feature.querySelector(':scope > .primary-visual');
  const img=primary?.querySelector('.visual img');
  // Never squeeze iframe/interactive main media into a right sidebar.
  if(!img||!img.naturalWidth||!img.naturalHeight||primary.querySelector('.embed-card,.media-player,.world-card')){
    feature.classList.remove('detail-split');
    return;
  }
  // A reviewed blank-border crop uses its *visible* dimensions, not the
  // original file's whitespace-padded aspect ratio.
  const trimmed=Number(img.closest('.blank-border-trim')?.dataset.visibleAspect);
  const aspect=Number.isFinite(trimmed)&&trimmed>0?trimmed:img.naturalWidth/img.naturalHeight;
  feature.classList.toggle('detail-split',aspect<=1.12);
}
function scan(){
  for(const img of document.querySelectorAll('.card-visual img,.primary-visual img,.secondary-visuals img')){
    if(!watched.has(img)){
      watched.add(img);
      img.addEventListener('load',()=>{size(img);syncDetailLayout();});
    }
    size(img);
  }
  syncDetailLayout();
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.getElementById('content'),{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.getElementById('content'),{subtree:true,attributes:true,attributeFilter:['data-visible-aspect']});
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
