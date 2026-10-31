(()=>{"use strict";
const sync=()=>{
  const source=document.querySelector(".card,.hero");
  if(!source)return;
  const texture=getComputedStyle(source).getPropertyValue("--material-texture").trim();
  if(texture)document.documentElement.style.setProperty("--feed-material-texture",texture);
};
const root=document.querySelector("#content")||document.body;
new MutationObserver(()=>requestAnimationFrame(sync)).observe(root,{childList:true,subtree:true});
sync();
window.addEventListener("hashchange",()=>requestAnimationFrame(sync));
})();
