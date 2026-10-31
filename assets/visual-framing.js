(()=>{"use strict";
const REVIEWED_BLANK_TRIMS=[
 {src:"prime-video-2026-october-exit8.jpg",top:0,right:.1653,bottom:0,left:.1653},
 {src:"CDnA1GXBmK2ISLah5FoXpqgkvvlyeQ8KQwrY7cKz.jpg",top:.113,right:0,bottom:.103,left:0}
];
const LEAD_WATERMARKS={"Latest Discoveries":"DISCOVERY","Today · Current Discoveries":"TODAY","This Week":"WEEKLY","By Category":"CATEGORIES","Search Discoveries":"SEARCH","The Archive":"ARCHIVE"};
const sourceOf=img=>img.currentSrc||img.getAttribute("src")||"";
const trimState=new WeakMap();
const observed=new WeakSet();
const trimObserver="ResizeObserver" in window?new ResizeObserver(entries=>{for(const entry of entries)layoutTrim(entry.target);}):null;
const layoutTrim=(figure,force=false)=>{
 const state=trimState.get(figure);if(!state)return;
 const {img,visual,rule}=state;if(!img.naturalWidth||!img.naturalHeight)return;
 const width=figure.clientWidth||visual.clientWidth;if(!width)return;
 if(!force&&Math.abs((state.lastWidth||0)-width)<.5)return;
 const visibleW=1-rule.left-rule.right,visibleH=1-rule.top-rule.bottom;
 if(visibleW<=.5||visibleH<=.5)return;
 const fullW=width/visibleW;
 const fullH=fullW*(img.naturalHeight/img.naturalWidth);
 const cropH=fullH*visibleH;
 state.lastWidth=width;
 visual.style.setProperty("height",`${cropH}px`,"important");
 visual.style.setProperty("min-height","0","important");
 visual.style.setProperty("max-height",`${cropH}px`,"important");
 img.style.setProperty("position","absolute","important");
 img.style.setProperty("width",`${fullW}px`,"important");
 img.style.setProperty("height",`${fullH}px`,"important");
 img.style.setProperty("max-width","none","important");
 img.style.setProperty("max-height","none","important");
 img.style.setProperty("left",`${-rule.left*fullW}px`,"important");
 img.style.setProperty("top",`${-rule.top*fullH}px`,"important");
 img.style.setProperty("margin","0","important");
};
const applyReviewedBlankTrim=node=>{
 const img=node.querySelector(".card-visual img");if(!img)return;
 const rule=REVIEWED_BLANK_TRIMS.find(x=>sourceOf(img).includes(x.src));if(!rule)return;
 const figure=img.closest(".quoted-visual");if(!figure)return;
 const visual=img.closest(".visual");if(!visual)return;
 figure.classList.add("blank-border-trim");
 let state=trimState.get(figure);
 if(!state){state={img,visual,rule,lastWidth:0};trimState.set(figure,state);}
 else{state.img=img;state.visual=visual;state.rule=rule;}
 if(trimObserver&&!observed.has(figure)){observed.add(figure);trimObserver.observe(figure);}
 if(img.complete&&img.naturalWidth)layoutTrim(figure,true);
 else if(!img.dataset.blankTrimLoadBound){img.dataset.blankTrimLoadBound="1";img.addEventListener("load",()=>layoutTrim(figure,true),{once:true});}
};
const syncLeadWatermark=()=>{const lead=document.querySelector(".editorial-backdrop-today");if(!lead)return;const heading=document.querySelector("#content>.section-title");const text=heading?heading.textContent.trim():"";const next=LEAD_WATERMARKS[text]||"DISCOVERY";if(lead.textContent!==next)lead.textContent=next;};
const scan=()=>{syncLeadWatermark();document.querySelectorAll(".card,.hero").forEach(applyReviewedBlankTrim);};
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
scan();
})();
