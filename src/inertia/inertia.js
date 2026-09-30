/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const root=document.getElementById('yam-inertia'),D=YamDynamics,model=INERTIA_MODEL;
  const $=id=>document.getElementById(id),all=s=>[...root.querySelectorAll(s)],active=model.joints.filter(j=>j.active),Z=()=>Array(6).fill(0);
  const example=[0,1.3,1,0,0,0],state={q:example.slice(),a:[1,0,0,0,0,0],j:0,col:0,input:'q',view:'row',gravity:false,yaw:.7,pitch:.5,showAcceleration:false};
  const fmt=(x,d=4)=>Math.abs(x)<.5*10**(-d)?(0).toFixed(d):x.toFixed(d);
  const signed=(x,d=4)=>(x>=.5*10**(-d)?'+':'')+fmt(x,d);
  const coefficient=x=>Math.abs(x)<1e-12?'0':Math.abs(x)<1e-4?x.toExponential(1):x.toFixed(5);
  const compact=x=>Math.abs(x)<1e-12?'0':Math.abs(x)<.001?x.toExponential(1):signed(x,3);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('fixed-mass').textContent=`活动部分质量 ${Object.values(model.links).filter(l=>l.name!==model.root).reduce((s,l)=>s+l.mass,0).toFixed(3)} kg（固定）`;
  $('joint-inputs').innerHTML=active.map((j,i)=>`<div class="joint-input"><div class="input-head"><span class="joint-button">J${i+1}</span><label class="input-value"><input id="number-${i}" type="number" aria-label="J${i+1} 角度"><small id="unit-${i}">°</small></label></div><input id="range-${i}" type="range" aria-label="J${i+1} 角度"></div>`).join('');
  const canvas=$('lab-canvas'),scene=YamLabScene.create(canvas,D,model);let cache,result,computeCount=0;
  function config(i){return state.input==='q'?{min:Math.ceil(active[i].lower*180/Math.PI*10)/10,max:Math.floor(active[i].upper*180/Math.PI*10)/10,step:.1,mult:Math.PI/180,unit:'°',name:'角度'}:{min:-3,max:3,step:.1,mult:1,unit:'rad/s²',name:'角加速度'};}
  function sync(){
    all('[data-input]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.input===state.input)));
    all('[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===state.view)));
    $('row-panel').hidden=state.view!=='row';$('matrix-panel').hidden=state.view!=='matrix';
    for(let i=0;i<6;i++){const cfg=config(i),v=state[state.input][i]/cfg.mult;for(const prefix of ['number-','range-']){const e=$(prefix+i);e.min=cfg.min;e.max=cfg.max;e.step=cfg.step;if(document.activeElement!==e)e.value=fmt(v,1);e.setAttribute('aria-label',`J${i+1} ${cfg.name} / ${cfg.unit}`);}$('unit-'+i).textContent=cfg.unit;}
    $('output-joint').value=state.j;$('include-gravity').checked=state.gravity;$('show-acceleration').checked=state.showAcceleration;$('gravity-legend').hidden=!state.gravity;
    $('force-law').textContent=state.gravity?'q̇ = 0 → τ = M(q)q̈ + g(q)':'只提取惯性分量：τ惯性 = M(q)q̈，计算重力设为 0';
    $('input-note').textContent=state.input==='q'?'拖动角度，观察质量不变时，惯性矩阵和各电机力矩怎样变化。':'固定姿态后，改变加速度只改变 Mq̈；M 与 g 都保持不变。';
  }
  function drawScene(){scene.draw(result,{...state,panel:'mass',axis:true,acceleration:state.showAcceleration,com:state.gravity,heat:false,hint:`正轴与弧箭头：输出电机 J${state.j+1} · 点击 J 标签切换`});}
  function drawTorques(){
    const svg=$('torque-bars'),w=svg.clientWidth;if(!w)return;const cols=w>=300?2:1,cellW=w/cols,h=cols===2?218:390;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    const bound=Math.max(.01,...cache.M.map((row,i)=>row.reduce((s,x)=>s+Math.abs(x),0)*3+(state.gravity?Math.abs(cache.g[i]):0)))*1.1;
    let markup='<title>惯性与重力力矩；菱形为合计</title>';
    for(let i=0;i<6;i++){
      const col=cols===2?i%2:0,row=cols===2?Math.floor(i/2):i,off=col*cellW,left=off+4,right=off+cellW-8,y=15+row*60,x=v=>left+(v/bound+1)*(right-left)/2;
      markup+=`<g class="torque-row ${i===state.j?'selected':''}" data-joint="${i}" data-inertia="${result.acc[i]}" data-gravity="${result.g[i]}" data-total="${result.tau[i]}"><text x="${left}" y="${y}">J${i+1}</text><text x="${right}" y="${y}" text-anchor="end">${compact(result.tau[i])}</text><rect x="${left}" y="${y+10}" width="${right-left}" height="13" fill="var(--soft)"/><line x1="${x(0)}" y1="${y+6}" x2="${x(0)}" y2="${y+30}" stroke="var(--line)"/>`;
      let positive=0,negative=0;
      for(const [v,color,label]of [[result.acc[i],'inertia','惯性'],[result.g[i],'gravity','重力']]){const from=v>=0?positive:negative,to=from+v;if(v>=0)positive=to;else negative=to;markup+=`<rect x="${Math.min(x(from),x(to))}" y="${y+10}" width="${Math.abs(x(to)-x(from))}" height="13" fill="var(--${color})"><title>J${i+1} ${label} ${v} N·m</title></rect>`;}
      const p=x(result.tau[i]);markup+=`<path d="M${p},${y+21} l4,5 -4,5 -4,-5 Z" fill="var(--ink)"/>`;
      if(i===state.j)markup+=`<line x1="${left}" y1="${y+37}" x2="${right}" y2="${y+37}" stroke="var(--inertia)"/>`;markup+='</g>';
    }
    for(let col=0;col<cols;col++){const left=col*cellW+4,right=(col+1)*cellW-8;markup+=`<text class="scale-label" x="${left}" y="${h-8}">${fmt(-bound,2)}</text><text class="scale-label" x="${(left+right)/2}" y="${h-8}" text-anchor="middle">0</text><text class="scale-label" x="${right}" y="${h-8}" text-anchor="end">${fmt(bound,2)}</text>`;}
    svg.innerHTML=markup;
  }
  function drawRow(){
    const i=state.j;$('row-heading').textContent=`J${i+1} 电机的惯性力矩，来自 M 的第 ${i+1} 行。`;
    $('row-law').innerHTML=`τ<sub>惯性,${i+1}</sub> = ∑<sub>j</sub> M<sub>${i+1}j</sub> q̈<sub>j</sub>`;
    $('row-calculation').innerHTML='<span class="row-key">输入</span><span class="row-key">M 系数 / kg·m²</span><span></span><span class="row-key">q̈ / rad·s⁻²</span><span></span><span class="row-key">贡献 / N·m</span>'+cache.M[i].map((m,j)=>{
      const cls=state.a[j]!==0?' active-term':'';
      return `<span class="row-cell">J${j+1}</span><span class="row-cell${cls}" title="M${i+1}${j+1} = ${m}">${coefficient(m)}</span><span class="op">×</span><span class="row-cell${cls}">${signed(state.a[j],1)}</span><span class="op">=</span><span class="row-cell term-value${cls}">${coefficient(m*state.a[j])}</span>`;
    }).join('');
    $('selected-label').textContent=`六项相加 → J${i+1} 惯性力矩`;$('selected-inertia').textContent=compact(result.acc[i])+' N·m';
    $('selected-gravity').textContent=state.gravity?`+ 重力 ${signed(cache.g[i],4)} N·m`:'';$('selected-total').textContent=state.gravity?`电机合计 ${signed(result.tau[i],4)} N·m`:'仅显示惯性项';
  }
  function drawMatrix(){
    const max=Math.max(...cache.M.flat().map(Math.abs));
    $('mass-matrix').innerHTML=`<table class="data-matrix"><thead><tr><th>τ ↓ q̈ →</th>${active.map((_,j)=>`<th><button class="column-head" type="button" data-column="${j}" aria-pressed="${j===state.col}" aria-label="仅给 J${j+1} 单位角加速度">J${j+1}</button></th>`).join('')}<th>Mq̈ / N·m</th></tr></thead><tbody>${cache.M.map((row,i)=>`<tr class="${i===state.j?'active-row':''}"><th>τ${i+1}</th>${row.map((m,j)=>`<td class="${j===state.col?'column-focus':''}"><button type="button" data-cell-row="${i}" data-cell-column="${j}" aria-pressed="${i===state.j&&j===state.col}" class="${i===state.j&&j===state.col?'active-cell':''}" aria-label="M${i+1}${j+1}，${m} kg·m²" title="${m}" style="--cell-bg:color-mix(in srgb,var(--inertia) ${Math.round(4+25*Math.sqrt(Math.abs(m)/max))}%,var(--surface))">${Math.abs(m)<.001?m.toExponential(0):fmt(m,3)}</button></td>`).join('')}<td class="inertia-output">${compact(result.acc[i])}</td></tr>`).join('')}</tbody><tfoot><tr class="acceleration-row"><th>q̈</th>${state.a.map(a=>`<td>${signed(a,1)}</td>`).join('')}<td></td></tr></tfoot></table>`;
  }
  function drawOrigin(){
    if(!$('mass-origin').open)return;const i=state.j,j=state.col;
    $('mass-cell-title').textContent=`M${i+1}${j+1} = ${cache.M[i][j].toPrecision(7)} kg·m²`;
    $('origin-rows').innerHTML=cache.links.map(l=>`<tr><td>${esc(l.name)}</td><td>${signed(l.linear[i][j],6)}</td><td>${signed(l.angular[i][j],6)}</td><td>${signed(l.linear[i][j]+l.angular[i][j],6)}</td></tr>`).join('');
    const linear=cache.links.reduce((s,l)=>s+l.linear[i][j],0),angular=cache.links.reduce((s,l)=>s+l.angular[i][j],0);
    $('origin-total').innerHTML=`<tr><th>合计</th><td>${signed(linear,6)}</td><td>${signed(angular,6)}</td><td>${signed(cache.M[i][j],6)}</td></tr>`;
  }
  function render(pose=true){
    if(pose||!cache){const gravity=D.inverse(model,state.q,Z(),Z());cache={...YamLabMath.massParts(D,model,gravity.fk),g:gravity.tau};computeCount++;}
    const acc=D.mv(cache.M,state.a),g=state.gravity?cache.g.slice():Z();result={fk:D.forward(model,state.q,Z(),state.a),acc,g,tau:acc.map((x,i)=>x+g[i])};
    sync();drawScene();drawTorques();if(state.view==='row')drawRow();else drawMatrix();drawOrigin();
    const nonzero=state.a.map((v,j)=>({v,j})).filter(x=>x.v!==0),i=state.j;
    $('live-calculation').textContent=nonzero.length===0?'q̈ = 0：M 仍存在，惯性项为零。'+(state.gravity?'电机只需提供 g(q)。':''):(nonzero.length===1?`J${i+1}：M${i+1}${nonzero[0].j+1} × q̈${nonzero[0].j+1} = ${coefficient(cache.M[i][nonzero[0].j])} × (${signed(nonzero[0].v,1)}) = ${coefficient(acc[i])} N·m`:`J${i+1}：第 ${i+1} 行的 ${nonzero.length} 个非零乘积相加 = ${coefficient(acc[i])} N·m`);
    root.dataset.ready='true';root.dataset.state=JSON.stringify(state);root.dataset.torques=JSON.stringify(result.tau);
  }
  all('[data-input]').forEach(b=>b.addEventListener('click',()=>{state.input=b.dataset.input;sync();}));
  all('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;render(false);}));
  function unitColumn(j){state.a=Z();state.a[j]=1;state.col=j;state.input='a';render(false);}
  all('[data-preset]').forEach(b=>b.addEventListener('click',()=>unitColumn(Number(b.dataset.preset))));
  $('zero-acceleration').addEventListener('click',()=>{state.a=Z();render(false);});
  $('reset-pose').addEventListener('click',()=>{state.q=example.slice();render();});
  $('output-joint').addEventListener('change',e=>{state.j=Number(e.target.value);render(false);});
  $('include-gravity').addEventListener('change',e=>{state.gravity=e.target.checked;render(false);});
  $('show-acceleration').addEventListener('change',e=>{state.showAcceleration=e.target.checked;drawScene();});
  for(let i=0;i<6;i++)for(const prefix of ['number-','range-'])$(prefix+i).addEventListener('input',e=>{const value=e.target.valueAsNumber;if(!Number.isFinite(value))return;const cfg=config(i),bounded=Math.max(cfg.min,Math.min(cfg.max,value));state[state.input][i]=bounded*cfg.mult;if(value!==bounded)e.target.value=bounded;if(state.input==='a')state.col=i;render(state.input==='q');});
  $('mass-matrix').addEventListener('click',e=>{const column=e.target.closest('[data-column]');if(column){unitColumn(Number(column.dataset.column));return;}const cell=e.target.closest('[data-cell-row]');if(cell){state.j=Number(cell.dataset.cellRow);state.col=Number(cell.dataset.cellColumn);render(false);}});
  $('mass-origin').addEventListener('toggle',drawOrigin);
  $('view-iso').addEventListener('click',()=>{state.yaw=.7;state.pitch=.5;drawScene();});$('view-top').addEventListener('click',()=>{state.yaw=.7;state.pitch=1.05;drawScene();});
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag.x)*.008;state.pitch=Math.max(-1.25,Math.min(1.25,state.pitch+(e.clientY-drag.y)*.008));drag.x=e.clientX;drag.y=e.clientY;drawScene();});
  canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5){const r=canvas.getBoundingClientRect(),j=scene.pick(e.clientX-r.x,e.clientY-r.y);if(j!==undefined){state.j=j;render(false);}}drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  let lastWidth=0,pending=false;new ResizeObserver(()=>{if(root.clientWidth===lastWidth||pending)return;pending=true;requestAnimationFrame(()=>{pending=false;lastWidth=root.clientWidth;drawScene();drawTorques();});}).observe(root);
  window.yamInertiaSnapshot=()=>JSON.parse(JSON.stringify({state,M:cache.M,inertia:result.acc,gravity:cache.g,appliedGravity:result.g,tau:result.tau,computeCount}));
  render();lastWidth=root.clientWidth;
})();
