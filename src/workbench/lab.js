(() => {
  const root=document.getElementById('yam-lab'),D=YamDynamics,model=LAB_MODEL;
  const $=id=>document.getElementById(id),all=s=>[...root.querySelectorAll(s)],active=model.joints.filter(j=>j.active),Z=()=>Array(6).fill(0);
  const intro=document.documentElement.classList.contains('intro');
  const example=[0,1.3,1,0,0,0],key=intro?'rdn-workbench-intro-v1':'rdn-workbench-full-v1';
  const state={q:example.slice(),a:Z(),v:Z(),j:1,col:1,link:'link3',mode:'static',panel:'gravity',input:'q',yaw:.7,pitch:.4,com:true};
  const fmt=(n,d=3)=>Math.abs(n)<.5*10**(-d)?(0).toFixed(d):n.toFixed(d),sgn=(n,d=3)=>(n>=.5*10**(-d)?'+':'')+fmt(n,d),brief=n=>Math.abs(n)<.0005?'≈0':sgn(n),mfmt=n=>Math.abs(n)<1e-9?'0':Math.abs(n)<.0005?n.toExponential(1):fmt(n),vec=(v,d=4)=>'['+v.map(x=>fmt(x,d)).join(', ')+']';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function restore(s){
    if(!s||typeof s!=='object')return;
    for(const n of ['q','a','v'])if(Array.isArray(s[n])&&s[n].length===6&&s[n].every(Number.isFinite))state[n]=s[n].slice();
    for(const n of ['j','col'])if(Number.isInteger(s[n])&&s[n]>=0&&s[n]<6)state[n]=s[n];
    if(['static','acc','motion'].includes(s.mode))state.mode=s.mode;
    if(['gravity','mass','velocity'].includes(s.panel))state.panel=s.panel;
    if(['q','a','v'].includes(s.input))state.input=s.input;
    if(model.links[s.link]&&s.link!=='base')state.link=s.link;
    if(Number.isFinite(s.yaw))state.yaw=s.yaw;if(Number.isFinite(s.pitch))state.pitch=Math.max(-1.5,Math.min(1.5,s.pitch));if(typeof s.com==='boolean')state.com=s.com;
    state.q=state.q.map((v,i)=>Math.max(active[i].lower,Math.min(active[i].upper,v)));state.a=state.a.map(x=>Math.max(-3,Math.min(3,x)));state.v=state.v.map(x=>Math.max(-2,Math.min(2,x)));
    if(state.mode==='static'){state.a=Z();state.v=Z();}if(state.mode==='acc')state.v=Z();
    if(state.mode==='static'||(state.mode==='acc'&&state.input==='v'))state.input='q';
  }
  try{restore(JSON.parse(localStorage.getItem(key)));}catch{}
  if(intro){state.mode='static';state.a=Z();state.v=Z();state.input='q';state.panel='gravity';}
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{} }
  $('joint-inputs').innerHTML=active.map((joint,i)=>`<div class="joint-input"><div class="input-head"><button class="joint-button" type="button" data-joint="${i}" aria-label="观察 J${i+1}">J${i+1}</button><label class="input-value"><input id="number-${i}" type="number" aria-label="J${i+1} 角度"><small id="unit-${i}">°</small></label></div><input id="range-${i}" type="range" aria-label="J${i+1} 角度"></div>`).join('');
  const canvas=$('lab-canvas'),scene=YamLabScene.create(canvas,D,model);let result,computeCount=0;
  function config(i){return state.input==='q'?{min:Math.ceil(active[i].lower*180/Math.PI*10)/10,max:Math.floor(active[i].upper*180/Math.PI*10)/10,step:.1,unit:'°',name:'角度',mult:Math.PI/180}:state.input==='a'?{min:-3,max:3,step:.05,unit:'rad/s²',name:'加速度',mult:1}:{min:-2,max:2,step:.05,unit:'rad/s',name:'速度',mult:1};}
  function sync(){
    all('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    all('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===state.panel)));
    all('[data-detail]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.detail===state.panel)));
    for(const panel of ['gravity','mass','velocity'])$('panel-'+panel).hidden=panel!==state.panel;
    all('[data-input]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.input===state.input));b.disabled=(b.dataset.input==='a'&&state.mode==='static')||(b.dataset.input==='v'&&state.mode!=='motion');});
    all('[data-joint]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.joint)===state.j)));
    for(let i=0;i<6;i++){
      const cfg=config(i),value=state[state.input][i]/cfg.mult;
      for(const id of ['number-','range-']){const e=$(id+i);e.min=cfg.min;e.max=cfg.max;e.step=cfg.step;if(document.activeElement!==e)e.value=fmt(value,state.input==='q'?1:2);e.setAttribute('aria-label',`J${i+1} ${cfg.name} / ${cfg.unit}`);}
      $('unit-'+i).textContent=cfg.unit;
    }
    $('output-joint').value=state.j;$('show-com').checked=state.com;
    $('stage-note').textContent={static:'q̇ = 0，q̈ = 0 → τ = g(q)',acc:'q̇ = 0 → τ = M(q)q̈ + g(q)',motion:'τ = M(q)q̈ + c(q,q̇) + g(q)'}[state.mode];
    $('input-note').textContent=state.input==='q'?(intro?'拖动滑块，观察六个关节的力矩如何一起变化。':'拖动角度会改变几何关系、M 和 g。点击 J 标签选择观察关节。'):state.input==='a'?'加速度输入是当前瞬间的 q̈；在姿态不变时，M 不变。':'速度输入是当前瞬间的 q̇；计算科氏 / 离心项，不积分运动轨迹。';
    $('mass-status').textContent=state.a.every(x=>x===0)?'当前 q̈ = 0 → 此项为 0':'当前 M × q̈';
    $('velocity-status').textContent=state.v.every(x=>x===0)?'当前 q̇ = 0 → 此项为 0':'当前 q̇ ≠ 0';
    $('gravity-status').textContent='由当前姿态决定';
  }
  const svgFinish=svg=>svg.querySelectorAll('text').forEach(t=>{t.style.fill='var(--ink)';});
  function torqueBars(){
    if(!result)return;const svg=$('torque-bars'),w=svg.clientWidth;if(!w)return;const wide=w>550||(intro&&innerWidth<=520),cols=wide?2:1,cellW=w/cols,h=wide?218:390;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    const bound=Math.max(.02,...result.tau.map((_,i)=>{const parts=[result.acc[i],result.c[i],result.g[i]];return Math.max(parts.filter(x=>x>0).reduce((a,b)=>a+b,0),-parts.filter(x=>x<0).reduce((a,b)=>a+b,0));}))*1.12;
    let s='<title>六关节力矩分解；菱形为分量之和</title>';
    for(let j=0;j<6;j++){
      const col=wide?j%2:0,row=wide?Math.floor(j/2):j,off=col*cellW,y=14+row*60,left=off+10,right=off+cellW-(col===0&&wide?24:4),width=right-left,x=v=>left+(v/bound+1)*width/2;
      s+=`<text x="${left}" y="${y}" class="chart-label">J${j+1}</text><text x="${right}" y="${y}" text-anchor="end">${sgn(result.tau[j])}</text><rect x="${left}" y="${y+11}" width="${width}" height="15" fill="var(--soft)"/><line x1="${x(0)}" y1="${y+7}" x2="${x(0)}" y2="${y+32}" stroke="var(--muted)" stroke-width=".7"/>`;
      let pos=0,neg=0;for(const [val,color,name] of [[result.acc[j],'inertia','惯性'],[result.c[j],'velocity','速度项'],[result.g[j],'gravity','重力']]){const from=val>=0?pos:neg,to=from+val;if(val>=0)pos=to;else neg=to;s+=`<rect x="${Math.min(x(from),x(to))}" y="${y+11}" width="${Math.abs(x(to)-x(from))}" height="15" fill="var(--${color})"><title>J${j+1} ${name} ${val.toFixed(6)} N·m</title></rect>`;}
      const tx=x(result.tau[j]);s+=`<path d="M${tx},${y+25} l4,5 -4,5 -4,-5 Z" fill="var(--ink)"/>`;
      if(j===state.j)s+=`<line x1="${left}" y1="${y+40}" x2="${right}" y2="${y+40}" stroke="var(--inertia)" stroke-width="1"/>`;
    }
    for(let col=0;col<cols;col++){const left=col*cellW+10,right=(col+1)*cellW-(col===0&&wide?24:4);s+=`<text x="${left}" y="${h-7}">${fmt(-bound,1)}</text><text x="${(left+right)/2}" y="${h-7}" text-anchor="middle">0</text><text x="${right}" y="${h-7}" text-anchor="end">${fmt(bound,1)} N·m</text>`;}
    svg.innerHTML=s;svgFinish(svg);
  }
  function makeMatrix(rows,{kind,names,footer}){
    const max=Math.max(1e-12,...rows.flat().map(Math.abs));
    return `<table class="data-matrix"><thead><tr><th>${kind==='mass'?'i / j':'连杆 / 关节'}</th>${Array.from({length:6},(_,j)=>`<th>J${j+1}</th>`).join('')}</tr></thead><tbody>${rows.map((row,i)=>`<tr class="${kind==='mass'&&i===state.j?'active-row':''}"><th>${names[i]}</th>${row.map((v,j)=>{
      const selected=kind==='mass'?i===state.j&&j===state.col:names[i]===state.link&&j===state.j,cell=`${kind}-${i}-${j}`,color=kind==='mass'?'inertia':'gravity';
      return `<td class="${kind==='mass'&&j===state.col?'column-focus':''}"><button id="${cell}" type="button" data-${kind}-row="${i}" data-col="${j}" data-value="${v}" class="${selected?'active-cell':''}" style="--cell-bg:color-mix(in srgb,var(--${color}) ${Math.round(4+32*Math.sqrt(Math.abs(v)/max))}%,var(--surface))" aria-pressed="${selected}" aria-label="${names[i]}，J${j+1}，${v.toPrecision(7)} ${kind==='mass'?'kg·m²':'N·m'}" title="${v.toPrecision(8)}">${kind==='mass'?mfmt(v):brief(v)}</button></td>`;
    }).join('')}</tr>`).join('')}</tbody>${footer?`<tfoot><tr><th>g 合计</th>${footer.map(v=>`<td>${brief(v)}</td>`).join('')}</tr></tfoot>`:''}</table>`;
  }
  function gravityPanel(){
    const names=result.links.map(l=>l.name);$('gravity-matrix').innerHTML=makeMatrix(names.map(n=>result.gravityByLink[n]),{kind:'gravity',names,footer:result.g});
    const f=result.fk.frames[state.link],j=state.j,axis=result.fk.axes[j],p=result.fk.origins[j],r=D.sub(f.com,p),F=[0,0,-9.81*f.link.mass],n=D.cross(r,F),downstream=f.ancestors.includes(j);
    const rows=[['URDF 质量',fmt(f.link.mass,6)+' kg'],['世界质心 c',vec(f.com)+' m'],['关节原点 p',vec(p)+' m']];
    if(downstream)rows.push(['r = c − p',vec(r)+' m'],['关节正轴 a',vec(axis)],['重力 F',vec(F,3)+' N'],['空间力矩 r × F',vec(n)+' N·m'],['投影 a · (r × F)',sgn(D.dot(axis,n),6)+' N·m']);
    $('gravity-derivation').innerHTML=`<div class="derivation-title">${esc(state.link)} → J${j+1}</div>${rows.map(([a,b])=>`<div class="derivation-row"><span>${a}</span><code>${b}</code></div>`).join('')}<div class="derivation-answer">补偿 ${sgn(result.gravityByLink[state.link][j],6)} N·m</div><p class="micro">${downstream?'对投影力矩取负号，再与同一列其他连杆的贡献相加。':'该连杆位于此关节上游，不随此关节转动。对应雅可比列为 0，因此这一贡献为 0。'}</p>`;
  }
  function massPanel(){
    $('mass-matrix').innerHTML=makeMatrix(result.M,{kind:'mass',names:active.map((_,i)=>'J'+(i+1))});
    $('acc-vector').innerHTML=state.a.map((v,j)=>`<div class="${j===state.col?'selected':''}"><span>J${j+1}</span>${sgn(v,2)}</div>`).join('');
    $('inertia-vector').innerHTML=result.acc.map((v,j)=>`<div class="${j===state.j?'selected':''}"><span>J${j+1}</span>${brief(v)}</div>`).join('');
    $('mass-state-note').textContent=state.a.every(x=>x===0)?'当前 q̈ = 0：质量矩阵仍然存在，并随姿态变化；M × 0 = 0，所以惯性项为零。选择上方「02 加入加速度」可观察非零结果。':'当前瞬时加速度已启用。改变一列的 q̈，会通过这一整列 M 影响多个关节的惯性力矩。';
    const i=state.j,j=state.col;
    $('row-title').textContent=`J${i+1}：把第 ${i+1} 行的六个乘积相加 = ${sgn(result.acc[i],5)} N·m`;
    $('row-products').innerHTML=result.M[i].map((m,k)=>`<div class="product-cell ${k===j?'selected':''}"><div class="term-label">M${i+1}${k+1} × q̈${k+1}</div><code>${fmt(m,5)}</code><code>× (${sgn(state.a[k],2)})</code><strong>= ${sgn(m*state.a[k],5)}</strong></div>`).join('');
    $('mass-cell-title').textContent=`M${i+1}${j+1} = ${result.M[i][j].toPrecision(7)} kg·m²`;
    $('mass-origin-rows').innerHTML=result.links.map(l=>`<tr><td>${l.name}</td><td>${sgn(l.linear[i][j],6)}</td><td>${sgn(l.angular[i][j],6)}</td><td>${sgn(l.linear[i][j]+l.angular[i][j],6)}</td></tr>`).join('');
    const trans=result.links.reduce((s,l)=>s+l.linear[i][j],0),rot=result.links.reduce((s,l)=>s+l.angular[i][j],0);
    $('mass-origin-total').innerHTML=`<tr><th>合计 / kg·m²</th><td>${sgn(trans,6)}</td><td>${sgn(rot,6)}</td><td>${sgn(result.M[i][j],6)}</td></tr>`;
  }
  function velocityPanel(){
    const doubled=D.inverse(model,state.q,state.v.map(v=>2*v),Z(),[0,0,0]).tau;
    $('velocity-rows').innerHTML=state.v.map((v,j)=>`<tr><td>J${j+1}</td><td>${sgn(v,2)}</td><td>${sgn(result.c[j],6)}</td><td>${sgn(doubled[j],6)}</td></tr>`).join('');
    $('velocity-link-title').textContent=`J${state.j+1}：各连杆的速度项贡献 / N·m`;
    const rows=result.links.map(l=>({name:l.name,value:result.velocityByLink[l.name][state.j]})),svg=$('velocity-links'),w=svg.clientWidth||400,h=rows.length*29+40,l=76,r=80,max=Math.max(.001,...rows.map(x=>Math.abs(x.value)))*1.12,x=v=>l+(v/max+1)*(w-l-r)/2;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    let s='<title>速度项的连杆贡献</title>';
    rows.forEach((v,k)=>{const y=16+k*29;s+=`<text x="${l-9}" y="${y+3}" text-anchor="end">${v.name}</text><rect x="${Math.min(x(0),x(v.value))}" y="${y-7}" width="${Math.abs(x(v.value)-x(0))}" height="14" fill="var(--velocity)"/><text x="${w-4}" y="${y+3}" text-anchor="end">${sgn(v.value)}</text>`;});
    s+=`<line x1="${x(0)}" y1="0" x2="${x(0)}" y2="${h-25}" stroke="var(--line)"/>`;
    [-max,0,max].forEach(v=>s+=`<text x="${x(v)}" y="${h-6}" text-anchor="${v<0?'start':v>0?'end':'middle'}">${fmt(v,max<.01?3:2)}</text>`);svg.innerHTML=s;svgFinish(svg);
  }
  function selectedTotal(){
    const i=state.j;$('joint-total').innerHTML=`<span>J${i+1} 的完整计算 / N·m</span><span class="sum"><span class="inertia">(${sgn(result.acc[i])})</span> + <span class="velocity">(${sgn(result.c[i])})</span> + <span class="gravity">(${sgn(result.g[i])})</span> = <strong>${sgn(result.tau[i])}</strong></span>`;
  }
  function render(recalculate=true){
    if(recalculate){result=YamLabMath.compute(D,model,state.q,state.v,state.a);computeCount++;}
    sync();scene.draw(result,state);torqueBars();
    if(state.panel==='gravity')gravityPanel();else if(state.panel==='mass')massPanel();else velocityPanel();
    selectedTotal();root.dataset.ready='true';root.dataset.torques=JSON.stringify(result.tau);
    root.dataset.state=JSON.stringify({q:state.q,v:state.v,a:state.a,j:state.j,col:state.col,mode:state.mode,panel:state.panel});
  }
  function setPanel(panel){state.panel=panel;render(false);save();}
  function selectJoint(j){state.j=j;render(false);save();}
  all('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    state.mode=b.dataset.mode;
    if(state.mode==='static'){state.a=Z();state.v=Z();state.panel='gravity';state.input='q';}
    if(state.mode==='acc'){state.v=Z();if(state.a.every(v=>v===0))state.a[1]=1;state.panel='mass';state.input='a';}
    if(state.mode==='motion'){if(state.v.every(v=>v===0))state.v=[.25,.6,-.4,.15,0,0];state.panel='velocity';state.input='v';}
    render();save();
  }));
  all('[data-panel]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel)));
  all('[data-detail]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.detail)));
  all('[data-input]').forEach(b=>b.addEventListener('click',()=>{state.input=b.dataset.input;sync();save();}));
  all('[data-joint]').forEach(b=>b.addEventListener('click',()=>selectJoint(Number(b.dataset.joint))));
  $('output-joint').addEventListener('change',e=>selectJoint(Number(e.target.value)));
  for(let i=0;i<6;i++)for(const prefix of ['number-','range-'])$(prefix+i).addEventListener('input',e=>{
    const value=e.target.valueAsNumber;if(!Number.isFinite(value))return;const cfg=config(i),bounded=Math.max(cfg.min,Math.min(cfg.max,value));state[state.input][i]=bounded*cfg.mult;if(value!==bounded)e.target.value=bounded;render();save();
  });
  $('gravity-matrix').addEventListener('click',e=>{const b=e.target.closest('[data-gravity-row]');if(!b)return;state.link=result.links[Number(b.dataset.gravityRow)].name;state.j=Number(b.dataset.col);render(false);save();});
  $('mass-matrix').addEventListener('click',e=>{const b=e.target.closest('[data-mass-row]');if(!b)return;state.j=Number(b.dataset.massRow);state.col=Number(b.dataset.col);render(false);save();});
  $('reset-pose').addEventListener('click',()=>{state.q=example.slice();render();save();});
  $('show-com').addEventListener('change',e=>{state.com=e.target.checked;scene.draw(result,state);save();});
  $('view-iso').addEventListener('click',()=>{state.yaw=.7;state.pitch=.4;scene.draw(result,state);save();});
  $('view-side').addEventListener('click',()=>{state.yaw=0;state.pitch=0;scene.draw(result,state);save();});
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag.x)*.008;state.pitch=Math.max(-1.5,Math.min(1.5,state.pitch+(e.clientY-drag.y)*.006));drag.x=e.clientX;drag.y=e.clientY;scene.draw(result,state);});
  function release(e){if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5){const r=canvas.getBoundingClientRect(),j=scene.pick(e.clientX-r.x,e.clientY-r.y);if(j!==undefined)selectJoint(j);}drag=null;canvas.style.cursor='grab';save();}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{drag=null;canvas.style.cursor='grab';});
  let resizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{scene.draw(result,state);torqueBars();if(state.panel==='velocity')velocityPanel();});}).observe(root);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{scene.theme();scene.draw(result,state);});
  $('urdf-rows').innerHTML=Object.values(model.links).map(l=>`<tr><td>${l.name}</td><td>${fmt(l.mass,6)}</td><td>${vec(l.inertial.xyz,5)}</td></tr>`).join('');
  render();
  // Expose read-only numeric snapshots for browser regression checks and reproducibility.
  window.yamLabSnapshot=()=>JSON.parse(JSON.stringify({state,result:{M:result.M,g:result.g,c:result.c,acc:result.acc,tau:result.tau},computeCount}));
})();
