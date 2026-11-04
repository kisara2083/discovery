const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {articleSources,hasPrimarySource}=require('../assets/editorial-refresh.js');
const data=require('../data/public-data.json');
const fs=require('node:fs');
const base=process.env.DISCOVERY_TEST_URL||'http://127.0.0.1:8765/';
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
