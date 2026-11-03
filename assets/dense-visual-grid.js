(function(){
'use strict';
const mq=window.matchMedia('(min-width:761px)');
const ROW=8,GAP=16;
let raf=0;

function cards(grid){return [...grid.children].filter(n=>n.matches?.('.card,.hero'));}
function reset(item){
  item.style.removeProperty('--masonry-span');
  item.style.removeProperty('grid-column-start');
  item.style.removeProperty('grid-row-start');
}
function columnCount(grid){
  const tracks=getComputedStyle(grid).gridTemplateColumns.trim();
  return tracks?Math.max(1,tracks.split(/\s+/).length):1;
}
function sizeGrid(grid){
  grid.classList.add('masonry-grid');
  const items=cards(grid);
  for(const item of items)reset(item);
  if(!mq.matches)return;

  const columns=columnCount(grid);
  const ends=Array(columns).fill(1);
  // DOM order remains canonical. Each next article is placed in the currently
  // shortest visual column; no random offsets or decorative asymmetry.
  for(const item of items){
    const height=Math.ceil(item.getBoundingClientRect().height);
    const span=Math.max(1,Math.ceil((height+GAP)/(ROW+GAP)));
    let column=0;
    for(let i=1;i<columns;i++)if(ends[i]<ends[column])column=i;
    item.style.setProperty('--masonry-span',String(span));
    item.style.gridColumnStart=String(column+1);
    item.style.gridRowStart=String(ends[column]);
    ends[column]+=span;
  }
}
function refresh(){raf=0;for(const grid of document.querySelectorAll('.grid'))sizeGrid(grid);}
function schedule(){if(raf)return;raf=requestAnimationFrame(refresh);}

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('load',schedule);
document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement)schedule();},true);
if('ResizeObserver' in window){
  const ro=new ResizeObserver(schedule);
  const attach=()=>document.querySelectorAll('.grid>.card,.grid>.hero').forEach(n=>ro.observe(n));
  new MutationObserver(()=>{attach();schedule();}).observe(document.documentElement,{subtree:true,childList:true});
  attach();
}
mq.addEventListener?.('change',schedule);
schedule();
})();
