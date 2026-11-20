/* DISCOVERY: random background from a small static room #51 manifest.
 * One choice per document. Failure preserves the default background.
 */
(() => {
  'use strict';
  const MANIFEST='assets/tumblr-backgrounds.json?v=seed-20261121';
  const LAST='discovery:lastTumblrBackgroundId';
  const content=document.getElementById('content');
  if (!content) return;
  function valid(x) {
    if (!x || x.enabled===false || !x.id ||
        typeof x.imageUrl!=='string' || typeof x.postUrl!=='string' ||
        typeof x.credit!=='string') return false;
    try {
      const img=new URL(x.imageUrl), post=new URL(x.postUrl);
      return img.protocol==='https:' && img.hostname==='64.media.tumblr.com' &&
        ['.jpg','.jpeg','.png','.webp'].some(ext=>img.pathname.toLowerCase().endsWith(ext)) &&
        post.protocol==='https:' && post.hostname==='morninghollow51.tumblr.com' &&
        /^\/post\/\d+(\/.*)?$/.test(post.pathname);
    } catch {return false;}
  }
  function choose(data) {
    if(!Array.isArray(data)) return null;
    const active=data.filter(valid);
    if(!active.length) return null;
    let previous='';
    try {previous=localStorage.getItem(LAST)||'';} catch {}
    const alternatives=active.filter(x=>String(x.id)!==previous);
    const pool=alternatives.length?alternatives:active;
    const weight=x=>Number.isFinite(x.weight)&&x.weight>0?x.weight:1;
    let r=Math.random()*pool.reduce((s,x)=>s+weight(x),0);
    for(const x of pool) {r-=weight(x);if(r<=0)return x;}
    return pool[pool.length-1];
  }
  async function select() {
    try {
      const response=await fetch(MANIFEST);
      if(!response.ok) return;
      const item=choose(await response.json());
      if(!item) return;
      const image=new Image();
      image.onload=()=>{
        document.documentElement.style.setProperty('--discovery-background-image','url("'+item.imageUrl+'")');
        const credit=document.querySelector('.discovery-background-credit');
        if(credit) {
          credit.textContent='Background: '+item.credit+' — via room #51';
          credit.href=item.postUrl;
        }
        try {localStorage.setItem(LAST,String(item.id));} catch {}
      };
      image.onerror=()=>{}; // Default CSS background remains.
      image.src=item.imageUrl;
    } catch {} // Default CSS background remains.
  }
  let started=false;
  const observer=new MutationObserver(onListing);
  function onListing() {
    if(started||!content.querySelector(':scope > .grid'))return;
    started=true;
    observer.disconnect();
    select();
  }
  observer.observe(content,{childList:true});
  onListing();
})();
