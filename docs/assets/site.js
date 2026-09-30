/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const P=RobotLessonPhysics,$=id=>document.getElementById(id),rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
  const fmt=(v,n=2)=>(Math.abs(v)<.5*10**(-n)?0:v).toFixed(n);
  let activePage='start';
  const colors={ink:'#e1e8e6',teal:'#87d5bd',orange:'#e7ad79',blue:'#8fbce9',muted:'#91a29f',line:'#2b3639'};
  function route(){
    let id=location.hash.slice(1)||'start';if(id==='content'){document.querySelector('main').focus();return;}
    if(!document.querySelector('.page#'+CSS.escape(id)))id='start';
    activePage=id;$('live-lab').hidden=!['start','gravity'].includes(id);document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==id);
    document.querySelectorAll('.nav-link').forEach(a=>{if(a.hash==='#'+id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title=$(`${id}`).dataset.title+' · 机械臂动力学手记';
    document.querySelectorAll(`#${id} iframe[data-src]`).forEach(f=>{f.src=f.dataset.src;delete f.dataset.src;});
    $('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');
    if(id!=='compliance')pause();
    window.scrollTo({top:0,behavior:'instant'});if(id==='compliance')requestAnimationFrame(renderSimulation);
  }
  $('begin-learning').addEventListener('click',()=>{const target=activePage==='gravity'?$('gravity'):document.querySelector('.first-explanation');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
  $('menu-toggle').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String($('sidebar').classList.contains('open')));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}});
  document.querySelectorAll('.quiz').forEach(q=>{q.querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{q.querySelectorAll('button').forEach(c=>c.classList.toggle('selected',c===b));q.querySelector('.quiz-feedback').textContent=(i===+q.dataset.answer?'对。':'再看一次实验。')+q.dataset.explanation;}));});
  window.addEventListener('message',e=>{if(e.data?.type!=='lesson-height'||!Number.isFinite(e.data.height))return;for(const f of document.querySelectorAll('iframe'))if(f.contentWindow===e.source)f.style.height=Math.min(6000,Math.max(500,e.data.height+4))+'px';});
  const line=(a,b,c,w=2,dash='')=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  const circle=(p,r,c)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${c}"/>`;
  const text=(p,t,c=colors.ink,size=15)=>`<text x="${p[0]}" y="${p[1]}" fill="${c}" font-size="${size}" font-family="'PingFang SC',sans-serif" style="paint-order:stroke;stroke:#141a1d;stroke-width:4;stroke-linejoin:round">${t}</text>`;
  function arrow(a,b,c,w=3){const t=Math.atan2(b[1]-a[1],b[0]-a[0]),h=10;return line(a,b,c,w)+`<path d="M${b[0]},${b[1]} L${b[0]-h*Math.cos(t-.45)},${b[1]-h*Math.sin(t-.45)} L${b[0]-h*Math.cos(t+.45)},${b[1]-h*Math.sin(t+.45)} Z" fill="${c}"/>`;}
  function planarDraw(svg,q1,q2,m2,hero=false){
    const data=P.planar(q1,q2,1,m2),w=hero?540:600,h=hero?380:410;
    const xs=data.points.map(p=>p[0]),zs=data.points.map(p=>p[1]),minX=Math.min(-.08,...xs),maxX=Math.max(.45,...xs),minZ=Math.min(-.08,...zs),maxZ=Math.max(.35,...zs);
    const scale=Math.min((w-150)/(maxX-minX),(h-125)/(maxZ-minZ)),origin=[72-minX*scale,48+maxZ*scale];
    const at=([x,z])=>[origin[0]+x*scale,origin[1]-z*scale],pt=data.points.map(at);let s='';
    for(let k=0;k<7;k++)s+=line([38,55+k*43],[w-25,55+k*43],colors.line,.6);
    s+=line([30,origin[1]],[w-25,origin[1]],'#3b494b',1,'4 6');
    s+=line(pt[0],pt[1],colors.ink,12)+line(pt[1],pt[2],colors.teal,12);
    s+=circle(pt[0],9,colors.ink)+circle(pt[1],11,colors.orange)+circle(pt[2],12,colors.orange);
    for(let i=1;i<=2;i++){
      const f=[pt[i][0],pt[i][1]+50+(i===2?m2*7:7)];s+=arrow(pt[i],f,colors.orange,3)+text([f[0]+12,f[1]-6],`m${i===1?'₁':'₂'}g₀`,colors.orange,14);
    }
    s+=text([pt[0][0]-26,pt[0][1]+30],'J1',colors.ink,14)+text([pt[1][0]-35,pt[1][1]-18],'J2',colors.ink,14);
    s+=text([24,26],hero?'同一份重量，不同的力臂。':'角度改变 → 质心高度改变 → 补偿力矩改变',colors.muted,12);
    s+=text([25,h-18],hero?'重力 ↓    补偿力矩由关节轴与力臂决定':'q₂ 是相对角；第二杆的绝对角为 q₁ + q₂',colors.muted,12);
    svg.innerHTML=s;return data;
  }
  function planarUpdate(){
    const q1=+$('p-q1').value,q2=+$('p-q2').value,m=+$('p-m2').value;
    const d=planarDraw($('planar-scene'),rad(q1),rad(q2),m);
    const ne=P.planarNewtonEuler(rad(q1),rad(q2),1,m);
    $('p-q1-out').textContent=q1+'°';$('p-q2-out').textContent=q2+'°';$('p-m2-out').textContent=fmt(m,1)+' kg';
    $('planar-values').innerHTML=`势能 P = <b>${fmt(d.potential)} J</b><br>g₁ = <b>${fmt(d.gravity[0])} N·m</b><br>g₂ = <b>${fmt(d.gravity[1])} N·m</b><br><span class="small">g₁ 中 m₁ / m₂ 的贡献：<br>${fmt(d.contributions[0][0])} / ${fmt(d.contributions[0][1])} N·m</span>`;
    $('planar-energy-output').textContent=`g₁ ${fmt(d.gravity[0])} · g₂ ${fmt(d.gravity[1])} N·m`;
    $('planar-ne-output').textContent=`g₁ ${fmt(ne.gravity[0])} · g₂ ${fmt(ne.gravity[1])} N·m`;
    $('rnea-forward').textContent=`xJ2 ${fmt(d.points[1][0])} m · xm₂ ${fmt(d.points[2][0])} m`;
    $('rnea-j2').textContent=`m₂g₀ ${fmt(m*P.G)} N · g₂ ${fmt(ne.gravity[1])} N·m`;
    $('rnea-j1').textContent=`上游新增 ${fmt((1+m)*P.G*d.points[1][0])} N·m · g₁ ${fmt(ne.gravity[0])} N·m`;
  }
  ['p-q1','p-q2','p-m2'].forEach(id=>$(id).addEventListener('input',planarUpdate));$('planar-vertical').addEventListener('click',()=>{$('p-q1').value=0;$('p-q2').value=90;planarUpdate();});planarUpdate();
  const params={mode:'hold',mass:2,length:.35,kp:10,kd:.7,target:rad(25),external:0,gravityRatio:1,friction:0};
  let sim={q:rad(25),v:0},running=false,time=0,history=[{t:0,q:rad(25)}],lastFrame=null,frameCount=0;
  function pause(){running=false;$('sim-run').textContent='开始运行';lastFrame=null;if(activePage==='compliance')renderSimulation();}
  function start(){running=true;$('sim-run').textContent='暂停';lastFrame=null;renderSimulation();}
  function reset(){pause();sim={q:params.target,v:0};time=0;params.external=0;history=[{t:0,q:sim.q}];$('s-external').value=0;syncControls();renderSimulation();}
  function syncControls(){
    const defs=[['kp','kp',' N·m/rad'],['kd','kd',' N·m·s/rad'],['target','target','°'],['external','external',' N·m'],['ratio','gravityRatio',' ×'],['friction','friction',' N·m']];
    for(const [id,key,unit]of defs)$('s-'+id+'-out').textContent=fmt(key==='target'?deg(params.target):params[key],key==='target'||key==='kp'?0:2)+unit;
    $('s-kp').disabled=params.mode!=='hold';$('s-kd').disabled=!['hold','drag'].includes(params.mode);$('s-target').disabled=params.mode!=='hold';$('s-ratio').disabled=params.mode==='off';
    const laws={off:'τmotor = 0',gravity:'τmotor = ĝ(q)',drag:'τmotor = ĝ(q) − Kd q̇',hold:'τmotor = ĝ(q) + Kp(qd − q) − Kd q̇'};
    $('sim-law').innerHTML=`<b>${laws[params.mode]}</b><br>实际 Kp = ${params.mode==='hold'?params.kp:0}，实际 Kd = ${['hold','drag'].includes(params.mode)?params.kd:0}`;
    const descriptions={off:'重力没有被抵消。杆会下落并摆动；无摩擦时，理想模型不会自行停下。',gravity:'静止时可托住重量。给它初速度后，没有阻尼就不会自动停下。',drag:'施力后点“松手”：速度逐渐衰减，没有位置弹簧拉回旧角度。',hold:'施力保持，再松手：观察虚拟弹簧与阻尼。Kp 越小，理想静态偏移越大。'};
    $('sim-caption').textContent=descriptions[params.mode];
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{params.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(c=>{c.classList.toggle('active',c===b);c.setAttribute('aria-pressed',String(c===b));});reset();}));
  const keys={kp:'kp',kd:'kd',target:'target',external:'external',ratio:'gravityRatio',friction:'friction'};
  for(const [id,key]of Object.entries(keys))$('s-'+id).addEventListener('input',e=>{params[key]=key==='target'?rad(+e.target.value):+e.target.value;syncControls();renderSimulation();});
  $('sim-run').addEventListener('click',()=>{if(running)pause();else start();});$('sim-reset').addEventListener('click',reset);
  $('sim-push').addEventListener('click',()=>{params.external=1;$('s-external').value=1;syncControls();start();});$('sim-release').addEventListener('click',()=>{params.external=0;$('s-external').value=0;syncControls();renderSimulation();});
  $('sim-coast').addEventListener('click',()=>{sim.v=.8;start();renderSimulation();});
  function simulationDraw(){const O=[240,222],L=145,end=q=>[O[0]+L*Math.cos(q),O[1]-L*Math.sin(q)],C=end(sim.q),T=end(params.target);let s='';
    for(let y=60;y<360;y+=40)s+=line([28,y],[550,y],colors.line,.7);
    s+=line([28,O[1]],[550,O[1]],'#3b494b',1,'4 5');
    if(params.mode==='hold')s+=line(O,T,colors.teal,3,'7 7')+circle(T,6,'#87d5bd')+text([T[0]+12,T[1]-15],'目标 qd',colors.teal,14);
    s+=line(O,C,colors.ink,11)+circle(O,10,colors.ink)+circle(C,14,colors.orange);
    s+=arrow(C,[C[0],C[1]+65],colors.orange,3)+text([C[0]+15,C[1]+52],'mg₀',colors.orange,15);
    s+=text([20,28],`时间 ${fmt(time,1)} s · ${running?'运行中':'暂停'}`,colors.muted,12);
    s+=text([O[0]-20,O[1]+29],'O',colors.ink,15);
    if(Math.abs(params.external)>.001){const sign=Math.sign(params.external),points=Array.from({length:30},(_,k)=>{const a=.7+sign*k/29*3;return [O[0]+45*Math.cos(a),O[1]-45*Math.sin(a)];});s+=`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${colors.blue}" stroke-width="3"/>`+arrow(points[27],points[29],colors.blue,3)+text([22,365],`人手：${fmt(params.external)} N·m（逆时针为正）`,colors.blue,14);}
    else s+=text([22,365],'人手：已松开',colors.muted,13);
    $('sim-scene').innerHTML=s;$('sim-scene').setAttribute('aria-label',`当前角度 ${fmt(deg(sim.q),1)} 度，速度 ${fmt(sim.v)} 弧度每秒，外力矩 ${fmt(params.external)} 牛米`);
  }
  function chart(){const canvas=$('sim-chart'),w=canvas.clientWidth;if(!w)return;const h=170,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const recent=history.filter(p=>p.t>=time-8),vals=recent.map(p=>deg(p.q));if(params.mode==='hold')vals.push(deg(params.target));
    let lo=Math.min(...vals)-5,hi=Math.max(...vals)+5;if(hi-lo<20){const mid=(hi+lo)/2;lo=mid-10;hi=mid+10;}
    const t0=Math.max(0,time-8),t1=Math.max(8,time),X=t=>48+(t-t0)/(t1-t0)*(w-70),Y=q=>135-(deg(q)-lo)/(hi-lo)*100;
    ctx.font='11px sans-serif';ctx.fillStyle=colors.muted;ctx.fillText('角度 / °',10,20);ctx.fillText(`${fmt(t0,1)} s`,48,158);ctx.fillText(`${fmt(t1,1)} s`,w-52,158);
    for(let i=0;i<3;i++){const v=lo+i*(hi-lo)/2,y=135-i*50;ctx.strokeStyle=colors.line;ctx.beginPath();ctx.moveTo(47,y);ctx.lineTo(w-20,y);ctx.stroke();ctx.fillStyle=colors.muted;ctx.fillText(fmt(v,0),5,y+4);}
    if(params.mode==='hold'){ctx.strokeStyle=colors.teal;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(48,Y(params.target));ctx.lineTo(w-20,Y(params.target));ctx.stroke();ctx.setLineDash([]);}
    ctx.strokeStyle=colors.ink;ctx.lineWidth=2;ctx.beginPath();recent.forEach((p,i)=>{if(i)ctx.lineTo(X(p.t),Y(p.q));else ctx.moveTo(X(p.t),Y(p.q));});ctx.stroke();
  }
  function renderSimulation(){const c=P.controller(sim,params);$('sim-q').textContent=fmt(deg(sim.q),1);$('sim-v').textContent=fmt(sim.v);$('sim-tau').textContent=fmt(c.motor);$('sim-g').textContent=fmt(c.gravity);simulationDraw();chart();}
  function tick(now){if(running&&activePage==='compliance'&&!document.hidden){if(lastFrame!==null){let dt=Math.min((now-lastFrame)/1000,.05);const steps=Math.ceil(dt*240);if(steps>0)for(let i=0;i<steps;i++)sim=P.step(sim,params,dt/steps);time+=dt;if(++frameCount%2===0){history.push({t:time,q:sim.q});while(history.length>2&&history[1].t<time-8)history.shift();}renderSimulation();}lastFrame=now;}else lastFrame=null;requestAnimationFrame(tick);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('hashchange',route);new ResizeObserver(()=>{if(activePage==='compliance')chart();}).observe($('sim-chart'));
  window.lessonSnapshot=()=>({page:activePage,running,time,state:{...sim},params:{...params},torques:P.controller(sim,params)});
  syncControls();renderSimulation();route();requestAnimationFrame(tick);
})();
