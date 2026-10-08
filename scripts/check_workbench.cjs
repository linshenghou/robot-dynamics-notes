/* SPDX-License-Identifier: MIT */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const D=require('../src/gravity/dynamics.js'),model=require('../src/model/model.json');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const kinds={gravity:'g',inertia:'acc',coriolis:'coriolis',centrifugal:'centrifugal'};
const close=(a,b,message,tolerance=1e-9)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
const vectorClose=(a,b,message)=>{assert.equal(a.length,b.length,message);a.forEach((x,i)=>close(x,b[i],`${message}, J${i+1}`));};
const zeros=values=>values.every(v=>Math.abs(v)<1e-10);
const nonzero=values=>values.some(v=>Math.abs(v)>1e-5);
(async()=>{
 let server,browser,base=process.env.SITE_URL||'file://'+path.join(root,'docs/index.html');
 if(process.argv.includes('--http')){
  const docs=path.join(root,'docs');server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if(!url.pathname.startsWith('/demo-course/')){res.writeHead(404).end();return;}
   let rel=decodeURIComponent(url.pathname.slice('/demo-course/'.length));
   if(!rel||rel.endsWith('/'))rel+='index.html';
   const file=path.resolve(docs,rel);
   if(!file.startsWith(docs+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.md':'text/plain','.urdf':'application/xml'};
   res.setHeader('Content-Type',(types[path.extname(file)]||'text/plain')+'; charset=utf-8');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/demo-course/`;
 }
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1060},deviceScaleFactor:1}),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(['file:','data:'].includes(url.protocol)||url.origin===new URL(base).origin)route.continue();
   else{external.push(url.href);route.abort();}
  });
  if(base.startsWith('file:'))await page.context().setOffline(true);
  await page.goto(base+'#start');await page.waitForLoadState('networkidle');
  const intro=page.frameLocator('#workbench-frame');
  await intro.locator('#yam-lab[data-ready="true"]').waitFor();
  const snapshot=lab=>lab.locator('html').evaluate(()=>window.yamLabSnapshot());
  async function verifyComponents(lab,label){
   const s=await snapshot(lab);
   const independent=D.inverse(model,s.state.q,s.state.v,s.state.a).tau;
   vectorClose(s.result.tau,independent,`${label}: inverse dynamics`);
   vectorClose(s.result.c,s.result.coriolis.map((v,j)=>v+s.result.centrifugal[j]),`${label}: velocity sum`);
   vectorClose(s.result.tau,s.result.g.map((v,j)=>v+s.result.acc[j]+s.result.coriolis[j]+s.result.centrifugal[j]),`${label}: four-term sum`);
   const bars=await lab.locator('#torque-bars').evaluate(svg=>[...svg.querySelectorAll('.torque-row')].map(row=>({joint:Number(row.dataset.joint),total:Number(row.dataset.torque),parts:[...row.querySelectorAll('.torque-component')].map(part=>({kind:part.dataset.component,value:Number(part.dataset.value),color:getComputedStyle(part).fill}))})));
   const table=await lab.locator('#torque-components').evaluate(table=>[...table.querySelectorAll('tbody tr')].map(row=>({joint:Number(row.dataset.joint),cells:[...row.querySelectorAll('td[data-component]')].map(cell=>({kind:cell.dataset.component,value:Number(cell.dataset.value),text:cell.textContent.trim()}))})));
   assert.equal(bars.length,6,`${label}: six charts`);assert.equal(table.length,6,`${label}: six numerical rows`);
   for(let j=0;j<6;j++){
    assert.equal(bars[j].joint,j);assert.equal(table[j].joint,j);
    assert.deepEqual(bars[j].parts.map(part=>part.kind).sort(),Object.keys(kinds).sort(),`${label}: four chart components`);
    assert.equal(new Set(bars[j].parts.map(part=>part.color)).size,4,`${label}: four distinct colours (${bars[j].parts.map(part=>part.color).join(', ')})`);
    close(bars[j].total,s.result.tau[j],`${label}: chart total`,1e-5);
    assert.equal(table[j].cells.length,5,`${label}: four values and total`);
    for(const [kind,key] of Object.entries(kinds)){
     const bar=bars[j].parts.find(part=>part.kind===kind),cell=table[j].cells.find(part=>part.kind===kind);
     assert(cell,`${label}: ${kind} numeric cell`);assert(cell.text.length>0,`${label}: ${kind} is displayed`);
     close(bar.value,s.result[key][j],`${label}: ${kind} chart J${j+1}`);
     close(cell.value,s.result[key][j],`${label}: ${kind} table J${j+1}`);
    }
    close(table[j].cells.find(cell=>cell.kind==='total').value,s.result.tau[j],`${label}: table total`);
   }
   return s;
  }
  for(const mode of ['static','acc','motion'])assert(await intro.locator(`[data-mode="${mode}"]`).isVisible(),`Intro exposes ${mode} mode`);
  let s=await verifyComponents(intro,'Initial static state');
  assert.equal(s.state.mode,'static');assert(zeros(s.result.acc)&&zeros(s.result.coriolis)&&zeros(s.result.centrifugal));vectorClose(s.result.tau,s.result.g,'Static gravity');
  await intro.locator('#yam-lab').screenshot({path:path.join(artifacts,'workbench-static.png')});
  await intro.locator('[data-mode="acc"]').click();s=await verifyComponents(intro,'Acceleration mode');
  assert(nonzero(s.result.acc),'Acceleration mode activates inertia');assert(zeros(s.result.coriolis)&&zeros(s.result.centrifugal));
  const accelerationBefore=s.state.a[1];await intro.locator('#range-1').focus();await page.keyboard.press('ArrowRight');
  assert((await snapshot(intro)).state.a[1]>accelerationBefore,'Keyboard slider changes acceleration');
  await intro.locator('#number-1').fill('-0.75');s=await verifyComponents(intro,'Numeric acceleration input');close(s.state.a[1],-.75,'Acceleration number input');
  await intro.locator('[data-mode="motion"]').click();s=await verifyComponents(intro,'Motion mode');
  assert(nonzero(s.result.coriolis)&&nonzero(s.result.centrifugal),'Motion mode shows both velocity effects');
  await intro.locator('#yam-lab').screenshot({path:path.join(artifacts,'workbench-four-components.png')});
  await intro.locator('#zero-velocity').click();s=await verifyComponents(intro,'Zero velocity');
  assert.equal(s.state.mode,'motion');assert(zeros(s.state.v)&&zeros(s.result.coriolis)&&zeros(s.result.centrifugal),'Zero velocity removes both effects');
  await intro.locator('[data-velocity-preset="single"]').click();s=await verifyComponents(intro,'One moving joint');
  assert.equal(s.state.v.filter(v=>v!==0).length,1);assert(zeros(s.result.acc)&&zeros(s.result.coriolis),'One moving joint has no mixed velocity products');assert(nonzero(s.result.centrifugal),'One moving joint retains centrifugal torque');
  await intro.locator('[data-velocity-preset="pair"]').click();const pair=await verifyComponents(intro,'Two moving joints');
  assert(nonzero(pair.result.coriolis),'Two moving joints activate Coriolis torque');
  await intro.locator('[data-velocity-preset="reverse"]').click();const reversed=await verifyComponents(intro,'One velocity reversed');
  vectorClose(reversed.result.centrifugal,pair.result.centrifugal,'Centrifugal terms preserve squared velocities');
  vectorClose(reversed.result.coriolis,pair.result.coriolis.map(v=>-v),'Mixed velocity products reverse sign');
  await intro.locator('#torque-components [data-output-joint="3"]').click();s=await snapshot(intro);assert.equal(s.state.j,3);
  assert.equal(await intro.locator('#output-joint').inputValue(),'3');assert((await intro.locator('#joint-total').textContent()).includes('J4'),'Table selection updates the detailed total');
  await intro.locator('#torque-components [data-output-joint="4"]').click();assert.equal((await snapshot(intro)).state.j,4);
  assert.equal(await intro.locator('#torque-components [data-output-joint="4"]').getAttribute('aria-pressed'),'true');
  await intro.locator('[data-input="q"]').click();const beforeAngle=await snapshot(intro);await intro.locator('#range-2').focus();await page.keyboard.press('ArrowRight');
  assert.notEqual((await snapshot(intro)).state.q[2],beforeAngle.state.q[2],'Keyboard input also changes joint angles');
  const persisted=await snapshot(intro);await page.reload();await intro.locator('#yam-lab[data-ready="true"]').waitFor();s=await verifyComponents(intro,'Restored intro');
  for(const key of ['mode','input','j','q','v','a'])assert.deepEqual(s.state[key],persisted.state[key],`Intro restores ${key}`);
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   for(const mode of ['static','acc','motion']){
    await intro.locator(`[data-mode="${mode}"]`).click();await verifyComponents(intro,`${width}px ${mode}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px lesson does not overflow`);
    assert(await intro.locator('html').evaluate(element=>element.scrollWidth<=innerWidth),`${width}px workbench ${mode} does not overflow`);
    assert(await intro.locator('.input-head').evaluateAll(rows=>rows.every(element=>element.scrollWidth<=element.clientWidth+1)),`${width}px ${mode} input units fit`);
   }
   await intro.locator('#yam-lab').screenshot({path:path.join(artifacts,`workbench-mobile-${width}.png`)});
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(artifacts,`workbench-home-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1060});
  await page.goto(new URL('labs/workbench.html',base).href);await page.locator('#yam-lab[data-ready="true"]').waitFor();
  s=await verifyComponents(page,'Standalone initial state');assert.equal(s.state.mode,'static','Standalone state is separate from intro');
  await page.locator('#output-joint').selectOption('4');assert.equal((await snapshot(page)).state.j,4);
  assert.equal(await page.locator('#torque-components [data-output-joint="4"]').getAttribute('aria-pressed'),'true','Output selector updates the component table');
  await page.locator('[data-mode="acc"]').click();s=await verifyComponents(page,'Standalone inertia');assert(nonzero(s.result.acc));
  await page.locator('#mass-2-1').click();assert.equal((await snapshot(page)).state.j,2);assert.equal((await snapshot(page)).state.col,1);
  await page.locator('[data-mode="motion"]').click();await page.locator('[data-velocity-preset="pair"]').click();await verifyComponents(page,'Standalone velocity');
  await page.locator('#velocity-source-details > summary').click();
  await page.locator('#velocity-source-rows tr').first().waitFor();
  const sources=await page.locator('#velocity-source-rows tr').evaluateAll(rows=>rows.map(row=>({coriolis:Number(row.cells[2].textContent),centrifugal:Number(row.cells[3].textContent)})));
  s=await snapshot(page);assert.equal(sources.length,21,'Six squared and fifteen mixed velocity sources are displayed');
  for(const kind of ['coriolis','centrifugal'])close(sources.reduce((sum,row)=>sum+row[kind],0),s.result[kind][s.state.j],`Displayed ${kind} sources sum to the selected joint`,2e-5);
  await page.locator('#velocity-source-details').screenshot({path:path.join(artifacts,'workbench-velocity-sources.png')});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px standalone velocity panel and expanded sources do not overflow`);
   assert(await page.locator('#velocity-source-details').isVisible(),`${width}px velocity sources remain available`);
   const formulaSize=await page.locator('.christoffel-formula').evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));
   assert(formulaSize.scroll<=formulaSize.client+1,`${width}px coefficient formula fits its panel: ${JSON.stringify(formulaSize)}`);
   await page.locator('#panel-velocity').screenshot({path:path.join(artifacts,`workbench-velocity-mobile-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:1060});
  const standaloneSaved=await snapshot(page);await page.reload();await page.locator('#yam-lab[data-ready="true"]').waitFor();s=await snapshot(page);
  for(const key of ['mode','input','j','q','v','a'])assert.deepEqual(s.state[key],standaloneSaved.state[key],`Standalone restores ${key}`);
  await page.locator('#yam-lab').screenshot({path:path.join(artifacts,'workbench-standalone.png')});
  await page.locator('[data-mode="static"]').click();s=await verifyComponents(page,'Standalone returns to static');assert(zeros(s.result.acc)&&zeros(s.result.c));
  await page.locator('#gravity-matrix [data-gravity-row]').first().click();assert.equal((await snapshot(page)).state.j,0,'Gravity contributions remain interactive');
  assert.deepEqual(errors,[],'No browser errors');assert.deepEqual(external,[],'No external resources');
  const report={passed:true,transport:base.startsWith('file:')?'offline file':'HTTP project subpath',viewportWidths:[1440,390,320],pageErrors:errors.length,externalRequests:external.length,checks:['six four-colour torque charts and numerical rows','independent inverse dynamics and component totals','static, acceleration and motion modes','zero velocity and single moving joint','two velocity products and sign reversal','keyboard and numeric controls','joint selection linkage','intro and standalone local state restoration','standalone matrix and gravity controls','six squared and fifteen mixed velocity sources','mobile overflow and input units','standalone mobile velocity panel and expanded sources'],screenshots:artifacts};
  fs.writeFileSync(path.join(artifacts,base.startsWith('file:')?'workbench-browser-file.json':'workbench-browser-http.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
