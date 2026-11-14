const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {articleSources,hasPrimarySource,detailMediaLabel,detailMediaGroups}=require('../assets/editorial-refresh.js');
const {rows:detailFactRows,scheduleDescription}=require('../assets/detail-facts.js');
const exampleURL='https://example.com/official';
const exampleFacts={
  sources:[{url:exampleURL,name:'Official'}],
  event_date:'2026-11-18',venue:'Hall A',city:'Tokyo',
  price_terms:'¥2,000',
  public_facts:[{key:'platform',value:'Windows',source_url:exampleURL},
    {key:'streaming_service',value:'Example Streaming',source_url:exampleURL},
    {key:'developer',value:'Test Studio',source_url:'https://invalid.example/foreign'}],
  public_schedule_complete:true,
  public_schedule:[
    {date:'2026-11-18',time:'18:00',venue:'Hall A',city:'Tokyo',source_url:exampleURL},
    {date:'2026-11-19',time:'19:00',venue:'Hall B',city:'Osaka',source_url:exampleURL}]
};
const factRows=detailFactRows(exampleFacts);
assert.equal(factRows[0].kind,'schedule');
assert.equal(factRows[0].schedule.length,2);
assert.equal(scheduleDescription(factRows[0].schedule),'2026-11-18 – 2026-11-19 · 2件');
assert.ok(!factRows.some(x=>x.label==='DATE'||x.label==='VENUE / AREA'||x.label==='CITY'));
assert.deepEqual(factRows.map(x=>x.label),['日程・会場','PRICE / TERMS','対応プラットフォーム','視聴サービス']);
assert.equal(detailFactRows({sources:[],public_facts:[]}).length,0);

const partialExample={...exampleFacts,public_schedule_complete:false};
const partialRows=detailFactRows(partialExample);
assert.deepEqual(partialRows.map(r=>r.label).slice(0,5),
  ['確認できた日程・会場','DATE','VENUE / AREA','CITY','PRICE / TERMS']);
assert.equal(partialRows.find(r=>r.label==='DATE').value,'2026-11-18');
assert.equal(partialRows.find(r=>r.label==='VENUE / AREA').value,'Hall A');
const partialSingle=detailFactRows({
  ...partialExample,public_schedule:[partialExample.public_schedule[0]]
});
assert.equal(partialSingle[0].label,'確認できた日程・会場');
assert.equal(partialSingle.find(r=>r.label==='CITY').value,'Tokyo');


const data=require('../data/public-data.json');
const fs=require('node:fs');
const base=process.env.DISCOVERY_TEST_URL||'http://127.0.0.1:8765/';
// A verified Spotify artist page is not a representative track player.
assert.equal(detailMediaLabel({type:'spotify_embed',canonical_url:'https://open.spotify.com/artist/'+'A'.repeat(22)}),'SPOTIFY · アーティスト');
assert.equal(detailMediaLabel({type:'spotify_embed',canonical_url:'https://open.spotify.com/track/'+'A'.repeat(22)}),'SPOTIFY · 楽曲');
assert.equal(detailMediaLabel({type:'youtube_embed'}),'YOUTUBE · 映像');
const song='media:https://open.spotify.com/track/'+'A'.repeat(22),artist='media:https://open.spotify.com/artist/'+'B'.repeat(22),video='media:https://www.youtube.com/watch?v=abcdefghijk',still='image:https://example.test/still.jpg';
const chosen=[{kind:'image',key:still},{kind:'media',key:artist},{kind:'media',key:song},{kind:'media',key:video}];
const grouped=detailMediaGroups({media:[
 {type:'spotify_embed',canonical_url:artist.slice(6)},
 {type:'spotify_embed',canonical_url:song.slice(6)},
 {type:'youtube_embed',canonical_url:video.slice(6)}]},chosen);
assert.deepEqual(grouped.watch.map(x=>x.key),[video,song,artist]);
assert.deepEqual(grouped.other.map(x=>x.key),[still]);
assert.equal(grouped.watch.length+grouped.other.length,chosen.length);

