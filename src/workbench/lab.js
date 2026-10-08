(() => {
  const root=document.getElementById('yam-lab'),D=YamDynamics,model=LAB_MODEL;
  const $=id=>document.getElementById(id),all=s=>[...root.querySelectorAll(s)],active=model.joints.filter(j=>j.active),Z=()=>Array(6).fill(0);
  const intro=document.documentElement.classList.contains('intro');
  const example=[0,1.3,1,0,0,0],key=intro?'rdn-workbench-intro-v1':'rdn-workbench-full-v1';
  const state={q:example.slice(),a:Z(),v:Z(),j:1,col:1,link:'link3',mode:'static',panel:'gravity',input:'q',yaw:.7,pitch:.4,com:true,heat:intro};
  const components=[{key:'g',id:'gravity',name:'重力'},{key:'acc',id:'inertia',name:'惯性'},{key:'coriolis',id:'coriolis',name:'科氏'},{key:'centrifugal',id:'centrifugal',name:'离心'}];
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
    all('[data-joint]').forEach(b=>{const j=Number(b.dataset.joint);b.setAttribute('aria-pressed',String(j===state.j));if(intro&&result)b.style.color=YamTorqueHeat.css(result.tau[j]);});
    for(let i=0;i<6;i++){
      const cfg=config(i),value=state[state.input][i]/cfg.mult;
      for(const id of ['number-','range-']){const e=$(id+i);e.min=cfg.min;e.max=cfg.max;e.step=cfg.step;if(document.activeElement!==e)e.value=fmt(value,state.input==='q'?1:2);e.setAttribute('aria-label',`J${i+1} ${cfg.name} / ${cfg.unit}`);}
      $('unit-'+i).textContent=cfg.unit;
    }
    $('output-joint').value=state.j;$('show-com').checked=state.com;
    $('stage-note').textContent={static:'q̇ = 0，q̈ = 0 → τ = g(q)',acc:'q̇ = 0 → τ = M(q)q̈ + g(q)',motion:'τ = 惯性 + 科氏 + 离心 + 重力'}[state.mode];
    $('input-title').textContent={q:'关节角度',a:'关节加速度',v:'关节速度'}[state.input];
    $('torque-title').textContent='关节驱动力矩';
    $('input-note').textContent=state.input==='q'?'拖动角度会改变力矩分量。点击 J 标签选择观察关节。':state.input==='a'?'加速度输入是当前瞬间的 q̈；在姿态不变时，M 不变。':'速度输入是当前瞬间的 q̇；科氏与离心分开展示，不积分运动轨迹。';
    $('mass-status').textContent=state.a.every(x=>x===0)?'当前 q̈ = 0 → 此项为 0':'当前 M × q̈';
    $('coriolis-status').textContent=state.v.filter(x=>x!==0).length<2?'不足两个非零速度 → 此项为 0':'不同关节速度的交叉乘积';
    $('centrifugal-status').textContent=state.v.every(x=>x===0)?'当前 q̇ = 0 → 此项为 0':'各关节速度的平方项';
    $('gravity-status').textContent='由当前姿态决定';
    $('component-state-note').textContent={static:'静止：只有重力补偿；惯性、科氏、离心均为 0。切换「加入加速度」「加入速度」观察动态分量。',acc:'加速度已启用：惯性与重力共同决定总力矩。当前速度为 0，科氏、离心均为 0。',motion:'同一瞬间的四项力矩相加得到总力矩。正负分量可能抵消；速度为 0 的分量仍会明确列出。'}[state.mode];
  }
  const svgFinish=svg=>svg.querySelectorAll('text').forEach(t=>{t.style.fill=t.getAttribute('fill')||'var(--ink)';});
  function torqueBars(){
    if(!result)return;const svg=$('torque-bars'),w=svg.clientWidth;if(!w)return;const wide=w>550||(intro&&innerWidth<=520),cols=wide?2:1,cellW=w/cols,h=wide?218:390;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    const bound=Math.max(.02,...result.tau.map((_,i)=>{const parts=components.map(c=>result[c.key][i]);return Math.max(parts.filter(x=>x>0).reduce((a,b)=>a+b,0),-parts.filter(x=>x<0).reduce((a,b)=>a+b,0));}))*1.12;
    let s='<title>六关节力矩分解：重力、惯性、科氏、离心；菱形为四项之和</title>';
    for(let j=0;j<6;j++){
      const col=wide?j%2:0,row=wide?Math.floor(j/2):j,off=col*cellW,y=14+row*60,left=off+10,right=off+cellW-(col===0&&wide?24:4),width=right-left,x=v=>left+(v/bound+1)*width/2;
      s+=`<g class="torque-row" data-joint="${j}" data-torque="${result.tau[j]}"><text x="${left}" y="${y}" class="chart-label">J${j+1}</text><text x="${right}" y="${y}" text-anchor="end">${sgn(result.tau[j])}</text><rect x="${left}" y="${y+11}" width="${width}" height="15" fill="var(--soft)"/><line x1="${x(0)}" y1="${y+7}" x2="${x(0)}" y2="${y+32}" stroke="var(--muted)" stroke-width=".7"/>`;
      let pos=0,neg=0;
      for(const part of components){const val=result[part.key][j],from=val>=0?pos:neg,to=from+val;if(val>=0)pos=to;else neg=to;s+=`<rect class="torque-component" data-component="${part.id}" data-value="${val}" x="${Math.min(x(from),x(to))}" y="${y+11}" width="${Math.abs(x(to)-x(from))}" height="15" fill="var(--${part.id})"><title>J${j+1} ${part.name} ${val.toFixed(6)} N·m</title></rect>`;}
      const tx=x(result.tau[j]);s+=`<path d="M${tx},${y+25} l4,5 -4,5 -4,-5 Z" fill="var(--ink)"/>`;
      if(j===state.j)s+=`<line x1="${left}" y1="${y+40}" x2="${right}" y2="${y+40}" stroke="var(--inertia)" stroke-width="1"/>`;
      s+='</g>';
    }
    for(let col=0;col<cols;col++){const left=col*cellW+10,right=(col+1)*cellW-(col===0&&wide?24:4);s+=`<text x="${left}" y="${h-7}">${fmt(-bound,bound<.1?3:1)}</text><text x="${(left+right)/2}" y="${h-7}" text-anchor="middle">0</text><text x="${right}" y="${h-7}" text-anchor="end">${fmt(bound,bound<.1?3:1)}</text>`;}
    svg.innerHTML=s;svgFinish(svg);
  }
  function componentTable(){
    const parts=[...components,{key:'tau',id:'total',name:'总力矩'}],bound=Math.max(.001,...parts.flatMap(c=>result[c.key].map(Math.abs)));
    const focused=document.activeElement?.closest('#torque-components [data-output-joint]')?.dataset.outputJoint;
    $('torque-components').innerHTML=`<table class="component-table"><caption class="sr-only">六个关节的重力、惯性、科氏、离心与总力矩，单位 N·m</caption><thead><tr><th scope="col">关节</th>${parts.map(c=>`<th scope="col" class="${c.id}">${c.name}${c.id==='total'?' ◆':''}</th>`).join('')}</tr></thead><tbody>${result.tau.map((_,j)=>`<tr data-joint="${j}" class="${j===state.j?'selected':''}"><th scope="row"><button type="button" data-output-joint="${j}" aria-pressed="${j===state.j}" aria-label="观察 J${j+1} 的力矩分解">J${j+1}</button></th>${parts.map(c=>{const v=result[c.key][j];return `<td class="${c.id}" data-component="${c.id}" data-value="${v}"><span class="component-value" title="${v.toFixed(9)} N·m">${Math.abs(v)>1e-10&&Math.abs(v)<.00005?v.toExponential(2):sgn(v,4)}</span><span class="component-track" aria-hidden="true"><span class="component-fill" style="left:${v<0?50+v/bound*50:50}%;width:${Math.abs(v)/bound*50}%"></span></span></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
    if(focused!==undefined)$('torque-components').querySelector(`[data-output-joint="${focused}"]`).focus({preventScroll:true});
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
  function velocitySources(){
    if(!$('velocity-source-details').open)return;
    const i=state.j,squares=result.velocitySources.squares,pairs=result.velocitySources.pairs();
    $('velocity-source-title').textContent=`J${i+1}：每个速度乘积贡献多少力矩？`;
    $('velocity-source-rows').innerHTML=[...squares.map(s=>({name:`q̇${s.joint+1}²`,product:s.product,centrifugal:s.tau[i],coriolis:0})),...pairs.map(p=>({name:`q̇${p.joints[0]+1} × q̇${p.joints[1]+1}`,product:p.product,coriolis:p.tau[i],centrifugal:0}))].map(p=>`<tr><th scope="row">${p.name}</th><td>${sgn(p.product,4)}</td><td class="coriolis">${sgn(p.coriolis,6)}</td><td class="centrifugal">${sgn(p.centrifugal,6)}</td></tr>`).join('');
  }
  function velocityPanel(){
    // The velocity-product vector is homogeneous of degree two at fixed q.
    $('velocity-rows').innerHTML=state.v.map((v,j)=>`<tr><th scope="row">J${j+1}</th><td>${sgn(v,2)}</td><td class="coriolis">${sgn(result.coriolis[j],6)}</td><td class="centrifugal">${sgn(result.centrifugal[j],6)}</td><td>${sgn(result.c[j],6)}</td><td>${sgn(4*result.c[j],6)}</td></tr>`).join('');
    $('velocity-link-title').textContent=`J${state.j+1}：各连杆的科氏与离心贡献 / N·m`;
    const rows=result.links.map(l=>({name:l.name,coriolis:result.coriolisByLink[l.name][state.j],centrifugal:result.centrifugalByLink[l.name][state.j]})),svg=$('velocity-links'),w=svg.clientWidth||400,h=rows.length*44+40,l=68,r=86,max=Math.max(.001,...rows.flatMap(x=>[Math.abs(x.coriolis),Math.abs(x.centrifugal)]))*1.12,x=v=>l+(v/max+1)*(w-l-r)/2;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    let s='<title>所选关节的各连杆科氏与离心贡献，成对显示</title>';
    rows.forEach((row,k)=>{const y=16+k*44;s+=`<text x="${l-9}" y="${y+7}" text-anchor="end">${row.name}</text>`;for(const [index,key] of ['coriolis','centrifugal'].entries()){const value=row[key],yy=y+index*15;s+=`<rect x="${Math.min(x(0),x(value))}" y="${yy-7}" width="${Math.abs(x(value)-x(0))}" height="10" fill="var(--${key})"><title>${row.name} ${key==='coriolis'?'科氏':'离心'} ${sgn(value,6)} N·m</title></rect><text x="${w-4}" y="${yy+2}" text-anchor="end" fill="var(--${key})">${sgn(value,4)}</text>`;}});
    s+=`<line x1="${x(0)}" y1="0" x2="${x(0)}" y2="${h-25}" stroke="var(--line)"/>`;
    [-max,0,max].forEach(v=>s+=`<text x="${x(v)}" y="${h-6}" text-anchor="${v<0?'start':v>0?'end':'middle'}">${fmt(v,max<.01?3:2)}</text>`);svg.innerHTML=s;svgFinish(svg);velocitySources();
  }
  function selectedTotal(){
    const i=state.j;$('joint-total').innerHTML=`<span>J${i+1} 的完整计算 / N·m</span><span class="sum">${components.map(c=>`<span class="${c.id}"><small>${c.name}</small> (${sgn(result[c.key][i],4)})</span>`).join(' + ')} = <strong>${sgn(result.tau[i],4)}</strong></span>`;
  }
  function render(recalculate=true){
    if(recalculate){result=YamLabMath.compute(D,model,state.q,state.v,state.a);computeCount++;}
    sync();scene.draw(result,state);torqueBars();componentTable();
    if(state.panel==='gravity')gravityPanel();else if(state.panel==='mass')massPanel();else velocityPanel();
    selectedTotal();root.dataset.ready='true';root.dataset.torques=JSON.stringify(result.tau);
    root.dataset.state=JSON.stringify({q:state.q,v:state.v,a:state.a,j:state.j,col:state.col,mode:state.mode,panel:state.panel});
  }
  function setPanel(panel){state.panel=panel;render(false);save();}
  function selectJoint(j){state.j=j;render(false);save();}
  all('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.mode==='motion'&&state.mode==='static'&&state.a.every(x=>x===0))state.a[1]=1;
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
  $('torque-components').addEventListener('click',e=>{const b=e.target.closest('[data-output-joint]');if(b)selectJoint(Number(b.dataset.outputJoint));});
  $('torque-bars').addEventListener('click',e=>{const row=e.target.closest('[data-joint]');if(row)selectJoint(Number(row.dataset.joint));});
  $('velocity-source-details').addEventListener('toggle',()=>{if(result)velocitySources();});
  all('[data-velocity-preset]').forEach(b=>b.addEventListener('click',()=>{
    state.mode='motion';state.input='v';state.panel='velocity';state.a=Z();
    state.v=[0,.8,b.dataset.velocityPreset==='single'?0:b.dataset.velocityPreset==='pair'?.6:-.6,0,0,0];
    render();save();
  }));
  $('zero-velocity').addEventListener('click',()=>{state.v=Z();render();save();});
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
  window.yamLabSnapshot=()=>JSON.parse(JSON.stringify({state,result:{M:result.M,g:result.g,c:result.c,coriolis:result.coriolis,centrifugal:result.centrifugal,acc:result.acc,tau:result.tau},computeCount}));
})();
