(()=>{"use strict";
if(window.__discoveryFilterControlsV8)return;
window.__discoveryFilterControlsV8=true;
const targetLabel="イベント";
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
}
function syncMonthVisibility(){
 const input=document.getElementById("month");
 const wrapper=input&&input.closest(".filter-field");
 if(wrapper&&wrapper.hidden!==input.hidden)wrapper.hidden=input.hidden;
}
function apply(){
 wrapField("date","記事の日付");
 wrapField("month","アーカイブ年月");
 relabelCategory();
 syncMonthVisibility();
}
let queued=false;
const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply();});};
apply();
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
})();