async function eventually(fn){let error;for(let i=0;i<80;i++){try{return await fn();}catch(e){error=e;await new Promise(r=>setTimeout(r,100));}}throw error;}
(async()=>{
 const browser=await chromium.launch();fs.mkdirSync('test-results',{recursive:true});
 try{
 for(const [width,height,dpr] of [[1440,1000,1],[390,844,2],[360,800,3]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,reducedMotion:'reduce'});
  // Deterministic low-resolution raster-equivalent dimensions; no third-party
  // service availability should decide whether navigation/layout pass CI.
  await context.route('**/*',r=>{const q=r.request();if(q.resourceType()==='image'){const poster=q.url().includes('54603a7134ede63ed6b1d4c0a5c187b802ac8214a1a9cf5898e978132bf76de8');const w=poster?540:200,h=poster?800:100;return r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#ddd"/></svg>`});}if(q.url().startsWith(base))return r.continue();return r.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'#home');
  await eventually(async()=>assert.equal(await page.locator('#content>.grid>.card').count(),12));
  // Historical snapshots without world_card must still get a real World shell.
  // The v8 Detail view remains text-first when no independent media exists.
  const legacyFallback=await page.evaluate(()=>{
    const legacy={id:'a-'+'f'.repeat(24),title:'Legacy Visual fallback',
      public_summary:'Public summary only',images:[],media:[],sources:[]};
    const cardNode=cardVisual(legacy);
    const world=cardNode?.querySelector('.world-card');
    return !!world&&world.textContent.includes('Legacy Visual fallback')&&
      !world.textContent.includes('NO IMAGE')&&detailPrimary(legacy)===null;
  });
  assert.equal(legacyFallback,true,'legacy Card must render World; Detail stays text-first');
  const factsDOM=await page.evaluate(()=>{
    const example={
      sources:[{url:'https://example.com/official',name:'Official'}],
      public_summary:'Lead',public_detail:'Detail',
      public_facts:[{key:'platform',value:'Windows',source_url:'https://example.com/official'}],
      public_schedule:[
        {date:'2026-11-18',time:'18:00',venue:'Hall A',source_url:'https://example.com/official'},
        {date:'2026-11-19',time:'19:00',venue:'Hall B',source_url:'https://example.com/official'}
      ]
    };
    const panel=window.DiscoveryDetailFacts?.render(example,example.sources);
    if(!panel)return null;
    document.body.append(panel);
    const view={
      hasDl:panel.querySelectorAll('dl.detail-facts-list>dt').length===2,
      hasDisclosure:!!panel.querySelector('.detail-schedule>summary'),
      hasTwoDates:panel.querySelectorAll('.detail-schedule li').length===2,
      hasSource:!!panel.querySelector('.detail-facts-sources a[href="https://example.com/official"]'),
      noHtmlInjection:panel.querySelectorAll('script').length===0
    };
    panel.remove();return view;
  });
  assert.ok(factsDOM&&Object.values(factsDOM).every(Boolean),JSON.stringify(factsDOM));
  const detailFactsOrder=await page.evaluate(()=>{
    const item=data.articles.find(a=>a.public_detail&&
      [a.event_date,a.venue,a.price_terms,a.whats_new,a.note].some(Boolean));
    if(!item)return null;
    const root=detail(item);
    const copy=root.querySelector('.detail-feature>.detail-copy');
    if(!copy)return null;
    const children=[...copy.children].map(n=>n.className);
    return {children,
      firstIsFacts:children[0]==='detail-facts',
      aboutIsSecond:children[1]==='detail-context'};
  });
  assert.ok(detailFactsOrder?.firstIsFacts&&detailFactsOrder.aboutIsSecond,
    'Verified facts must precede ABOUT on desktop and mobile '+JSON.stringify(detailFactsOrder));
  const scheduleLabels=await page.evaluate(()=>{
    const official='https://example.com/official',base={
      sources:[{url:official,name:'Official'}],
      public_schedule:[{date:'2026-11-18',source_url:official},
                       {date:'2026-11-19',source_url:official}]
    };
    const full=DiscoveryDetailFacts.render({...base,public_schedule_complete:true});
    const partial=DiscoveryDetailFacts.render({...base,public_schedule_complete:false});
    return [full.querySelector('.detail-schedule summary')?.textContent,
            partial.querySelector('.detail-schedule summary')?.textContent];
  });
  assert.ok(scheduleLabels[0].includes('全日程を表示'));
  assert.ok(scheduleLabels[1].includes('確認できた日程を表示'));
  const singleLabel=await page.evaluate(()=>{
    const source='https://example.com/official';
    const panel=DiscoveryDetailFacts.render({
      sources:[{url:source,name:'Official'}],
      public_schedule:[{date:'2026-11-18',venue:'Hall A',source_url:source}],
      event_date:'2026-11-18',venue:'Hall A',
      public_schedule_complete:false
    });
    return [...panel.querySelectorAll('dt')].map(node=>node.textContent);
  });
  assert.deepEqual(singleLabel,['確認できた日程・会場','DATE','VENUE / AREA']);



  const autoEmbedded=await page.evaluate(()=>{
    const original=window.IntersectionObserver;
    window.IntersectionObserver=class{
      constructor(cb){this.cb=cb;}
      observe(){this.cb([{isIntersecting:true}]);}
      disconnect(){}
    };
    try{
      const cases=[
        ['youtube_embed','https://www.youtube.com/watch?v=abcdefghijk','abcdefghijk'],
        ['spotify_embed','https://open.spotify.com/track/'+'A'.repeat(22),'A'.repeat(22)],
        ['steam_embed','https://store.steampowered.com/app/3239360/','3239360'],
        ['google_books_embed','https://books.google.com/books?id=ABCDEF12','ABCDEF12'],
        ['x_embed','https://x.com/example/status/123456789','123456789']
      ];
      return cases.map(([type,canonical_url,provider_id])=>{
        const node=mediaPlayer({type,canonical_url,provider_id,title:type});
        document.body.append(node);
        const result={
          type,hasTapButton:!!node.querySelector('.player-slot button'),
          hasIframe:!!node.querySelector('.player-slot iframe'),
          hasXQuote:!!node.querySelector('blockquote.twitter-tweet'),
          hasFallbackLink:!!node.querySelector('.media-fallback a'),
          autoplay:(node.querySelector('iframe')?.src||'').includes('autoplay=1')
        };
        node.remove();return result;
      });
    }finally{window.IntersectionObserver=original;}
  });
  for(const provider of autoEmbedded){
    assert.equal(provider.hasTapButton,false,provider.type+' must not require a tap');
    assert.equal(provider.hasFallbackLink,true,provider.type+' must retain official link');
    assert.equal(provider.autoplay,false,provider.type+' must not autoplay');
    assert.equal(provider.type==='x_embed'?provider.hasXQuote:provider.hasIframe,true,
                 provider.type+' must start loading in the viewport');
  }

  // Current Private presentation calls local_family 「イベント」; published
  // snapshots may still carry the old verbose label.
  assert.equal(await page.locator('#taxonomy a[href^="#category/local_family"]').first().textContent(),'イベント');
  assert.equal(await page.locator('#taxonomy').getByText('近場・家族・イベント').count(),0);
  assert.equal(await page.locator('.pagination').count(),0);
  assert.equal(await page.getByText('READ THE DISCOVERY',{exact:false}).count(),0);
  if(width<=760)await page.locator('#filter-toggle').click();
  const controls=await page.locator('#query,#status,#month').evaluateAll(ns=>ns.map(n=>({height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width})));
  controls.forEach(c=>assert.equal(c.height,44));assert.ok(Math.abs(controls[1].width-controls[2].width)<1);
  await eventually(async()=>assert.ok(await page.locator('img.resolution-aware').count()>0));
  const max=await page.locator('img.resolution-aware').first().evaluate(n=>parseFloat(getComputedStyle(n).maxWidth));assert.ok(Math.abs(max-(200*1.6/Math.min(dpr,1.5)))<1);
  assert.ok(await page.locator('.scroll-top').isHidden());
  // The category/status/date line leads the Visual, and quoted images are
  // independently tappable without swallowing the attribution link.
  const firstCard=page.locator('#content>.grid>.card').first();
  const firstOrder=await firstCard.evaluate(n=>[...n.children].map(x=>x.className));
  assert.ok(firstOrder[0].includes('card-meta'));
  assert.ok(await firstCard.locator('.visual-image-link').count()>0);
  assert.equal(await firstCard.locator('.quote-credit').evaluate(n=>getComputedStyle(n).color),'rgb(107, 107, 107)');
  const quoteURL=await firstCard.locator('.quote-credit a').first().getAttribute('href');
  assert.ok(/^https:/.test(quoteURL));
  await firstCard.locator('.visual-image-link').click();
  await eventually(async()=>assert.ok(page.url().includes('#article/')));
  await page.goBack();
  await page.locator('#content>.grid>.card').first().waitFor();
  assert.equal(await page.locator('header nav a[aria-current="page"]').count(),1);
  await page.screenshot({path:`test-results/home-${width}.png`});
  await page.locator('.feed-more').scrollIntoViewIfNeeded();
  await eventually(async()=>assert.ok(await page.locator('#content>.grid>.card').count()>=24));
  const article=page.locator('#content>.grid>.card h3 a').nth(10);await article.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);
  await article.click();await page.locator('.source-access').waitFor();
  // Return navigation no longer interrupts the headline and first-party source.
  const detailOrder=await page.locator('.editorial-detail').evaluate(node=>({
    first:node.firstElementChild?.tagName,
    last:node.lastElementChild?.className,
    returnCount:node.querySelectorAll(':scope > .detail-return > a').length,
    target:node.querySelector(':scope > .detail-return > a')?.getAttribute('href'),
  }));
  assert.equal(detailOrder.first,'H1');
  assert.equal(detailOrder.last,'detail-return');
  assert.equal(detailOrder.returnCount,1);
  assert.ok(detailOrder.target?.startsWith('#home'),JSON.stringify(detailOrder));
  const initialHeadlineTop=await page.locator('.editorial-detail>h1').evaluate(el=>el.getBoundingClientRect().top);
  assert.ok(initialHeadlineTop>=17&&initialHeadlineTop<=36,`Detail headline too close to viewport edge (${width}): ${initialHeadlineTop}`);
  assert.ok(await page.locator('.primary-source').getAttribute('href'));assert.equal(await page.locator('.match-context').count(),0);
  // A previously read detail must not jump back to the last scroll position.
  await page.evaluate(()=>window.scrollTo(0,500));
  await page.goBack();await page.locator('.feed-more').waitFor();
  await eventually(async()=>{const actual=await page.evaluate(()=>scrollY);assert.ok(Math.abs(actual-y)<100,`Home history at ${width}: expected ${y}, got ${actual}; ${await page.evaluate(()=>sessionStorage.getItem('discovery-positions'))}`);});
  // Re-enter the same article from the feed; its own stored position is ignored.
  await article.scrollIntoViewIfNeeded();await article.click();await page.locator('.editorial-detail>h1').waitFor();
  await eventually(async()=>{const t=await page.locator('.editorial-detail>h1').evaluate(el=>el.getBoundingClientRect().top);assert.ok(t>=17&&t<=36,`Repeat detail entry at ${width}: ${t}`);});
  await page.goBack();await page.locator('.feed-more').waitFor();
  await page.locator('header a[href="#archive"]').click();await page.locator('.pagination').waitFor();assert.equal(await page.locator('#content>.grid>.card').count(),18);
  await page.locator('.pagination a').nth(1).click();
  await eventually(async()=>assert.ok(Math.abs(await page.locator('#content>.grid>.card').first().evaluate(n=>n.getBoundingClientRect().top))<2));
  assert.equal(await page.locator('#content>.grid>.card').count(),18);
  const destination=page.locator('#content>.grid>.card h3 a').nth(5);await destination.scrollIntoViewIfNeeded();const archiveY=await page.evaluate(()=>scrollY);await destination.click();await page.locator('.source-access').waitFor();await page.goBack();await page.locator('.pagination').waitFor();
  await eventually(async()=>assert.ok(Math.abs(await page.evaluate(()=>scrollY)-archiveY)<100));
  await page.locator('.scroll-top').waitFor({state:'visible'});await page.locator('.scroll-top').click();await eventually(async()=>assert.equal(await page.evaluate(()=>scrollY),0));
  if(width<=760&&!await page.locator('#month').isVisible())await page.locator('#filter-toggle').click();
  await page.locator('#month').fill('2026-10');await eventually(async()=>assert.ok(page.url().includes('month=2026-10')));await page.reload();await page.locator('#content>.grid').waitFor();assert.equal(await page.locator('#month').inputValue(),'2026-10');
  // 8番出口 contains reviewed white margins in its original bitmap.
  // Assert the central poster is clipped both on cards and in the article,
  // even with the nested source-independent article link.
  await page.goto(base+'#archive?q='+encodeURIComponent('8番出口'));
  const exitCard=page.locator('#content>.grid>.card[data-article-id="a-c79abd6fce19922533af23d3"]');
  await eventually(async()=>assert.equal(await exitCard.count(),1));
  const crop=exitCard.locator('.quoted-visual.blank-border-trim .visual');
  await eventually(async()=>assert.equal(await crop.count(),1));
  await eventually(async()=>assert.ok(await crop.evaluate(n=>n.getBoundingClientRect().height>0)));
  const geometry=await crop.evaluate(n=>{
    const img=n.querySelector('img'),link=n.closest('a.visual-image-link')||n.querySelector('a.visual-image-link');
    const bounds=n.getBoundingClientRect(),source=img.getBoundingClientRect();
    return {overflow:getComputedStyle(n).overflow,
      clipW:bounds.width,clipH:bounds.height,
      sourceW:source.width,offset:bounds.left-source.left,
      clickableHeight:link.getBoundingClientRect().height,
      naturalWidth:img.naturalWidth};
  });
  assert.equal(geometry.overflow,'hidden');
  assert.ok(Math.abs(geometry.clipW-geometry.sourceW*(1-.276-.277))<2,JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.offset-geometry.sourceW*.276)<2,JSON.stringify(geometry));
  assert.ok(geometry.clickableHeight>=geometry.clipH-2,JSON.stringify(geometry));
  assert.ok(geometry.clipW<=geometry.naturalWidth*(1-.276-.277)*1.6/Math.min(dpr,1.5)+2);
  await crop.locator('xpath=ancestor::a[contains(@class,"visual-image-link")]').click();
  await eventually(async()=>assert.ok(page.url().includes('#article/')));
  const detailedCrop=page.locator('.editorial-detail>.detail-feature>.primary-visual .quoted-visual.blank-border-trim .visual');
  await eventually(async()=>assert.equal(await detailedCrop.count(),1));
  assert.equal(await detailedCrop.evaluate(n=>getComputedStyle(n).overflow),'hidden');
  // Primary static poster: full-width headline, summary first, and the
  // poster beside article copy ONLY on a wide PC. Mobile is sequential.
  const tanaka=data.articles.find(a=>a.id==='a-788feea6a14bbb75e319f0c5');
  await page.goto(base+'#article/'+encodeURIComponent(tanaka.slug));
  await page.locator('.editorial-detail>.detail-feature>.primary-visual img').waitFor();
  await eventually(async()=>assert.ok(await page.locator('.detail-feature.detail-split').count()===1));
  const geometry2=await page.locator('.editorial-detail').evaluate(n=>{
    const rect=selector=>{const r=n.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width};};
    return {title:rect(':scope > h1'),meta:rect('.detail-masthead>.editorial-meta'),
      source:rect('.detail-masthead .primary-source'),
      intro:rect('.detail-feature>.detail-intro'),
      visual:rect('.detail-feature>.primary-visual'),
      copy:rect('.detail-feature>.detail-copy'),
      featureDisplay:getComputedStyle(n.querySelector('.detail-feature')).display,
      hasRepeatedSource:!!n.querySelector('.detail-masthead .source-label'),
      hasLeadBeforeVisual:[...n.querySelector('.detail-feature').children][0].classList.contains('detail-intro')};
  });
  assert.ok(geometry2.hasLeadBeforeVisual);
  assert.equal(geometry2.hasRepeatedSource,false);
  if(width>=1200){
    assert.equal(geometry2.featureDisplay,'grid');
    assert.ok(geometry2.visual.left>geometry2.intro.right+15,JSON.stringify(geometry2));
    assert.ok(Math.abs(geometry2.visual.top-geometry2.intro.top)<5,JSON.stringify(geometry2));
    assert.ok(geometry2.source.left>geometry2.meta.left,JSON.stringify(geometry2));
  }else{
    assert.notEqual(geometry2.featureDisplay,'grid');
    assert.ok(geometry2.intro.bottom<=geometry2.visual.top+2,JSON.stringify(geometry2));
    assert.ok(geometry2.visual.bottom<=geometry2.copy.top+2,JSON.stringify(geometry2));
  }
  if(width<=760){
    const titleBreak=await page.locator('.editorial-detail>h1').evaluate(node=>{
      const text=node.firstChild;
      const at=index=>{const range=document.createRange();range.setStart(text,index);range.setEnd(text,index+1);return range.getBoundingClientRect().top;};
      return {wrap:getComputedStyle(node).textWrap,
        last:at(text.textContent.length-1),
        previous:at(text.textContent.length-2)};
    });
    assert.match(titleBreak.wrap,/balance/);
    assert.ok(Math.abs(titleBreak.last-titleBreak.previous)<2,JSON.stringify(titleBreak));
  }
  await page.screenshot({path:`test-results/detail-poster-${width}.png`});
  // Landscape static and main embedded media stay full-width rather than
  // compressing the video or panorama into the right column.
  const wide=data.articles.find(a=>a.id==='a-3cd3a319fcae3c46d14660a2');
  await page.goto(base+'#article/'+encodeURIComponent(wide.slug));
  await eventually(async()=>assert.ok(await page.locator('.detail-feature>.primary-visual img').count()>0));
  assert.equal(await page.locator('.detail-feature.detail-split').count(),0);
  const mediaMain=data.articles.find(a=>a.id==='a-580c2384c103eae8ef677a35');
  await page.goto(base+'#article/'+encodeURIComponent(mediaMain.slug));
  await page.locator('.detail-feature>.primary-visual .media-player').waitFor();
  assert.equal(await page.locator('.detail-feature.detail-split').count(),0);
  // Multiple secondary Visuals, YouTube and Spotify stay one-per-row BELOW
  // the full hero feature, irrespective of the hero's desktop split.
  const mixed=data.articles.find(a=>a.id==='a-f1e0215c8983d548b784c24f');
  await page.goto(base+'#article/'+encodeURIComponent(mixed.slug));
  const extras=page.locator('.editorial-detail>.secondary-visuals');
  await extras.waitFor();
  assert.equal(await extras.locator(':scope > .real-visual,:scope > .media-player').count(),3);
  assert.equal(await extras.locator('.media-player.youtube_embed').count(),1);
  assert.equal(await extras.locator('.media-player.spotify_embed').count(),1);
  assert.equal(await extras.locator('.real-visual').count(),1);
  assert.equal(await extras.locator(':scope > h3.section-title').count(),2);
  assert.equal(await extras.locator(':scope > h3.section-title').first().textContent(),'WATCH & LISTEN');
  const secondaryOrder=await extras.evaluate(n=>[...n.children].map(x=>x.className));
  assert.ok(secondaryOrder.indexOf('media-player youtube_embed')<secondaryOrder.indexOf('real-visual'));
  assert.ok(secondaryOrder.indexOf('media-player spotify_embed')<secondaryOrder.indexOf('real-visual'));
  assert.equal(await extras.locator('.media-player.spotify_embed > h2').first().textContent(),'SPOTIFY · アーティスト');
  const extrasGeometry=await page.locator('.editorial-detail').evaluate(n=>({
    featureBottom:n.querySelector('.detail-feature').getBoundingClientRect().bottom,
    extrasTop:n.querySelector(':scope > .secondary-visuals').getBoundingClientRect().top,
    columns:getComputedStyle(n.querySelector(':scope > .secondary-visuals')).gridTemplateColumns
  }));
  assert.ok(extrasGeometry.extrasTop>extrasGeometry.featureBottom,JSON.stringify(extrasGeometry));
  assert.deepEqual(errors,[]);await context.close();
 }
 const official=articleSources(data.articles.find(a=>a.id==='a-bb64ec8be3ec294db2858d31'))[0];assert.equal(official.url,'https://smash-jpn.com/live/?id=4751');
 assert.equal(hasPrimarySource({id:'a-580c2384c103eae8ef677a35'}),false);
 console.log('Reading experience passed: desktop, mobile, high DPR, feed, history, archive, sources and filters');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
