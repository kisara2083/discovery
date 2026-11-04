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
  await context.route('**/*',r=>{const q=r.request();if(q.resourceType()==='image')return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#ddd"/></svg>'});if(q.url().startsWith(base))return r.continue();return r.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'#home');
  await eventually(async()=>assert.equal(await page.locator('#content>.grid>.card').count(),12));
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
  assert.ok(await page.locator('.primary-source').getAttribute('href'));assert.equal(await page.locator('.match-context').count(),0);
  await page.goBack();await page.locator('.feed-more').waitFor();
  await eventually(async()=>{const actual=await page.evaluate(()=>scrollY);assert.ok(Math.abs(actual-y)<100,`Home history at ${width}: expected ${y}, got ${actual}; ${await page.evaluate(()=>sessionStorage.getItem('discovery-positions'))}`);});
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
    const img=n.querySelector('img'),link=n.querySelector('a.visual-image-link');
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
  await crop.locator('a.visual-image-link').click();
  await eventually(async()=>assert.ok(page.url().includes('#article/')));
  const detailedCrop=page.locator('.editorial-detail>.primary-visual .quoted-visual.blank-border-trim .visual');
  await eventually(async()=>assert.equal(await detailedCrop.count(),1));
  assert.equal(await detailedCrop.evaluate(n=>getComputedStyle(n).overflow),'hidden');
  assert.deepEqual(errors,[]);await context.close();
 }
 const official=articleSources(data.articles.find(a=>a.id==='a-bb64ec8be3ec294db2858d31'))[0];assert.equal(official.url,'https://smash-jpn.com/live/?id=4751');
 assert.equal(hasPrimarySource({id:'a-580c2384c103eae8ef677a35'}),false);
 console.log('Reading experience passed: desktop, mobile, high DPR, feed, history, archive, sources and filters');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
