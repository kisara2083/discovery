(()=>{"use strict";
const REVIEWED_BLANK_TRIMS=[
 {src:"prime-video-2026-october-exit8.jpg",top:0,right:.277,bottom:0,left:.276},
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
 const availableW=figure.clientWidth||visual.clientWidth;if(!availableW)return;
 const visibleW=1-rule.left-rule.right,visibleH=1-rule.top-rule.bottom;
 if(visibleW<=.25||visibleH<=.25)return;
 // The blank margins are part of the source bitmap. Crop the *visible*
 // region, then apply the same 1.6x raster limit as ordinary card/detail art.
 const density=Math.min(1.5,Math.max(1,window.devicePixelRatio||1));
 const scale=1.6/density;
 const detail=!!figure.closest('.editorial-detail');
 const heightLimit=detail?Math.min(window.innerHeight*.9,900):
   window.matchMedia('(max-width:760px)').matches?Math.min(window.innerHeight*.8,720):720;
 const cropNaturalW=img.naturalWidth*visibleW;
 const cropNaturalH=img.naturalHeight*visibleH;
 const displayW=Math.min(availableW,cropNaturalW*scale,heightLimit*cropNaturalW/cropNaturalH);
 if(!Number.isFinite(displayW)||displayW<=0)return;
 if(!force&&Math.abs((state.lastWidth||0)-availableW)<.5&&
   Math.abs((state.lastDisplayW||0)-displayW)<.5)return;
 const fullW=displayW/visibleW;
 const fullH=fullW*(img.naturalHeight/img.naturalWidth);
 const cropH=fullH*visibleH;
 state.lastWidth=availableW;state.lastDisplayW=displayW;
 visual.style.setProperty("position","relative","important");
 visual.style.setProperty("display","block","important");
 visual.style.setProperty("width",`${displayW}px`,"important");
 visual.style.setProperty("height",`${cropH}px`,"important");
 visual.style.setProperty("min-height","0","important");
 visual.style.setProperty("max-height",`${cropH}px`,"important");
 visual.style.setProperty("aspect-ratio","auto","important");
 visual.style.setProperty("overflow","hidden","important");
 visual.style.setProperty("margin","0 auto","important");
 // Quoted card images are wrapped in a dedicated article link. Keep its hit
 // area as tall as the cropped image rather than letting absolute img collapse it.
 const anchor=visual.closest("a.visual-image-link")||
   visual.querySelector(":scope > a.visual-image-link");
 if(anchor){
   anchor.style.setProperty("display","block","important");
   anchor.style.setProperty("width","100%","important");
   anchor.style.setProperty("position","relative","important");
   if(anchor.contains(visual)){
     // The normal quoted-image link WRAPS the fixed-height viewport. Do
     // not force a percentage height on this auto-height outer link.
     anchor.style.setProperty("height","auto","important");
   }else{
     anchor.style.setProperty("height","100%","important");
     anchor.style.setProperty("overflow","hidden","important");
   }
 }
 img.style.setProperty("position","absolute","important");
 img.style.setProperty("width",`${fullW}px`,"important");
 img.style.setProperty("height",`${fullH}px`,"important");
 img.style.setProperty("max-width","none","important");
 img.style.setProperty("max-height","none","important");
 img.style.setProperty("left",`${-rule.left*fullW}px`,"important");
 img.style.setProperty("top",`${-rule.top*fullH}px`,"important");
 img.style.setProperty("margin","0","important");
};
const applyReviewedBlankTrim=figure=>{
 const img=figure.querySelector(".visual img");if(!img)return;
 const rule=REVIEWED_BLANK_TRIMS.find(x=>sourceOf(img).includes(x.src));if(!rule)return;
 const visual=img.closest(".visual");if(!visual)return;
 figure.classList.add("blank-border-trim");
 img.dataset.blankTrim="1";
 // A raster may have loaded before the trim class was attached.
 img.classList.remove("resolution-aware");
 let state=trimState.get(figure);
 if(!state){state={img,visual,rule,lastWidth:0,lastDisplayW:0};trimState.set(figure,state);}
 else{state.img=img;state.visual=visual;state.rule=rule;}
 if(trimObserver&&!observed.has(figure)){observed.add(figure);trimObserver.observe(figure);}
 if(img.complete&&img.naturalWidth)layoutTrim(figure,true);
 else if(!img.dataset.blankTrimLoadBound){img.dataset.blankTrimLoadBound="1";img.addEventListener("load",()=>layoutTrim(figure,true),{once:true});}
};
const syncLeadWatermark=()=>{const lead=document.querySelector(".editorial-backdrop-today");if(!lead)return;const heading=document.querySelector("#content>.section-title");const text=heading?heading.textContent.trim():"";const next=LEAD_WATERMARKS[text]||"DISCOVERY";if(lead.textContent!==next)lead.textContent=next;};
const scan=()=>{syncLeadWatermark();document.querySelectorAll(".quoted-visual").forEach(applyReviewedBlankTrim);};
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
window.addEventListener("resize",schedule,{passive:true});
scan();
})();
