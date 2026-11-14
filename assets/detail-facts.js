'use strict';
/* Public-only Detail facts view. Source-grounded facts are inert data,
   never HTML. This module may also be required by offline Node tests. */
(function(root){
  const LABELS=Object.freeze({
    announcement_date:'発表日',organizer:'主催・提供',performers:'出演者',
    program:'内容・プログラム',admission:'入場・参加条件',
    release_date:'公開・発売日',availability_start:'提供開始',
    platform:'対応プラットフォーム',store:'販売・配信先',
    streaming_service:'視聴サービス',runtime:'上映・再生時間',
    format:'作品・提供形式',edition:'版・エディション',
    developer:'開発',publisher:'発売・配信元',
    manufacturer:'メーカー',model:'型番・製品名',
    specification:'主な仕様',compatibility:'対応機種・環境',
    availability:'販売・提供状況',eligibility:'利用・購入条件',
    region:'対象地域',address:'住所・所在地',ticket:'チケット',offer_period:'対象期間',
    distribution:'配信・提供方法',change:'主な変更点'
  });
  const BASIC=[
    ['DATE','event_date'],['VENUE / AREA','venue'],['CITY','city'],
    ['DEADLINE','deadline_at'],['END','end_at'],['PRICE / TERMS','price_terms']
  ];
  const SUPPLEMENTAL=[['WHAT’S NEW','whats_new'],['NOTE','note']];
  const validUrl=s=>typeof s==='string'&&/^https?:\/\/[^\s/?#]+(?:[^\s]*)?$/.test(s);
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
  const nonempty=s=>typeof s==='string'&&!!s.trim();
  function rows(article){
    const a=article||{},result=[],urls=new Set((a.sources||[]).map(s=>s?.url).filter(validUrl));
    const planned=Array.isArray(a.public_schedule)?a.public_schedule.filter(s=>
      s&&validDate(s.date)&&validUrl(s.source_url)&&urls.has(s.source_url)&&
      [s.time,s.venue,s.city,s.channel].every(v=>v===undefined||nonempty(v))):[];
    const unique=new Map();
    for(const item of planned){
      const key=[item.date,item.time||'',item.venue||'',item.city||'',item.channel||''].join('|');
      if(!unique.has(key))unique.set(key,item);
    }
    const schedule=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||
      (a.time||'').localeCompare(b.time||''));
    if(schedule.length){
      result.push({kind:'schedule',label:'日程・会場',schedule,source_urls:[...new Set(schedule.map(s=>s.source_url))]});
    }
    const suppress=new Set(schedule.length?['event_date','venue','city','end_at']:[]);
    const addFixed=([label,key])=>{
      if(!suppress.has(key)&&nonempty(a[key]))
        result.push({kind:'text',label,value:a[key].trim(),source_urls:[]});
    };
    BASIC.forEach(addFixed);
    const seen=new Set();
    for(const fact of (Array.isArray(a.public_facts)?a.public_facts:[])){
      if(!fact||!Object.hasOwn(LABELS,fact.key)||seen.has(fact.key)||
         !nonempty(fact.value)||!validUrl(fact.source_url)||!urls.has(fact.source_url))continue;
      seen.add(fact.key);
      result.push({kind:'text',label:LABELS[fact.key],value:fact.value.trim(),
        source_urls:[fact.source_url]});
    }
    SUPPLEMENTAL.forEach(addFixed);
    return result;
  }
  function scheduleDescription(items){
    const first=items[0].date,last=items[items.length-1].date;
    return (first===last?first:first+' – '+last)+' · '+items.length+'件';
  }
  function scheduleLine(s){
    const places=[s.venue,s.city].filter(nonempty).join(' / ');
    return [s.date,s.time,places,s.channel].filter(nonempty).join(' · ');
  }
  function render(article,sourceList){
    const model=rows(article);
    if(!model.length)return null;
    const section=el('section',undefined,'detail-facts');
    section.setAttribute('aria-label','記事の確認情報');
    section.append(el('h2','AT A GLANCE','section-title'));
    const dl=el('dl',undefined,'detail-facts-list');
    for(const item of model){
      const dt=el('dt',item.label),dd=el('dd');
      if(item.kind==='schedule'){
        if(item.schedule.length===1)dd.append(el('span',scheduleLine(item.schedule[0])));
        else{
          const disclosure=el('details',undefined,'detail-schedule');
          const summary=el('summary',scheduleDescription(item.schedule)+'　全日程を表示');
          disclosure.append(summary);
          const list=el('ol');
          for(const entry of item.schedule)list.append(el('li',scheduleLine(entry)));
          disclosure.append(list);dd.append(disclosure);
        }
      }else dd.textContent=item.value;
      dl.append(dt,dd);
    }
    section.append(dl);
    const sources=[...new Map((Array.isArray(sourceList)?sourceList:article.sources||[])
      .filter(s=>s&&validUrl(s.url)&&nonempty(s.name)).map(s=>[s.url,s])).values()];
    if(sources.length){
      const footer=el('div',undefined,'detail-facts-sources');
      footer.append(el('span','情報の参照元：','detail-facts-source-label'));
      footer.append(link(sources[0].name,sources[0].url));
      if(sources.length>1){
        const more=el('details');
        more.append(el('summary','その他の出典（'+(sources.length-1)+'）'));
        const links=el('div',undefined,'detail-facts-source-links');
        for(const source of sources.slice(1))links.append(link(source.name,source.url));
        more.append(links);footer.append(more);
      }
      section.append(footer);
    }
    return section;
  }
  const api={rows,scheduleDescription,scheduleLine,render,LABELS};
  if(root)root.DiscoveryDetailFacts=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
