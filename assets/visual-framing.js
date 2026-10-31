(()=>{"use strict";
const REVIEWED_BLANK_TRIMS=[
 {article:"a-c79abd6fce19922533af23d3",src:"prime-video-2026-october-exit8.jpg",width:"149.4%",left:"-24.7%"}
];
const LEAD_WATERMARKS={"Latest Discoveries":"DISCOVERY","Today · Current Discoveries":"TODAY","This Week":"WEEKLY","By Category":"CATEGORIES","Search Discoveries":"SEARCH","The Archive":"ARCHIVE"};
const articleSlug=node=>{const a=node.querySelector('a[href^="#article/"]');return a?a.getAttribute("href").slice(9):"";};
const sourceOf=img=>img.currentSrc||img.getAttribute("src")||"";
const applyReviewedBlankTrim=node=>{const slug=articleSlug(node);const img=node.querySelector(".card-visual img");if(!slug||!img)return;const rule=REVIEWED_BLANK_TRIMS.find(x=>x.article===slug&&sourceOf(img).includes(x.src));if(!rule)return;const figure=img.closest(".quoted-visual");if(!figure)return;figure.classList.add("blank-border-trim");figure.style.setProperty("--blank-trim-width",rule.width);figure.style.setProperty("--blank-trim-left",rule.left);};
const syncLeadWatermark=()=>{const lead=document.querySelector(".editorial-backdrop-today");if(!lead)return;const heading=document.querySelector("#content>.section-title");const text=heading?heading.textContent.trim():"";const next=LEAD_WATERMARKS[text]||"DISCOVERY";if(lead.textContent!==next)lead.textContent=next;};
const scan=()=>{syncLeadWatermark();document.querySelectorAll(".card,.hero").forEach(applyReviewedBlankTrim);};
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
scan();
})();
