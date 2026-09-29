/* SPDX-License-Identifier: MIT */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1060},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text()+' '+e.location().url);});
  const url=process.env.SITE_URL?new URL('labs/gravity.html',process.env.SITE_URL).href:'file://'+path.join(root,'docs/labs/gravity.html');
  await page.goto(url);await page.waitForLoadState('networkidle');await page.locator('#yam-gravity-explorer[data-ready="true"]').waitFor();
  const snapshot=()=>page.evaluate(()=>yamGravitySnapshot());
  let before=await snapshot();
  assert.equal(await page.locator('[data-response]').count(),6);
  await page.selectOption('#yg-driver','3');await page.click('#yg-nudge');
  let s=await snapshot();
  s.q.forEach((v,i)=>{if(i!==3)assert.equal(v,before.q[i]);});
  assert(Math.abs(s.q[3]-before.q[3]-Math.PI/6)<1e-9);
  assert(Math.abs(s.delta[0])<1e-7);assert(Math.abs(s.delta[1])>.05);assert(Math.abs(s.delta[2])>.05);
  for(let i=0;i<6;i++)assert(Math.abs(Number(await page.locator('#yg-delta-'+i).textContent())-s.delta[i])<.000051);
  fs.mkdirSync(artifacts,{recursive:true});
  await page.locator('#yg-coupling').screenshot({path:path.join(artifacts,'gravity-coupling-desktop.png')});
  await page.click('#yg-link-matrix>summary');
  assert.equal(await page.locator('#yg-matrix-body tr').count(),s.rows.length);
  assert.equal(await page.locator('#yg-matrix-body .yg-moving-link').count(),s.rows.filter(r=>r.moved).length);
  assert.equal(await page.locator('#yg-matrix-body tr').first().locator('.yg-no-load').count(),5);
  await page.locator('#yg-link-matrix').screenshot({path:path.join(artifacts,'gravity-coupling-matrix.png')});
  await page.click('#yg-reference');s=await snapshot();assert(s.delta.every(v=>v===0));
  await page.click('#yg-nudge');before=await snapshot();
  await page.selectOption('#yg-driver','4');s=await snapshot();assert.deepEqual(s.referenceQ,before.q);assert(s.delta.every(v=>v===0));
  await page.click('#yg-nudge');before=await snapshot();
  await page.locator('#yg-q2').focus();await page.keyboard.press('ArrowRight');s=await snapshot();
  assert.equal(s.driver,2);assert.deepEqual(s.referenceQ,before.q);
  await page.click('#yg-revert');s=await snapshot();assert.deepEqual(s.q,s.referenceQ);assert(s.delta.every(v=>v===0));
  await page.click('[data-detail-joint="3"]');assert(await page.locator('#yg-detail').getAttribute('open')!==null);
  assert.equal(await page.locator('#yg-selected').inputValue(),'3');assert((await page.locator('#yg-result').textContent()).includes('J4'));
  await page.locator('#yg-plane').waitFor({state:'visible'});
  await page.click('#yg-detail>summary');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:850});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' px must not overflow');
   assert.equal(await page.locator('[data-response]').count(),6);
   await page.locator('#yg-coupling').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(artifacts,'gravity-coupling-mobile-'+width+'.png')});
  }
  await page.setViewportSize({width:1440,height:1060});await page.selectOption('#yg-driver','0');await page.click('#yg-nudge');s=await snapshot();
  assert(Math.max(...s.delta.map(Math.abs))<1e-4,'Nearly vertical base rotation changes gravity only at URDF-rounding scale');
  assert.deepEqual(errors,[]);
  const report={passed:true,url,checks:['six simultaneous output joints','only the selected angle changes','reference/current/delta values','upstream response and vertical-axis zero','moving link contribution matrix','reference capture and restoration','optional detailed projection','mobile layout'],pageErrors:errors.length};
  fs.writeFileSync(path.join(artifacts,'coupling-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
