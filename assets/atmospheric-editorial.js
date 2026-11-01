(()=>{"use strict";
if(window.__discoveryAtmosphericEditorialV1)return;
window.__discoveryAtmosphericEditorialV1=true;
const hero=document.getElementById("hero");
const featuredHeading=document.getElementById("featured-heading");
const toggle=document.getElementById("filter-toggle");
const secondary=document.getElementById("secondary-filters");
const mobile=window.matchMedia("(max-width:760px)");

function syncFeatured(){
 if(featuredHeading)featuredHeading.hidden=!hero||hero.children.length===0;
}

function syncFilterState(){
 if(!toggle)return;
 const active=["status","date","month"].some(id=>{const node=document.getElementById(id);return !!(node&&node.value);});
 toggle.classList.toggle("is-active",active);
 toggle.setAttribute("aria-label",active?"Filters, active":"Filters");
}

function setMobileFilter(open){
 if(!toggle||!secondary)return;
 secondary.hidden=!open;
 toggle.setAttribute("aria-expanded",open?"true":"false");
}

function syncFilterMode(){
 if(!toggle||!secondary)return;
 if(mobile.matches){
   toggle.hidden=false;
   if(secondary.dataset.mobileState!=="open")setMobileFilter(false);
 }else{
   toggle.hidden=true;
   secondary.hidden=false;
   toggle.setAttribute("aria-expanded","true");
 }
}

function syncCategoryCurrent(){
 const hash=location.hash||"#home";
 for(const link of document.querySelectorAll('#taxonomy a[href^="#category/"]')){
   if(link.getAttribute("href")===hash)link.setAttribute("aria-current","page");
   else link.removeAttribute("aria-current");
 }
}

if(toggle&&secondary){
 toggle.addEventListener("click",()=>{
   const open=secondary.hidden;
   secondary.dataset.mobileState=open?"open":"closed";
   setMobileFilter(open);
 });
 for(const id of ["status","date","month"]){
   document.getElementById(id)?.addEventListener("input",syncFilterState);
 }
}

if(hero)new MutationObserver(syncFeatured).observe(hero,{childList:true});
new MutationObserver(syncCategoryCurrent).observe(document.getElementById("taxonomy")||document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>{syncCategoryCurrent();syncFilterState();});
if(typeof mobile.addEventListener==="function")mobile.addEventListener("change",syncFilterMode);
else if(typeof mobile.addListener==="function")mobile.addListener(syncFilterMode);

syncFeatured();
syncFilterState();
syncFilterMode();
syncCategoryCurrent();
})();
