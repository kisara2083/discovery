"use strict";
(()=>{
 const palette=k=>{k=(k||'').toLowerCase();if(k.includes('music'))return'music';if(k.includes('game'))return'games';if(k.includes('local')||k.includes('experience')||k.includes('exhibition')||k.includes('immersive'))return'local';if(k.includes('automotive')||k.includes('tech'))return'auto';if(k.includes('food')||k.includes('drink'))return'food';if(k.includes('object')||k.includes('shopping')||k.includes('book'))return'shopping';if(k.includes('film')||k.includes('stream'))return'film';if(k.includes('guitar'))return'guitar';return'neutral';};
 const word=p=>({music:'MUSIC',games:'GAMES',local:'LOCAL',auto:'MOBILITY',food:'TASTE',shopping:'OBJECTS',film:'SCREEN',guitar:'GUITAR',neutral:'FIELD NOTE'})[p];
 const apply=n=>{if(n.dataset.worldEditorial==='2')return;const k=n.querySelector('.world-kicker')?.textContent||'';const p=palette(k);n.dataset.worldEditorial='2';n.dataset.worldPalette=p;n.dataset.worldWord=word(p);n.querySelectorAll('.world-art').forEach(x=>x.remove());};
 const decorate=()=>document.querySelectorAll('.world-card').forEach(apply);decorate();new MutationObserver(decorate).observe(document.documentElement,{childList:true,subtree:true});
})();
