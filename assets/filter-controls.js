(()=>{"use strict";
if(window.__discoveryFilterControlsV9)return;
window.__discoveryFilterControlsV9=true;
const targetLabel="イベント";
const oldLabel="近場・家族・イベント";
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
function isArchive(){return (location.hash||"#home").startsWith("#archive");}
function syncDateControls(){
 const archive=isArchive();
 const date=document.getElementById("date");
 const month=document.getElementById("month");
 const dateWrapper=date&&date.closest(".filter-field");
 const monthWrapper=month&&month.closest(".filter-field");
 if(date){
   date.hidden=archive;
   if(dateWrapper)dateWrapper.hidden=archive;
   if(archive&&date.value){
     date.value="";
     date.dispatchEvent(new Event("input",{bubbles:true}));
   }
 }
 if(month){
   month.hidden=!archive;
   if(monthWrapper)monthWrapper.hidden=!archive;
 }
}
function apply(){
 wrapField("date","記事の日付");
 wrapField("month","アーカイブ年月");
 relabelCategory();
 syncDateControls();
}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply();});};
apply();
window.addEventListener("hashchange",schedule);
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
})();
