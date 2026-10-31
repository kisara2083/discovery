(()=>{"use strict";
if(window.__discoveryFilterControlsV11)return;
window.__discoveryFilterControlsV11=true;
const targetLabel="イベント";
const oldLabel="近場・家族・イベント";
const monthViews=new Set(["home","today","weekly","archive"]);
function wrapField(id,label){
 const input=document.getElementById(id);
 if(!input||input.closest(".filter-field"))return;
 const wrapper=document.createElement("label");
 wrapper.className="filter-field filter-field-"+id;
 wrapper.htmlFor=id;
 const text=document.createElement("span");
 text.className="filter-field-label";
 text.textContent=label;
 input.parentNode.insertBefore(wrapper,input);
 wrapper.append(text,input);
}
function relabelCategory(){
 const select=document.getElementById("category");
 if(select){for(const option of select.options){if(option.value==="local_family"&&option.textContent!==targetLabel)option.textContent=targetLabel;}}
 for(const link of document.querySelectorAll('#taxonomy a[href="#category/local_family"]')){
   if(link.textContent!==targetLabel)link.textContent=targetLabel;
 }
 for(const span of document.querySelectorAll('.meta span:not(.badge)')){
   if(span.textContent===oldLabel)span.textContent=targetLabel;
 }
}
function currentView(){return ((location.hash||"#home").slice(1).split("/")[0]||"home");}
function setHidden(node,value){if(node&&node.hidden!==value)node.hidden=value;}
function syncDateControls(){
 const useMonth=monthViews.has(currentView());
 const date=document.getElementById("date");
 const month=document.getElementById("month");
 const dateWrapper=date&&date.closest(".filter-field");
 const monthWrapper=month&&month.closest(".filter-field");
 if(date){
   setHidden(date,useMonth);
   setHidden(dateWrapper,useMonth);
   if(useMonth&&date.value){
     date.value="";
     date.dispatchEvent(new Event("input",{bubbles:true}));
   }
 }
 if(month){
   setHidden(month,!useMonth);
   setHidden(monthWrapper,!useMonth);
 }
}
function apply(){
 wrapField("date","記事の日付");
 wrapField("month","記事の年月");
 relabelCategory();
 syncDateControls();
}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply();});};
apply();
window.addEventListener("hashchange",schedule);
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
})();
