(() => {
  const root=document.getElementById('yam-gravity-explorer'), D=YamDynamics, model=YAM_GRAVITY_MODEL;
  const $=id=>root.querySelector('#'+id), active=model.joints.filter(j=>j.active);
  const state={q:[0,1.3,1,0,0,0],j:1,driver:3,referenceQ:null,yaw:.7,pitch:.4};
  const fmt=(v,n=3)=>Math.abs(v)<.5*10**(-n)?(0).toFixed(n):v.toFixed(n);
  const signed=(v,n=3)=>(v>=.5*10**(-n)?'+':'')+fmt(v,n);
  const torqueText=v=>Math.abs(v)<.0005?'≈ 0':signed(v);
  function restore(snapshot){
    const s=snapshot?.modelContent||snapshot;
    if(s?.lesson==='yam-gravity'){
      if(Array.isArray(s.q)&&s.q.length===6&&s.q.every(Number.isFinite))state.q=s.q.map((q,i)=>Math.max(active[i].lower,Math.min(active[i].upper,q)));
      if(Number.isInteger(s.driver)&&s.driver>=0&&s.driver<6)state.driver=s.driver;
      if(Array.isArray(s.referenceQ)&&s.referenceQ.length===6&&s.referenceQ.every(Number.isFinite))state.referenceQ=s.referenceQ.map((q,i)=>Math.max(active[i].lower,Math.min(active[i].upper,q)));
      if(Number.isInteger(s.j))state.j=Math.max(0,Math.min(5,s.j));
      const p=snapshot?.privateContent;
      if(Number.isFinite(p?.yaw)&&Number.isFinite(p?.pitch)){state.yaw=p.yaw;state.pitch=p.pitch;}
    }
  }
  try { restore(JSON.parse(localStorage.getItem('rdn-gravity-v1') || 'null')); } catch {}
  if(!state.referenceQ||state.q.some((v,i)=>i!==state.driver&&Math.abs(v-state.referenceQ[i])>1e-9))state.referenceQ=state.q.slice();
  function save(){try{localStorage.setItem('rdn-gravity-v1',JSON.stringify({modelContent:{lesson:'yam-gravity',q:state.q,j:state.j,driver:state.driver,referenceQ:state.referenceQ},privateContent:{yaw:state.yaw,pitch:state.pitch}}));}catch{}}
  $('yg-sliders').innerHTML=active.map((joint,i)=>`<div class="yg-joint-control"><div class="yg-slider-head"><label class="form-label" for="yg-q${i}">J${i+1} 角度</label><span id="yg-angle${i}" class="tabular-nums"></span></div><input class="form-range" id="yg-q${i}" type="range" min="${Math.ceil(joint.lower*180/Math.PI*10)/10}" max="${Math.floor(joint.upper*180/Math.PI*10)/10}" step="0.1" aria-describedby="yg-tau${i}"><div class="yg-torque text-small"><span id="yg-tau${i}" class="tabular-nums"></span><div class="yg-meter" aria-hidden="true"><div id="yg-meter${i}" class="yg-meter-fill"></div></div></div></div>`).join('');
  const canvas=$('yg-canvas'),overview=YamLabScene.create(canvas,D,model,{ink:'foreground',muted:'muted-foreground',surface:'background',line:'border',inertia:'viz-series-1',gravity:'viz-series-2'});let result,info,comparison;
  function renderScene(){if(result)overview.draw(result,{...state,j:state.driver,panel:'mass',com:true,hint:'拖动旋转 · 点击 J 标签选择转动关节'});}
  function refreshColors(){overview.theme();}
  function svgText(svg){svg.querySelectorAll('text').forEach(t=>{t.style.fill='var(--foreground)';t.style.fontSize='12px';});}
  function renderPlane(){
    if(!info||!$('yg-detail').open)return;const svg=$('yg-plane'),w=svg.clientWidth,h=246;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    const blue='var(--viz-series-1)',orange='var(--viz-series-2)';
    let s=`<title>J${state.j+1} 的转动平面：从正轴端看向关节</title><defs><marker id="yg-blue-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${blue}"/></marker><marker id="yg-orange-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${orange}"/></marker></defs><text x="6" y="15">从 J${state.j+1} 正轴端看向关节</text>`;
    if(info.degenerate){
      const x=w/2,y=118;
      s+=`<circle cx="${x}" cy="${y}" r="6" fill="${blue}"/><circle cx="${x}" cy="${y}" r="38" fill="none" stroke="var(--border)"/><text x="${x}" y="186" text-anchor="middle">关节轴几乎竖直 · 重力几乎平行于轴</text><text x="${x}" y="210" text-anchor="middle">平面内的重力分量 ≈ 0 → 补偿 ≈ 0</text>`;
    }else{
      const minX=Math.min(0,info.x),maxX=Math.max(0,info.x),minY=Math.min(0,info.y),maxY=Math.max(0,info.y);
      const scale=Math.min((w-138)/Math.max(.16,maxX-minX),90/Math.max(.16,maxY-minY));
      const mx=(minX+maxX)/2,my=(minY+maxY)/2;
      const p=[w/2-mx*scale,104+my*scale],c=[w/2+(info.x-mx)*scale,104-(info.y-my)*scale],by=209;
      s+=`<line x1="${p[0]}" y1="${p[1]}" x2="${c[0]}" y2="${c[1]}" stroke="var(--muted-foreground)" stroke-dasharray="4 4"/><line x1="${c[0]}" y1="40" x2="${c[0]}" y2="${by}" stroke="var(--border)"/><circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${blue}"/><text x="${p[0]-10}" y="${p[1]-16}" text-anchor="end">J${state.j+1}</text><path d="M ${c[0]} ${c[1]-6} l 6 6 l -6 6 l -6 -6 Z" fill="${orange}"/><text x="${c[0]+(c[0]>w-105?-9:9)}" y="${c[1]-12}" text-anchor="${c[0]>w-105?'end':'start'}">总质心投影</text><line x1="${c[0]}" y1="${c[1]+7}" x2="${c[0]}" y2="${c[1]+48}" stroke="${orange}" stroke-width="3" marker-end="url(#yg-orange-arrow)"/>`;
      s+=`<line x1="${p[0]}" y1="${by-5}" x2="${p[0]}" y2="${by+5}" stroke="var(--muted-foreground)"/><line x1="${c[0]}" y1="${by-5}" x2="${c[0]}" y2="${by+5}" stroke="var(--muted-foreground)"/><line x1="${p[0]}" y1="${by}" x2="${c[0]}" y2="${by}" stroke="var(--muted-foreground)"/><text x="${w/2}" y="${by+22}" text-anchor="middle">带符号力臂 ${signed(info.x,4)} m</text>`;
      if(Math.abs(info.torque)>.0005){
        const dir=Math.sign(info.torque),r=25,pts=[];for(let k=0;k<=25;k++){const t=.3+dir*k/25*4.2;pts.push([p[0]+r*Math.cos(t),p[1]-r*Math.sin(t)]);}
        s+=`<path d="M${pts.map(p=>p.join(',')).join(' L')}" fill="none" stroke="${blue}" stroke-width="2" marker-end="url(#yg-blue-arrow)"/>`;
      }
      s+=`<text x="6" y="${h-3}">电机：${Math.abs(info.torque)<.0005?'≈ 0':info.torque>0?'逆时针（＋）':'顺时针（−）'}</text>`;
    }
    svg.innerHTML=s;svgText(svg);
  }
  function renderBreakdown(){
    if(!info)return;
    $('yg-link-rows').innerHTML=info.rows.map(r=>`<tr><td>${r.name}</td><td>${fmt(r.mass,6)}</td><td>${info.degenerate?'—':signed(r.x,4)}</td><td>${signed(r.torque,6)}</td></tr>`).join('');
    $('yg-mass-sum').textContent=fmt(info.mass,6);$('yg-torque-sum').textContent=signed(info.torque,6);
    if(!$('yg-breakdown').open)return;
    const svg=$('yg-contributions'),w=svg.clientWidth,h=info.rows.length*28+53,left=80,right=73,plotW=Math.max(80,w-left-right),max=Math.max(.001,...info.rows.map(r=>Math.abs(r.torque)))*1.08,x=v=>left+(v/max+1)*plotW/2;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);
    let s=`<title>J${state.j+1} 的逐连杆重力补偿贡献</title><rect data-chart-frame x="${left}" y="4" width="${plotW}" height="${h-43}" fill="none" stroke="var(--border)"/><line x1="${x(0)}" y1="4" x2="${x(0)}" y2="${h-39}" stroke="var(--border)"/>`;
    info.rows.forEach((r,i)=>{const y=20+i*28;s+=`<text x="${left-9}" y="${y+4}" text-anchor="end">${r.name}</text><rect x="${Math.min(x(0),x(r.torque))}" y="${y-7}" width="${Math.abs(x(r.torque)-x(0))}" height="14" fill="var(--viz-series-1)"/><text x="${w-3}" y="${y+4}" text-anchor="end">${signed(r.torque)}</text>`;});
    [-max,0,max].forEach(v=>s+=`<text x="${x(v)}" y="${h-22}" text-anchor="${v<0?'start':v>0?'end':'middle'}">${fmt(v,max<.01?3:2)}</text>`);
    s+=`<text class="axis-title" data-axis="x" x="${left+plotW/2}" y="${h-3}" text-anchor="middle">补偿力矩 / N·m</text><text class="axis-title" data-axis="y" x="4" y="10">连杆</text>`;svg.innerHTML=s;svgText(svg);
  }
  function update(){
    comparison=GravityGeometry.compare(D,model,state.q,state.referenceQ,state.driver);result=comparison.current;info=comparison.infos[state.j];
    const max=Math.max(.01,...result.tau.map(Math.abs));
    state.q.forEach((q,i)=>{
      $('yg-q'+i).value=q*180/Math.PI;$('yg-angle'+i).textContent=fmt(q*180/Math.PI,1)+'°';
      $('yg-tau'+i).textContent=`补偿 ${torqueText(result.tau[i])} N·m`;
      const size=result.tau[i]/max*48,bar=$('yg-meter'+i);bar.style.left=(50+Math.min(0,size))+'%';bar.style.width=Math.abs(size)+'%';
    });
    $('yg-selected').value=state.j;$('yg-result').textContent=`J${state.j+1} 电机补偿：${torqueText(info.torque)} N·m`;
    $('yg-mass').textContent=fmt(info.mass,4)+' kg';
    $('yg-force').textContent=info.degenerate?'≈ 0 N':`${fmt(info.mass*9.81,3)} × ${fmt(info.sinTilt,4)} = ${fmt(info.force,3)} N`;
    $('yg-arm').textContent=info.degenerate?'—（重力几乎沿轴）':signed(info.x,4)+' m';
    $('yg-product').textContent=info.degenerate?'≈ 0 N·m':`${fmt(info.force,3)} × (${signed(info.x,4)}) ≈ ${signed(info.torque)} N·m`;
    GravityCouplingView.render(root,comparison,state,active);
    renderScene();renderPlane();renderBreakdown();root.dataset.ready='true';root.dataset.torques=JSON.stringify(result.tau);
  }
  function selectDriver(i){
    if(i!==state.driver){state.referenceQ=state.q.slice();state.driver=i;}
    update();save();
  }
  function changeAngle(i,angle){
    if(i!==state.driver){state.referenceQ=state.q.slice();state.driver=i;}
    state.q[i]=Math.max(active[i].lower,Math.min(active[i].upper,angle));update();save();
  }
  $('yg-chain').innerHTML=active.map((_,i)=>'<button type="button" data-driver="'+i+'"><b>J'+(i+1)+'</b><small></small></button>').join('<span aria-hidden="true">→</span>');
  $('yg-chain').addEventListener('click',e=>{const b=e.target.closest('[data-driver]');if(b)selectDriver(Number(b.dataset.driver));});
  $('yg-driver').addEventListener('change',e=>selectDriver(Number(e.target.value)));
  $('yg-coupled-angle').addEventListener('input',e=>changeAngle(state.driver,Number(e.target.value)*Math.PI/180));
  $('yg-nudge').addEventListener('click',()=>changeAngle(state.driver,Math.min(Number($('yg-coupled-angle').max)*Math.PI/180,state.q[state.driver]+Math.PI/6)));
  $('yg-reference').addEventListener('click',()=>{state.referenceQ=state.q.slice();update();save();});
  $('yg-revert').addEventListener('click',()=>{state.q=state.referenceQ.slice();update();save();});
  $('yg-response-grid').addEventListener('click',e=>{
    const b=e.target.closest('[data-detail-joint]');if(!b)return;
    state.j=Number(b.dataset.detailJoint);$('yg-detail').open=true;update();save();$('yg-detail').scrollIntoView({block:'start'});$('yg-selected').focus({preventScroll:true});
  });
  $('yg-detail').addEventListener('toggle',()=>{renderPlane();renderBreakdown();});
  for(let i=0;i<6;i++)$('yg-q'+i).addEventListener('input',e=>changeAngle(i,Number(e.target.value)*Math.PI/180));
  $('yg-selected').addEventListener('change',e=>{state.j=Number(e.target.value);update();save();});
  $('yg-side').addEventListener('click',()=>{state.yaw=0;state.pitch=0;renderScene();save();});
  $('yg-iso').addEventListener('click',()=>{state.yaw=.7;state.pitch=.4;renderScene();save();});
  $('yg-axis').addEventListener('click',()=>{const a=result.fk.axes[state.driver];state.pitch=Math.asin(Math.max(-1,Math.min(1,a[2])));state.yaw=Math.atan2(a[0],a[1]);renderScene();save();});
  $('yg-breakdown').addEventListener('toggle',renderBreakdown);
  let drag=null,dragStart=null;
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];dragStart=drag.slice();canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag[0])*.008;state.pitch=Math.max(-1.55,Math.min(1.55,state.pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];renderScene();});
  const release=e=>{if(e.type==='pointerup'&&dragStart&&Math.hypot(e.clientX-dragStart[0],e.clientY-dragStart[1])<5){const r=canvas.getBoundingClientRect(),j=overview.pick(e.clientX-r.x,e.clientY-r.y);if(j!==undefined)selectDriver(j);}drag=null;dragStart=null;canvas.style.cursor='grab';save();};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  new ResizeObserver(()=>{renderScene();renderPlane();renderBreakdown();}).observe(root);
  new MutationObserver(()=>{refreshColors();renderScene();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{refreshColors();renderScene();});
  window.yamGravitySnapshot=()=>({q:state.q.slice(),referenceQ:state.referenceQ.slice(),driver:state.driver,g:result.tau.slice(),referenceG:comparison.reference.tau.slice(),delta:comparison.delta.slice(),rows:comparison.rows.map(r=>({...r})),infos:comparison.infos.map(i=>({mass:i.mass,force:i.force,arm:i.x,degenerate:i.degenerate}))});
  refreshColors();update();
})();
