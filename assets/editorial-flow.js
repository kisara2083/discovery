(()=>{"use strict";
const headingLabel=text=>({"Latest Discoveries":"THE CURRENT EDITION","Today · Current Discoveries":"NOW","This Week":"WEEKLY","By Category":"CATEGORY INDEX","Search Discoveries":"SEARCH","The Archive":"ARCHIVE INDEX"})[text]||"DISCOVERY";
const backdropWords=text=>({"Latest Discoveries":["DISCOVERY","FIELD NOTES"],"Today · Current Discoveries":["TODAY","CURRENT"],"This Week":["WEEKLY","DISCOVERY"],"By Category":["CATEGORIES","INDEX"],"Search Discoveries":["SEARCH","DISCOVERY"],"The Archive":["ARCHIVE","EDITIONS"]})[text]||["DISCOVERY","FIELD NOTES"];
const syncMaterial=()=>{
  const source=document.querySelector(".card,.hero");
  if(!source)return;
  const texture=getComputedStyle(source).getPropertyValue("--material-texture").trim();
  if(texture)document.documentElement.style.setProperty("--feed-material-texture",texture);
};
const syncBackdropWords=text=>{
  const [a,b]=backdropWords(text);
  const one=document.querySelector(".editorial-backdrop-a");
  const two=document.querySelector(".editorial-backdrop-b");
  if(one)one.textContent=a;
  if(two)two.textContent=b;
};
const decorateHeading=()=>{
  const h=document.querySelector("#content>.section-title");
  if(!h)return;
  const text=h.textContent.trim();
  h.dataset.editorialLabel=headingLabel(text);
  syncBackdropWords(text);
};
const syncBackdropGeometry=()=>{
  const stage=document.querySelector(".editorial-stage");
  const hero=document.getElementById("hero");
  const content=document.getElementById("content");
  if(!stage||!hero||!content)return;
  const s=stage.getBoundingClientRect();
  const h=hero.getBoundingClientRect();
  const c=content.getBoundingClientRect();
  const heroY=Math.max(0,h.top-s.top-34);
  const contentY=Math.max(0,c.top-s.top);
  const lead=Math.min(168,Math.max(96,window.innerWidth*.15));
  stage.style.setProperty("--backdrop-today-y",`${Math.round(heroY)}px`);
  stage.style.setProperty("--backdrop-a-y",`${Math.round(contentY+lead)}px`);
  stage.style.setProperty("--backdrop-b-y",`${Math.round(contentY+c.height*.56)}px`);
};
const scan=()=>{syncMaterial();decorateHeading();syncBackdropGeometry();document.documentElement.dataset.editorialMagazine="4";};
const root=document.querySelector(".editorial-foreground")||document.body;
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
if("ResizeObserver" in window){const ro=new ResizeObserver(schedule);for(const el of [root,document.getElementById("hero"),document.getElementById("content")])if(el)ro.observe(el);}
scan();
window.addEventListener("resize",schedule,{passive:true});
window.addEventListener("hashchange",schedule);
})();
