(()=>{"use strict";
if(window.__discoveryNavigationViewsV6)return;
window.__discoveryNavigationViewsV6=true;
if(typeof render!=="function"||typeof filtered!=="function"||typeof grid!=="function")return;
const baseRender=render;
const jstToday=()=>new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
const weekBounds=ymd=>{const d=new Date(ymd+"T00:00:00Z");const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);const start=d.toISOString().slice(0,10);const end=new Date(d);end.setUTCDate(end.getUTCDate()+7);return [start,end.toISOString().slice(0,10)];};
render=function(){
 if(!data)return;
 const parts=(location.hash||"#home").slice(1).split("/");
 const view=parts[0];
 if(view==="article")return baseRender();
 $("hero").replaceChildren();
 $("content").replaceChildren();
 $("month").hidden=view!=="archive";
 if(view==="category"&&parts[1])$("category").value=parts[1];
 let articles=data.articles;
 const explicitEnded=$("status").value==="ENDED";
 if(["home","today","weekly"].includes(view)&&!explicitEnded)articles=articles.filter(a=>a.lifecycle!=="ENDED");
 const today=jstToday();
 if(view==="today")articles=articles.filter(a=>a.updated_date===today);
 if(view==="weekly"){
   const [start,end]=weekBounds(today);
   articles=articles.filter(a=>a.updated_date>=start&&a.updated_date<end);
 }
 articles=filtered(articles);
 if(view==="home"&&!$("query").value&&!$("category").value&&!$("status").value&&!$("date").value){
   const a=data.articles.find(a=>a.id===data.todays_pick&&a.lifecycle!=="ENDED");
   if(a)$("hero").append(card(a,true));
 }
 const heading=({home:"Latest Discoveries",today:"Today · Current Discoveries",weekly:"This Week",category:"By Category",search:"Search Discoveries",archive:"The Archive"})[view]||"Discoveries";
 const visible=view==="home"?homeArticles(articles).slice(0,12):articles;
 $("content").append(el("h2",heading,"section-title"),grid(visible));
 if(view==="home"&&homeArticles(articles).length>12)$("content").append(link("MORE DISCOVERIES →","#archive"));
 document.title="DISCOVERY · "+view;
};
if(typeof data!=="undefined"&&data)render();
})();
