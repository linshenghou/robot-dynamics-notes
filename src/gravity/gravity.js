(() => {
  const root=document.getElementById('yam-gravity-explorer'), D=YamDynamics, model=YAM_GRAVITY_MODEL;
  const $=id=>root.querySelector('#'+id), active=model.joints.filter(j=>j.active), z=Array(6).fill(0);
  const state={q:[0,1.3,1,0,0,0],j:1,yaw:.7,pitch:.4};
  const fmt=(v,n=3)=>Math.abs(v)<.5*10**(-n)?(0).toFixed(n):v.toFixed(n);
  const signed=(v,n=3)=>(v>=.5*10**(-n)?'+':'')+fmt(v,n);
  const torqueText=v=>Math.abs(v)<.0005?'≈ 0':signed(v);
  function restore(snapshot){
    const s=snapshot?.modelContent||snapshot;
    if(s?.lesson==='yam-gravity'){
      if(Array.isArray(s.q)&&s.q.length===6&&s.q.every(Number.isFinite))state.q=s.q.map((q,i)=>Math.max(active[i].lower,Math.min(active[i].upper,q)));
      if(Number.isInteger(s.j))state.j=Math.max(0,Math.min(5,s.j));
      const p=snapshot?.privateContent;
      if(Number.isFinite(p?.yaw)&&Number.isFinite(p?.pitch)){state.yaw=p.yaw;state.pitch=p.pitch;}
    }
  }
  try { restore(JSON.parse(localStorage.getItem('rdn-gravity-v1') || 'null')); } catch {}
  function save(){try{localStorage.setItem('rdn-gravity-v1',JSON.stringify({modelContent:{lesson:'yam-gravity',q:state.q,j:state.j},privateContent:{yaw:state.yaw,pitch:state.pitch}}));}catch{}}
  $('yg-sliders').innerHTML=active.map((joint,i)=>`<div class="yg-joint-control"><div class="yg-slider-head"><label class="form-label" for="yg-q${i}">J${i+1} 角度</label><span id="yg-angle${i}" class="tabular-nums"></span></div><input class="form-range" id="yg-q${i}" type="range" min="${Math.ceil(joint.lower*180/Math.PI*10)/10}" max="${Math.floor(joint.upper*180/Math.PI*10)/10}" step="0.1" aria-describedby="yg-tau${i}"><div class="yg-torque text-small"><span id="yg-tau${i}" class="tabular-nums"></span><div class="yg-meter" aria-hidden="true"><div id="yg-meter${i}" class="yg-meter-fill"></div></div></div></div>`).join('');
  const meshes=Object.values(model.links).map(link=>({name:link.name,vertices:link.mesh.vertices.map(v=>D.add(link.visual.xyz,D.mv(D.rpy(link.visual.rpy),v))),triangles:link.mesh.triangles}));
  const canvas=$('yg-canvas'),ctx=canvas.getContext('2d');let result,info,colors={};
  function refreshColors(){
    const probe=document.createElement('span'),pixel=document.createElement('canvas');pixel.width=pixel.height=1;const pc=pixel.getContext('2d');root.append(probe);
    for(const name of ['foreground','muted','muted-foreground','background','border','viz-series-1','viz-series-2']){
      probe.style.color=`var(--${name})`;const css=getComputedStyle(probe).color;pc.fillStyle=css;pc.fillRect(0,0,1,1);colors[name]={css,rgb:[...pc.getImageData(0,0,1,1).data].slice(0,3)};
    }probe.remove();
  }
  const rgb=a=>`rgb(${a.map(x=>Math.max(0,Math.min(255,Math.round(x)))).join(',')})`;
  function renderScene(){
    if(!result)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const view=p=>[cy*p[0]-sy*p[1],-sp*(sy*p[0]+cy*p[1])+cp*p[2],cp*(sy*p[0]+cy*p[1])+sp*p[2]];
    const worldMeshes=meshes.map(m=>{const f=result.fk.frames[m.name],world=m.vertices.map(v=>D.add(f.p,D.mv(f.R,v)));return {...m,world,points:world.map(view)};});
    const gravityEnd=D.add(info.com,[0,0,-.13]),axisEnd=D.add(info.p,D.scale(info.a,.13));
    const bounds=worldMeshes.flatMap(m=>m.points).concat([view(gravityEnd),view(axisEnd)]);
    const minX=Math.min(...bounds.map(p=>p[0])),maxX=Math.max(...bounds.map(p=>p[0])),minY=Math.min(...bounds.map(p=>p[1])),maxY=Math.max(...bounds.map(p=>p[1]));
    const scale=Math.min((w-100)/Math.max(.36,maxX-minX),(h-94)/Math.max(.42,maxY-minY)),mx=(maxX+minX)/2,my=(maxY+minY)/2;
    const screen=p=>[(p[0]-mx)*scale+w/2,h/2-(p[1]-my)*scale],proj=p=>screen(view(p));
    const line=(a,b,c,width=1,dash=[])=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);};
    const head=(a,b,c)=>{const t=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.beginPath();ctx.moveTo(...b);ctx.lineTo(b[0]-8*Math.cos(t-.45),b[1]-8*Math.sin(t-.45));ctx.lineTo(b[0]-8*Math.cos(t+.45),b[1]-8*Math.sin(t+.45));ctx.closePath();ctx.fillStyle=c;ctx.fill();};
    const arrow=(a,b,c,width=2)=>{const p=proj(a),q=proj(b);line(p,q,c,width);if(Math.hypot(q[0]-p[0],q[1]-p[1])>3)head(p,q,c);};
    for(let k=-2;k<=4;k++){line(proj([k*.1,-.2,0]),proj([k*.1,.4,0]),colors.border.css);line(proj([-.2,k*.1,0]),proj([.4,k*.1,0]),colors.border.css);}
    const faces=[],selectedNames=new Set(info.frames.map(f=>f.link.name));
    for(const mesh of worldMeshes){
      const highlighted=selectedNames.has(mesh.name),color=colors[highlighted?'viz-series-1':'foreground'].rgb;
      const base=color.map((v,i)=>v*(highlighted?.55:.38)+colors.background.rgb[i]*(highlighted?.45:.62));
      for(const tri of mesh.triangles){
        const p=tri.map(i=>mesh.points[i]),world=tri.map(i=>mesh.world[i]);
        const normal=D.cross(D.sub(world[1],world[0]),D.sub(world[2],world[0])),n=Math.sqrt(D.dot(normal,normal));if(n<1e-10)continue;
        const light=.62+.38*Math.abs(D.dot(D.scale(normal,1/n),[.3,-.4,.866]));
        faces.push({p,depth:p.reduce((s,p)=>s+p[2],0)/3,c:rgb(base.map(v=>v*light))});
      }
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces){const p=f.p.map(screen);ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.fillStyle=f.c;ctx.fill();}
    ctx.font=`12px ${getComputedStyle(root).fontFamily}`;ctx.textBaseline='middle';
    const occupied=[];
    function label(text,p,dx=10,dy=-14){
      const len=ctx.measureText(text).width,x=Math.max(5,Math.min(w-len-5,p[0]+dx));let y=Math.max(14,Math.min(h-22,p[1]+dy));
      for(let k=0;k<10&&occupied.some(r=>x<r.x+r.w+4&&x+len>r.x-4&&Math.abs(y-r.y)<17);k++)y=Math.max(14,Math.min(h-22,p[1]+dy+(k%2?-1:1)*(22+k*8)));
      occupied.push({x,y,w:len});ctx.fillStyle=colors.background.css;ctx.globalAlpha=.9;ctx.fillRect(x-3,y-9,len+6,18);ctx.globalAlpha=1;ctx.fillStyle=colors.foreground.css;ctx.fillText(text,x,y);
    }
    const blue=colors['viz-series-1'].css,orange=colors['viz-series-2'].css;
    for(const f of info.frames){const p=proj(f.com);ctx.beginPath();ctx.arc(...p,3,0,2*Math.PI);ctx.fillStyle=colors['muted-foreground'].css;ctx.fill();}
    line(proj(info.p),proj(info.com),colors['muted-foreground'].css,1,[4,4]);
    result.fk.jointFrames.forEach((f,i)=>{const p=proj(f.p);ctx.beginPath();ctx.arc(...p,i===state.j?5:2.5,0,2*Math.PI);ctx.fillStyle=i===state.j?blue:colors['muted-foreground'].css;ctx.fill();});
    arrow(D.add(info.p,D.scale(info.a,-.04)),axisEnd,blue,2.5);
    label(`J${state.j+1} 正轴`,proj(axisEnd),8,-10);
    const com=proj(info.com);ctx.beginPath();ctx.moveTo(com[0],com[1]-6);ctx.lineTo(com[0]+6,com[1]);ctx.lineTo(com[0],com[1]+6);ctx.lineTo(com[0]-6,com[1]);ctx.closePath();ctx.fillStyle=orange;ctx.fill();
    arrow(info.com,gravityEnd,orange,3);label('下游总质心',com,10,-18);label(`重力 ${fmt(info.mass*9.81,2)} N`,proj(gravityEnd),10,14);
    if(Math.abs(info.torque)>.0005){
      const direction=Math.sign(info.torque),arc=[];
      for(let k=0;k<=35;k++){const t=.4+direction*k/35*4.2;arc.push(proj(D.add(info.p,D.add(D.scale(info.ex,.065*Math.cos(t)),D.scale(info.ey,.065*Math.sin(t))))));}
      ctx.beginPath();ctx.moveTo(...arc[0]);arc.slice(1).forEach(p=>ctx.lineTo(...p));ctx.strokeStyle=blue;ctx.lineWidth=2.5;ctx.stroke();head(arc[arc.length-2],arc[arc.length-1],blue);
      label(`电机 ${signed(info.torque)} N·m`,proj(info.p),-90,35);
    }else label('绕此轴的补偿 ≈ 0',proj(info.p),-80,28);
    ctx.fillStyle=colors['muted-foreground'].css;ctx.fillText('箭头示方向 · 拖动旋转视角',7,14);
    const l=.1*scale;line([w-l-14,h-18],[w-14,h-18],colors.foreground.css,2);ctx.fillStyle=colors.foreground.css;ctx.fillText('0.10 m',w-l-14,h-32);
    canvas.setAttribute('aria-label',`J${state.j+1} 下游总质量 ${fmt(info.mass)} kg，总重力 ${fmt(info.mass*9.81,2)} N，所需电机补偿 ${fmt(info.torque,6)} N·m。拖动可旋转视角。`);
  }
  function svgText(svg){svg.querySelectorAll('text').forEach(t=>{t.style.fill='var(--foreground)';t.style.fontSize='12px';});}
  function renderPlane(){
    if(!info)return;const svg=$('yg-plane'),w=svg.clientWidth,h=246;
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
    result=D.inverse(model,state.q,z,z);info=GravityGeometry.summarize(D,model,result,state.j);
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
    renderScene();renderPlane();renderBreakdown();root.dataset.ready='true';root.dataset.torques=JSON.stringify(result.tau);
  }
  for(let i=0;i<6;i++)$('yg-q'+i).addEventListener('input',e=>{state.q[i]=Number(e.target.value)*Math.PI/180;update();save();});
  $('yg-selected').addEventListener('change',e=>{state.j=Number(e.target.value);update();save();});
  $('yg-side').addEventListener('click',()=>{state.yaw=0;state.pitch=0;renderScene();save();});
  $('yg-iso').addEventListener('click',()=>{state.yaw=.7;state.pitch=.4;renderScene();save();});
  $('yg-axis').addEventListener('click',()=>{state.pitch=Math.asin(Math.max(-1,Math.min(1,info.a[2])));state.yaw=Math.atan2(info.a[0],info.a[1]);renderScene();save();});
  $('yg-breakdown').addEventListener('toggle',renderBreakdown);
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag[0])*.008;state.pitch=Math.max(-1.55,Math.min(1.55,state.pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];renderScene();});
  const release=()=>{drag=null;canvas.style.cursor='grab';save();};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  new ResizeObserver(()=>{renderScene();renderPlane();renderBreakdown();}).observe(root);
  new MutationObserver(()=>{refreshColors();renderScene();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{refreshColors();renderScene();});
  refreshColors();update();
})();
