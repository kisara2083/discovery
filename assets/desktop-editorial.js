(()=>{"use strict";
const BREAKPOINT=1180;
const THREE_COLUMNS=1500;
const TOLERANCE=64;
const PACK_GAP=18;
const active=()=>window.innerWidth>BREAKPOINT;
const columnCount=()=>window.innerWidth>=THREE_COLUMNS?3:2;
const chooseLane=(heights,index)=>{
  const min=Math.min(...heights);
  const preferred=index%heights.length;
  if(heights[preferred]<=min+TOLERANCE)return preferred;
  for(let offset=1;offset<heights.length;offset++){
    const lane=(preferred+offset)%heights.length;
    if(heights[lane]<=min+TOLERANCE)return lane;
  }
  return heights.indexOf(min);
};
const clearPacking=grid=>{
  grid.classList.remove("is-desktop-packed");
  for(const card of grid.querySelectorAll(":scope>.card")){
    card.style.removeProperty("grid-column");
    card.style.removeProperty("grid-row");
  }
};
const syncPortrait=node=>{
  node.classList.remove("is-desktop-extreme-portrait");
  if(!active())return;
  const img=node.querySelector(".card-visual img");
  if(!img||!img.naturalWidth||!img.naturalHeight)return;
  if(img.naturalHeight/img.naturalWidth>2.15)node.classList.add("is-desktop-extreme-portrait");
};
const pack=grid=>{
  clearPacking(grid);
  if(!active())return;
  const cards=[...grid.children].filter(node=>node.classList.contains("card"));
  if(!cards.length)return;
  cards.forEach(syncPortrait);
  const measured=cards.map(card=>Math.ceil(card.getBoundingClientRect().height));
  const lanes=Array(columnCount()).fill(0);
  grid.classList.add("is-desktop-packed");
  cards.forEach((card,index)=>{
    const lane=chooseLane(lanes,index);
    const start=lanes[lane]+1;
    const span=Math.max(1,measured[index]+PACK_GAP);
    card.style.gridColumn=`${lane+1}`;
    card.style.gridRow=`${start} / span ${span}`;
    lanes[lane]+=span;
  });
};
let observed=new WeakSet();
const resizeObserver="ResizeObserver" in window?new ResizeObserver(entries=>{
  if(active()&&entries.length)schedule();
}):null;
const observeCards=()=>{
  if(!resizeObserver)return;
  document.querySelectorAll("#content>.grid>.card").forEach(card=>{
    if(observed.has(card))return;
    observed.add(card);resizeObserver.observe(card);
  });
};
const scan=()=>{
  const hero=document.querySelector("#hero .hero");
  if(hero)syncPortrait(hero);
  const grid=document.querySelector("#content>.grid");
  if(grid)pack(grid);
  observeCards();
  document.documentElement.dataset.desktopEditorial=active()?"2":"0";
};
let queued=false;
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("load",event=>{if(event.target&&event.target.closest&&event.target.closest("#content,#hero"))schedule();},true);
window.addEventListener("resize",schedule,{passive:true});
window.addEventListener("hashchange",schedule);
schedule();
})();
