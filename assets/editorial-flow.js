(()=>{"use strict";
const headingLabel=text=>({"Latest Discoveries":"THE CURRENT EDITION","Today · Current Discoveries":"NOW","This Week":"WEEKLY","By Category":"CATEGORY INDEX","Search Discoveries":"SEARCH","The Archive":"ARCHIVE INDEX"})[text]||"DISCOVERY";
const syncMaterial=()=>{
  const source=document.querySelector(".card,.hero");
  if(!source)return;
  const texture=getComputedStyle(source).getPropertyValue("--material-texture").trim();
  if(texture)document.documentElement.style.setProperty("--feed-material-texture",texture);
};
const decorateHeading=()=>{
  const h=document.querySelector("#content>.section-title");
  if(!h)return;
  h.dataset.editorialLabel=headingLabel(h.textContent.trim());
};
const scan=()=>{syncMaterial();decorateHeading();document.documentElement.dataset.editorialMagazine="2";};
const root=document.querySelector("#content")||document.body;
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
scan();
window.addEventListener("hashchange",schedule);
})();
