'use strict';
cardVisual=function(a,failed=new Set()){
  const n=el('div',undefined,'card-visual');
  const media=embedList(a);
  const images=a.images||[];
  const primary=selectedRef(a,'card');
  const render=(candidate)=>{
    const fallback=()=>{failed.add(candidate.key);n.replaceChildren(cardVisual(a,failed));};
    if(candidate.media)n.append(mediaVisual(candidate.media,fallback));
    else if(candidate.image)n.append(imageVisual(a,candidate.image,new Set(),fallback));
    else n.append(worldVisual(a));
    return n;
  };
  if(primary&&!failed.has(primary.key)){
    if(primary.kind==='world_card'&&a.world_card?.key===primary.key)return render({key:primary.key,world:true});
    if(primary.kind==='image'){
      const i=images.find(x=>imageSelectionKey(x)===primary.key);
      if(i)return render({key:primary.key,image:i});
    }
    if(primary.kind==='media'){
      const m=media.find(x=>mediaSelectionKey(x)===primary.key);
      if(m&&cardMediaCapable(m))return render({key:primary.key,media:m});
    }
  }
  const refs=[selectedRef(a,'detail'),...(a.display_selection?.detail_secondary||[])].filter(Boolean);
  const candidates=[];
  for(const r of refs){
    if(r.kind==='media'){
      const m=media.find(x=>mediaSelectionKey(x)===r.key);
      if(m&&cardMediaCapable(m))candidates.push({key:r.key,media:m});
    }else if(r.kind==='image'){
      const i=images.find(x=>imageSelectionKey(x)===r.key);
      if(i)candidates.push({key:r.key,image:i});
    }
  }
  for(const m of media)if(cardMediaCapable(m))candidates.push({key:mediaSelectionKey(m),media:m});
  for(const i of images)candidates.push({key:imageSelectionKey(i),image:i});
  candidates.sort((x,y)=>cardCompare(x,y,a));
  const candidate=candidates.find(c=>!failed.has(c.key));
  return candidate?render(candidate):render({key:'world:'+a.id,world:true});
};
