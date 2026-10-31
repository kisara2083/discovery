(()=>{"use strict";
const controlsClear=()=>["query","category","status","date","month"].every(id=>{const n=document.getElementById(id);return !n||!n.value;});
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
const addFocus=()=>{
  if(!controlsClear())return;
  const route=(location.hash||"#home").split("/")[0];
  if(route!=="#home")return;
  const grid=document.querySelector("#content>.grid");
  if(!grid||grid.querySelector(":scope>.editorial-focus"))return;
  const cards=Array.from(grid.children).filter(n=>n.matches?.(".card"));
  if(cards.length<4)return;
  const windowed=cards.slice(2,Math.min(cards.length,7));
  const target=windowed.find(n=>n.querySelector(".world-card"))||cards[3];
  if(!target)return;
  const section=document.createElement("section");section.className="editorial-focus";section.setAttribute("aria-label","In focus");
  const head=document.createElement("div");head.className="editorial-focus-head";
  const strong=document.createElement("strong");strong.textContent="IN FOCUS";
  const note=document.createElement("span");note.textContent=target.querySelector(".world-card")?"A FIELD NOTE FROM THIS EDITION":"ONE STORY, GIVEN MORE ROOM";
  head.append(strong,note);section.append(head);grid.insertBefore(section,target);section.append(target);
};
const scan=()=>{syncMaterial();decorateHeading();addFocus();document.documentElement.dataset.editorialMagazine="1";};
const root=document.querySelector("#content")||document.body;
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
scan();
window.addEventListener("hashchange",schedule);
})();
