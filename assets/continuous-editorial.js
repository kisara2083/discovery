'use strict';
(()=>{
 const active=()=>matchMedia('(max-width:1180px)').matches;
 const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
 const palette=['#e8e3d8','#e1e6dc','#e7ddd6','#dde5e5','#e6e0e8','#e8e1d2','#dfe4d8'];
 const fallback=n=>palette[hash(n.querySelector('h2,h3')?.textContent||n.textContent||'discovery')%palette.length];
 const rgbToHsl=(r,g,b)=>{r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0,s=0,l=(max+min)/2;if(d){s=d/(1-Math.abs(2*l-1));if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);if(h<0)h+=360;}return[h,s*100,l*100];};
 const editorial=(r,g,b)=>{const [h,s]=rgbToHsl(r,g,b);const sat=Math.max(8,Math.min(22,s*.38));return `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% 88%)`;};
 const sample=img=>{const c=document.createElement('canvas');c.width=16;c.height=16;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,16,16);const d=x.getImageData(0,0,16,16).data;let r=0,g=0,b=0,w=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<128)continue;const hi=Math.max(d[i],d[i+1],d[i+2]),lo=Math.min(d[i],d[i+1],d[i+2]);if(hi>248&&lo>244)continue;r+=d[i];g+=d[i+1];b+=d[i+2];w++;}if(!w)throw new Error('no_color');return editorial(r/w,g/w,b/w);};
 const applyImage=(card,img)=>{if(!img.naturalWidth||!img.naturalHeight)return;const ratio=img.naturalHeight/img.naturalWidth;card.classList.toggle('is-extreme-portrait',ratio>2.15);let bg=fallback(card);try{bg=sample(img);}catch(_){/* external image without canvas access */}card.style.setProperty('--editorial-bg',bg);card.dataset.editorialReady='1';};
 const decorate=card=>{if(!active())return;const img=card.querySelector('.card-visual img');if(!img){card.style.setProperty('--editorial-bg',fallback(card));card.dataset.editorialReady='1';return;}if(img.complete&&img.naturalWidth){applyImage(card,img);return;}if(card.dataset.editorialPending==='1')return;card.dataset.editorialPending='1';img.addEventListener('load',()=>applyImage(card,img),{once:true});img.addEventListener('error',()=>{card.style.setProperty('--editorial-bg',fallback(card));card.dataset.editorialReady='1';},{once:true});};
 const scan=()=>document.querySelectorAll('.card,.hero').forEach(decorate);
 scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});addEventListener('resize',scan,{passive:true});
})();
