/* SPDX-License-Identifier: MIT */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
const torqueHeat=require(path.join(root,'src/workbench/torque_heat.js'));
assert.equal(torqueHeat.css(-6),torqueHeat.css(6),'Torque heat shows magnitude, independent of sign');
assert.equal(torqueHeat.css(24),torqueHeat.css(16),'The colour scale clips above its labelled limit');
assert.notEqual(torqueHeat.css(0),torqueHeat.css(16));
(async()=>{
 let server,base=process.env.SITE_URL||'file://'+path.join(root,'docs/index.html');
 if(process.argv.includes('--http')){
  const docs=path.join(root,'docs');server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/demo-course/')){res.writeHead(404).end();return;}
   let rel=decodeURIComponent(url.pathname.slice('/demo-course/'.length));if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve(docs,rel);
   if(!file.startsWith(docs+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.md':'text/plain','.urdf':'application/xml'};
   res.setHeader('Content-Type',(types[path.extname(file)]||'text/plain')+'; charset=utf-8');res.end(fs.readFileSync(file));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/demo-course/`;
 }
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1060},deviceScaleFactor:1});
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(['file:','data:'].includes(u.protocol)||u.hostname==='127.0.0.1'||u.origin===new URL(base).origin)route.continue();else{external.push(u.href);route.abort();}});
  if(base.startsWith('file:'))await page.context().setOffline(true);
  await page.goto(base);await page.waitForLoadState('networkidle');
  const bench=page.frameLocator('#workbench-frame');await bench.locator('#yam-lab[data-ready="true"]').waitFor();
  await page.screenshot({path:path.join(artifacts,'course-home.png'),fullPage:true});
  await page.screenshot({path:path.join(artifacts,'course-first-screen.png')});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'dark');
  const modelBox=await bench.locator('#lab-canvas').boundingBox(),barBox=await bench.locator('#torque-bars').boundingBox(),formulaBox=await page.locator('.first-explanation').boundingBox();
  assert(modelBox.y<300&&modelBox.y+modelBox.height<800,'Model is visible immediately');
  assert(barBox.y<320&&barBox.y+barBox.height<800,'Six torques are visible immediately');
  assert(formulaBox.y>modelBox.y+modelBox.height,'Formula follows the entire experiment');
  const heatRows=()=>bench.locator('#torque-bars .torque-row').evaluateAll(rows=>rows.map(row=>({torque:Number(row.dataset.torque),heat:row.dataset.heat.replace(/\s/g,''),label:getComputedStyle(row.querySelector('text')).fill.replace(/\s/g,''),bar:row.querySelector('.torque-heat-bar').getAttribute('fill').replace(/\s/g,'')})));
  const heatBefore=await heatRows();assert.equal(heatBefore.length,6);
  assert(heatBefore.every(row=>row.label===row.heat&&row.bar===row.heat),'Robot torque colours match all six bar labels and fills');
  assert(new Set(heatBefore.map(row=>row.heat)).size>2,'The initial pose shows distinct torque magnitudes');
  const initial=await bench.locator('#yam-lab').getAttribute('data-torques');await bench.locator('#range-2').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await bench.locator('#yam-lab').getAttribute('data-torques'),initial);
  await bench.locator('#number-1').fill('0');const heatAfter=await heatRows();assert(heatBefore.some((row,j)=>row.heat!==heatAfter[j].heat),'Torque colours respond to joint angles');
  await page.locator('#begin-learning').click();await page.waitForFunction(()=>scrollY>600);
  await page.goto(base+'#gravity');
  const gf=page.frameLocator('iframe[title="YAM 六关节重力补偿实验"]');await gf.locator('#yam-gravity-explorer[data-ready="true"]').waitFor();
  const torque=await gf.locator('#yg-tau1').textContent();await gf.locator('#yg-q1').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await gf.locator('#yg-tau1').textContent(),torque);
  await page.locator('iframe[title="YAM 六关节重力补偿实验"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifacts,'course-gravity-detail.png')});
  await page.screenshot({path:path.join(artifacts,'course-gravity.png'),fullPage:true});
  await page.goto(base+'#planar');
  await page.locator('.method-grid').screenshot({path:path.join(artifacts,'planar-methods.png')});
  assert((await page.locator('.energy-method').textContent()).includes('∂P/∂q₁'));
  assert((await page.locator('.ne-method').textContent()).includes('F₁ = m₁g₀ + F₂'));
  assert.equal(await page.locator('#planar-energy-output').textContent(),await page.locator('#planar-ne-output').textContent());
  await page.locator('summary').filter({hasText:'从点质量到真实连杆'}).click();
  await page.locator('.rnea-bridge').screenshot({path:path.join(artifacts,'planar-rnea-bridge.png')});
  const rneaBefore=await page.locator('#rnea-j2').textContent();await page.locator('#p-q2').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await page.locator('#rnea-j2').textContent(),rneaBefore,'RNEA bridge follows the planar joint angle');
  assert((await page.locator('#rnea-j1').textContent()).includes((await page.locator('#planar-ne-output').textContent()).match(/g₁ ([\d.-]+)/)[1]),'RNEA bridge agrees with joint 1 output');
  await page.locator('#planar-vertical').click();assert((await page.locator('#planar-values').textContent()).includes('g₂ = 0.00'));
  assert.equal(await page.locator('#planar-energy-output').textContent(),await page.locator('#planar-ne-output').textContent());
  await page.locator('#planar .quiz-options button').first().click();assert((await page.locator('#planar .quiz-feedback').textContent()).startsWith('对。'));
  await page.goto(base+'#wrench');const wf=page.frameLocator('iframe[title="三维重力 wrench 与参考点实验"]');await wf.locator('#tau').waitFor();await wf.locator('[data-axis="2"]').click();assert.equal(await wf.locator('#tau').textContent(),'0.00 N·m');
  assert.equal(await wf.locator('.component-card').count(),6,'All six wrench components are visible');
  await wf.locator('[data-preset="oblique"]').click();
  const wrench=await wf.locator('html').evaluate(()=>wrenchSnapshot());
  assert(wrench.f.every(v=>Math.abs(v)>.1)&&wrench.n.every(v=>Math.abs(v)>.1),'Oblique force exposes all six nonzero components');
  assert(Math.abs(wrench.n[0]-(wrench.r[1]*wrench.f[2]-wrench.r[2]*wrench.f[1]))<1e-10);
  assert(Math.abs(wrench.n[1]-(wrench.r[2]*wrench.f[0]-wrench.r[0]*wrench.f[2]))<1e-10);
  assert(Math.abs(wrench.n[2]-(wrench.r[0]*wrench.f[1]-wrench.r[1]*wrench.f[0]))<1e-10);
  await wf.locator('[data-component="nx"]').click();assert.equal(await wf.locator('[data-component="nx"]').getAttribute('aria-pressed'),'true');
  assert.equal(await wf.locator('[data-axis="0"]').getAttribute('aria-pressed'),'true');
  assert.equal((await wf.locator('#nx').textContent()).trim(),wrench.n[0].toFixed(2));
  await page.locator('iframe[title="三维重力 wrench 与参考点实验"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifacts,'course-wrench.png')});
  await page.goto(base+'#mit');assert(await page.locator('#mit').isVisible());
  await page.goto(base+'#compliance');assert.equal((await page.evaluate(()=>lessonSnapshot())).params.mode,'hold');
  await page.locator('#sim-push').click();await page.waitForFunction(()=>lessonSnapshot().time>.4);assert((await page.evaluate(()=>lessonSnapshot())).state.q>Math.PI*25/180+.02);
  await page.locator('#sim-release').click();assert.equal((await page.evaluate(()=>lessonSnapshot())).params.external,0);
  await page.locator('#sim-run').click();
  await page.screenshot({path:path.join(artifacts,'course-compliance.png'),fullPage:true});
  await page.locator('[data-mode="gravity"]').click();assert(await page.locator('#s-kp').isDisabled());assert(await page.locator('#s-kd').isDisabled());
  await page.locator('#sim-coast').click();await page.waitForFunction(()=>lessonSnapshot().time>.25);assert(Math.abs((await page.evaluate(()=>lessonSnapshot())).state.v-.8)<1e-10);
  await page.goto(base+'#sources');assert.equal((await page.evaluate(()=>lessonSnapshot())).running,false);
  await page.reload();assert.equal((await page.evaluate(()=>lessonSnapshot())).page,'sources');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:850});
   for(const id of ['start','gravity','planar','wrench','mit','compliance','sources']){await page.goto(base+'#'+id);await page.locator('#'+id).waitFor({state:'visible'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow: ${id}`);if(id==='planar'){if(width===390)await page.locator('.method-grid').screenshot({path:path.join(artifacts,'planar-methods-mobile.png')});await page.locator('summary').filter({hasText:'从点质量到真实连杆'}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px RNEA bridge overflow`);if(width===390)await page.locator('.rnea-bridge').screenshot({path:path.join(artifacts,'planar-rnea-bridge-mobile.png')});}if(id==='wrench'&&width===390){const mobileWrench=page.frameLocator('iframe[title="三维重力 wrench 与参考点实验"]');await mobileWrench.locator('.component-card').last().waitFor();assert(await mobileWrench.locator('html').evaluate(e=>e.scrollWidth<=innerWidth),'Mobile wrench has no horizontal overflow');await mobileWrench.locator('[data-preset="oblique"]').click();await mobileWrench.locator('.components').screenshot({path:path.join(artifacts,'wrench-six-components-mobile.png')});}}
   await page.goto(base+'#start');await bench.locator('#lab-canvas').waitFor({state:'visible'});
   await page.screenshot({path:path.join(artifacts,'course-mobile-first-'+width+'.png')});
   assert(await bench.locator('html').evaluate(e=>e.scrollWidth<=innerWidth),`${width}px workbench overflow`);
   await page.screenshot({path:path.join(artifacts,`course-home-${width}.png`),fullPage:true});
  }
  await page.goto(base+'#start');await page.locator('#menu-toggle').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await page.locator('.sidebar a[href="#compliance"]').click();await page.locator('#compliance').waitFor({state:'visible'});assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
  await page.screenshot({path:path.join(artifacts,'course-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1366,height:768});await page.goto(base+'#gravity');await page.locator('#gravity').waitFor({state:'visible'});
  await page.screenshot({path:path.join(artifacts,'course-laptop.png')});
  const laptopModel=await bench.locator('#lab-canvas').boundingBox();assert(laptopModel.y+laptopModel.height<768,'Model fits a laptop viewport');
  const standalone=new URL('labs/workbench.html',base).href;
  await page.goto(standalone);await page.locator('#yam-lab[data-ready="true"]').waitFor();await page.locator('[data-mode="acc"]').click();
  let snap=await page.evaluate(()=>yamLabSnapshot());assert(snap.result.acc.some(x=>Math.abs(x)>.001));assert(snap.result.c.every(x=>Math.abs(x)<1e-10));
  await page.locator('[data-mode="motion"]').click();snap=await page.evaluate(()=>yamLabSnapshot());assert(snap.result.c.some(x=>Math.abs(x)>.001));
  await page.locator('[data-mode="static"]').click();snap=await page.evaluate(()=>yamLabSnapshot());assert(snap.result.acc.every(x=>Math.abs(x)<1e-10));assert(snap.result.c.every(x=>Math.abs(x)<1e-10));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={passed:true,transport:base.startsWith('file:')?'offline file':'HTTP project subpath',viewportWidths:[1440,1366,390,320],chapters:7,externalRequests:external.length,pageErrors:errors.length,checks:['dark model and six torques before formulas','fixed torque heat scale and six matching labels and bars','heat colours update with joint angles','interactive YAM joint angles','standalone inertia and velocity modes','navigation and deep links','gravity iframe slider','planar potential derivative and Newton-Euler agreement','live two-link RNEA bridge and mobile layout','planar special pose','quiz feedback','wrench projection and six live components','oblique force cross product and component selection','dynamic force and release','coasting and pause on navigation','mobile menu','no horizontal overflow']};
  fs.writeFileSync(path.join(artifacts,base.startsWith('file:')?'browser-file.json':'browser-http.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
