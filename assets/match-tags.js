'use strict';
(()=>{
 const root=document.getElementById('content');
 if(!root)return;
 function renderMatchTags(){
  const detail=root.querySelector('article.detail');
  if(!detail||detail.querySelector('.match-context')||!location.hash.startsWith('#article/'))return;
  const slug=location.hash.slice('#article/'.length).split('/')[0];
  const article=(typeof data!=='undefined'&&data&&Array.isArray(data.articles))?data.articles.find(a=>a.slug===slug):null;
  const tags=article&&Array.isArray(article.match_tags)?article.match_tags.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];
  if(!tags.length)return;
  const section=el('section',undefined,'match-context');
  section.setAttribute('aria-label','DISCOVERY match');
  section.append(el('h2','MATCH','section-title'));
  const list=el('div',undefined,'match-tags');
  for(const tag of tags)list.append(el('span',tag,'match-tag'));
  section.append(list);
  const links=detail.querySelector('.links');
  if(links)detail.insertBefore(section,links);else detail.append(section);
 }
 const observer=new MutationObserver(()=>requestAnimationFrame(renderMatchTags));
 observer.observe(root,{childList:true});
 window.addEventListener('hashchange',()=>requestAnimationFrame(renderMatchTags));
 requestAnimationFrame(renderMatchTags);
})();
