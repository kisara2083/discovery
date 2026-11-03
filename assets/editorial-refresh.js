(function(root){
'use strict';
const normalize=value=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/[- ]/g,'_');
function categories(article,taxonomy){
  const map=new Map(taxonomy.flatMap(g=>[[normalize(g.id),g.id],[normalize(g.label),g.id]]));
  const values=[...(Array.isArray(article.categories)?article.categories:[]),article.category];
  return [...new Set(values.map(v=>map.get(normalize(v))).filter(Boolean))];
}
function parseRoute(hash){
  const [path,query='']=String(hash||'#home').replace(/^#/,'').split('?');
  const parts=path.split('/').map(s=>{try{return decodeURIComponent(s);}catch{return s;}});
  const p=new URLSearchParams(query); const month=p.get('month')||'';
  return {view:parts[0]||'home',slug:parts[0]==='article'?parts[1]||'':'',category:p.get('category')||(parts[0]==='category'?parts[1]||'':''),
    month:/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:'',query:p.get('q')||'',status:p.get('status')||'',page:Math.max(1,Number.parseInt(p.get('page')||'1',10)||1)};
}
function route(state){
  const path=state.view==='article'?'article/'+encodeURIComponent(state.slug):state.category?'category/'+encodeURIComponent(state.category):state.view||'home';
  const p=new URLSearchParams();
  if(state.view==='article'&&state.category)p.set('category',state.category);
  for(const [key,value] of [['month',state.month],['q',state.query],['status',state.status],['page',state.page>1?String(state.page):'']])if(value)p.set(key,value);
  return '#'+path+(p.size?'?'+p:'');
}
function filter(articles,state,taxonomy){
  const q=state.query.toLocaleLowerCase();const seen=new Set();
  return articles.filter(a=>{
    if(seen.has(a.id))return false; seen.add(a.id);
    return (!state.category||categories(a,taxonomy).includes(state.category))&&
      (!state.month||String(a.updated_date||'').startsWith(state.month))&&
      (!state.status||a.lifecycle===state.status||a.status===state.status)&&
      (!q||[a.title,a.public_summary,a.public_detail,a.venue,a.city,...(a.sources||[]).map(s=>s.name)].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));
  });
}
function paginate(articles,page,size=18){return articles.slice((page-1)*size,page*size);}
const api={categories,parseRoute,route,filter,paginate};
root.DiscoveryEditorial=api;if(typeof module==='object'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
if(root.__discoveryEditorialRefreshV1)return;root.__discoveryEditorialRefreshV1=true;

function dataReady(){return typeof data!=='undefined'&&data&&Array.isArray(data.articles);}
function label(id){return data.taxonomy.find(g=>g.id===id)?.label||id;}
function articleURL(a){return route({...parseRoute(location.hash),view:'article',slug:a.slug,page:1});}
function meta(a){
  const n=el('div',undefined,'meta editorial-meta');
  n.append(el('span',a.lifecycle,'badge'),el('time',a.published_date||a.updated_date,'article-date'));
  for(const id of categories(a,data.taxonomy)){const c=link(label(id),route({...parseRoute(location.hash),view:'category',category:id,page:1}));c.className='category-chip';n.append(c);}
  if(a.sources?.[0])n.append(el('span',a.sources[0].name,'source-label'));
  return n;
}
function realVisual(a,ref,detail=false){
  if(!ref||ref.kind==='world_card')return null;
  if(ref.kind==='image'){
    const image=(a.images||[]).find(i=>imageSelectionKey(i)===ref.key);
    if(!image)return null;
    const slot=el('div',undefined,'real-visual');slot.dataset.visualKey=ref.key;
    slot.append(imageVisual(a,image,new Set(),()=>{const section=slot.closest('.primary-visual,.secondary-visuals');slot.remove();if(section&&!section.children.length)section.remove();}));
    if(!image.quote_context)slot.append(imageCredit(image));
    return slot;
  }
  const media=embedList(a).find(m=>mediaSelectionKey(m)===ref.key);
  return media?(detail?mediaPlayer(media):mediaVisual(media)):null;
}
function detailRefs(a){
  const refs=[selectedRef(a,'detail'),...(a.display_selection?.detail_secondary||[])].filter(r=>r&&r.kind!=='world_card');
  const candidates=[...(a.images||[]).map(image=>({key:imageSelectionKey(image),kind:'image',image})),...embedList(a).map(media=>({key:mediaSelectionKey(media),kind:'media',media}))];
  candidates.sort((a,b)=>cardCompare(a,b,{}));
  const seen=new Set();const ordered=a.display_selection?.selector_version===8?refs:candidates;
  return ordered.filter(r=>{const image=r.kind==='image'&&(a.images||[]).find(i=>imageSelectionKey(i)===r.key);const media=r.kind==='media'&&embedList(a).find(m=>mediaSelectionKey(m)===r.key);const key=image?'image:'+image.url:media?'media:'+media.canonical_url:null;if(!key||seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
}
cardVisual=function(a,failed=new Set()){
  const candidates=[...(a.images||[]).map(image=>({key:imageSelectionKey(image),image})),...embedList(a).filter(cardMediaCapable).map(media=>({key:mediaSelectionKey(media),media}))];
  candidates.sort((x,y)=>cardCompare(x,y,a));
  const preferred=a.display_selection?.selector_version===8?selectedRef(a,'card'):null;
  const candidate=(preferred&&candidates.find(c=>c.key===preferred.key&&!failed.has(c.key)))||candidates.find(c=>!failed.has(c.key));
  if(!candidate&&!a.world_card)return null;
  const n=el('div',undefined,'card-visual');
  if(!candidate){n.append(worldVisual(a));return n;}
  const fallback=()=>{
    failed.add(candidate.key);const replacement=cardVisual(a,failed);
    if(replacement)n.replaceWith(replacement);
    else {const article=n.closest('article');article?.classList.add('text-first');const anchor=n.parentElement?.classList.contains('visual-link')?n.parentElement:null;n.remove();anchor?.remove();}
  };
  n.append(candidate.media?mediaVisual(candidate.media,fallback):imageVisual(a,candidate.image,new Set(),fallback));return n;
};
card=function(a,hero=false){
  const visual=cardVisual(a);const n=el('article',undefined,(hero?'hero':'card')+(visual?' visual-first':' text-first')+(a.lifecycle==='ENDED'?' ended':''));
  n.dataset.articleId=a.id;
  if(visual){if(visual.querySelector('iframe,.embed-card')||visual.querySelector('.quote-credit'))n.append(visual);else{const anchor=link('',articleURL(a));anchor.className='visual-link';anchor.setAttribute('aria-label',a.title);anchor.append(visual);n.append(anchor);}}
  const body=el('div',undefined,'body');body.append(meta(a));const h=el(hero?'h2':'h3');h.append(link(a.title,articleURL(a)));
  body.append(h,el('p',a.public_summary,'summary'),link('READ THE DISCOVERY →',articleURL(a)));n.append(body);return n;
};
detailPrimary=function(a){const ref=detailRefs(a)[0];const visual=realVisual(a,ref,true);if(!visual)return null;const n=el('section',undefined,'primary-visual');n.append(visual);return n;};
detailSecondary=function(a){const n=el('section',undefined,'secondary-visuals');for(const ref of detailRefs(a).slice(1)){const visual=realVisual(a,ref,true);if(visual)n.append(visual);}return n.children.length?n:null;};
detail=function(a){
  const n=el('article',undefined,'detail editorial-detail');n.dataset.articleId=a.id;
  const back=parseRoute(location.hash);back.view=back.category?'category':'archive';back.slug='';
  n.append(link('← DISCOVERIES',route(back)),el('h1',a.title),meta(a));
  const primary=detailPrimary(a);if(primary)n.append(primary);else n.classList.add('text-first');
  n.append(el('p',a.public_summary,'summary lead'));
  if(a.public_detail&&a.public_detail.trim()!==a.public_summary.trim())n.append(detailContext(a));
  const dl=el('dl');for(const [name,key] of [['DATE','event_date'],['VENUE / AREA','venue'],['CITY','city'],['DEADLINE','deadline_at'],['END','end_at'],['PRICE / TERMS','price_terms'],['WHAT’S NEW','whats_new'],['NOTE','note']])if(a[key])dl.append(el('dt',name),el('dd',a[key]));if(dl.children.length)n.append(dl);
  const secondary=detailSecondary(a);if(secondary)n.append(el('h2','VISUAL NOTES','section-title'),secondary);
  const sources=el('section',undefined,'detail-sources');sources.append(el('h2','SOURCES & LINKS','section-title'));const links=el('div',undefined,'links');for(const s of [...(a.sources||[]),...(a.spotify||[])])links.append(link(s.name,s.url));sources.append(links);n.append(sources);
  const related=data.articles.filter(x=>x.id!==a.id&&categories(x,data.taxonomy).some(c=>categories(a,data.taxonomy).includes(c))).slice(0,3);
  if(related.length)n.append(el('h2','RELATED DISCOVERIES','section-title'),grid(related));return n;
};
let lastState=parseRoute(location.hash);
render=function(){
  if(!dataReady())return;const state=parseRoute(location.hash);lastState=state;
  document.querySelector('.intro')?.toggleAttribute('hidden',state.view!=='home');
  if($('category'))$('category').hidden=true;
  for(const [id,value] of [['query',state.query],['category',state.category],['status',state.status],['month',state.month]])if($(id))$(id).value=value;
  if($('date')){$('date').value='';$('date').hidden=true;$('date').closest('.filter-field')?.setAttribute('hidden','');}
  $('month').hidden=state.view==='article';$('month').closest('.filter-field')?.toggleAttribute('hidden',state.view==='article');
  $('hero').replaceChildren();$('content').replaceChildren();
  for(const a of document.querySelectorAll('#taxonomy a')){const s=parseRoute(a.getAttribute('href'));a.href=route({...state,view:'category',category:s.category,page:1});a.toggleAttribute('aria-current',s.category===state.category);if(s.category===state.category)a.setAttribute('aria-current','page');}
  if(state.view==='article'){const article=data.articles.find(a=>a.slug===state.slug);$('content').append(article?detail(article):el('p','Article not found'));if(article)scrollArticleIntoView($('content').firstElementChild);return;}
  let all=data.articles;
  if(state.view==='today'){const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);all=all.filter(a=>a.updated_date===today);}
  if(state.view==='weekly'){const now=new Date(Date.now()+9*3600000);now.setUTCDate(now.getUTCDate()-(now.getUTCDay()+6)%7);const start=now.toISOString().slice(0,10);const end=new Date(now);end.setUTCDate(end.getUTCDate()+7);all=all.filter(a=>a.updated_date>=start&&a.updated_date<end.toISOString().slice(0,10));}
  const articles=filter(all,state,data.taxonomy);const title=state.category?label(state.category):state.view==='home'?'LATEST DISCOVERIES':state.view==='weekly'?'THIS WEEK':state.view==='today'?'TODAY':'THE ARCHIVE';
  const heading=el('h2',title,'section-title');const count=el('p',articles.length+' discoveries'+(state.month?' / '+state.month.replace('-','年')+'月':''),'result-count');
  $('content').append(heading,count,grid(paginate(articles,state.page)));
  const pages=Math.ceil(articles.length/18);if(pages>1){const nav=el('nav',undefined,'pagination');nav.setAttribute('aria-label','Article pages');for(let i=1;i<=pages;i++){const l=link(String(i),route({...state,page:i}));if(i===state.page)l.setAttribute('aria-current','page');nav.append(l);}$('content').append(nav);}
  const reset=link('CLEAR FILTERS','#archive');reset.className='clear-filters';if(state.category||state.month||state.query||state.status)$('content').prepend(reset);
  document.title='DISCOVERY · '+title;
};
document.querySelector('.controls')?.addEventListener('input',event=>{
  if(!['query','category','status','month','date'].includes(event.target.id))return;
  event.stopImmediatePropagation();const state={...lastState,view:lastState.category?'category':'archive',page:1};
  const key={query:'query',category:'category',status:'status',month:'month'}[event.target.id];if(key)state[key]=event.target.value;
  if(event.target.id==='category')state.view=state.category?'category':'archive';
  const hash=route(state);history.replaceState(null,'',hash);render();
},true);
window.addEventListener('hashchange',()=>render());
if(dataReady())render();else new MutationObserver(()=>{if(dataReady())render();}).observe($('taxonomy'),{childList:true});
})(typeof globalThis!=='undefined'?globalThis:this);
