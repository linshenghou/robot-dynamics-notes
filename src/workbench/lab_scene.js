const YamLabScene = (()=>{
  function create(canvas,D,model){
    const ctx=canvas.getContext('2d'),active=model.joints.filter(j=>j.active),meshes=Object.values(model.links).map(link=>({name:link.name,vertices:link.mesh.vertices.map(v=>D.add(link.visual.xyz,D.mv(D.rpy(link.visual.rpy),v))),triangles:link.mesh.triangles}));
    let colors={},hits=[];
    function theme(){
      const probe=document.createElement('span'),pixel=document.createElement('canvas');pixel.width=pixel.height=1;const pc=pixel.getContext('2d');document.body.append(probe);
      for(const name of ['ink','muted','surface','line','inertia','gravity']){probe.style.color=`var(--${name})`;const css=getComputedStyle(probe).color;pc.fillStyle=css;pc.fillRect(0,0,1,1);colors[name]={css,rgb:[...pc.getImageData(0,0,1,1).data].slice(0,3)};}probe.remove();
    }
    const rgb=a=>`rgb(${a.map(x=>Math.max(0,Math.min(255,Math.round(x)))).join(',')})`;
    function draw(result,state){
      if(!result)return;hits=[];
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
      const view=p=>[cy*p[0]-sy*p[1],-sp*(sy*p[0]+cy*p[1])+cp*p[2],cp*(sy*p[0]+cy*p[1])+sp*p[2]];
      const worldMeshes=meshes.map(m=>{const f=result.fk.frames[m.name],world=m.vertices.map(v=>D.add(f.p,D.mv(f.R,v)));return {...m,world,points:world.map(view)};});
      const bounds=worldMeshes.flatMap(m=>m.points),minX=Math.min(...bounds.map(p=>p[0])),maxX=Math.max(...bounds.map(p=>p[0])),minY=Math.min(...bounds.map(p=>p[1])),maxY=Math.max(...bounds.map(p=>p[1]));
      const scale=Math.min((w-(w<360?90:170))/Math.max(.34,maxX-minX),(h-82)/Math.max(.42,maxY-minY)),mx=(maxX+minX)/2,my=(maxY+minY)/2;
      const screen=p=>[(p[0]-mx)*scale+w/2,h/2-(p[1]-my)*scale],proj=p=>screen(view(p));
      const line=(a,b,c,width=1,dash=[])=>{ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);};
      const head=(a,b,c)=>{const t=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.beginPath();ctx.moveTo(...b);ctx.lineTo(b[0]-6*Math.cos(t-.45),b[1]-6*Math.sin(t-.45));ctx.lineTo(b[0]-6*Math.cos(t+.45),b[1]-6*Math.sin(t+.45));ctx.closePath();ctx.fillStyle=c;ctx.fill();};
      for(let k=-3;k<=4;k++){line(proj([k*.1,-.3,0]),proj([k*.1,.4,0]),colors.line.css);line(proj([-.3,k*.1,0]),proj([.4,k*.1,0]),colors.line.css);}
      const faces=[];
      for(const mesh of worldMeshes){
        const focus=mesh.name===(state.panel==='gravity'?state.link:active[state.j].child),frame=result.fk.frames[mesh.name],downstream=frame.ancestors.includes(state.j);
        const color=colors[focus?'inertia':downstream?'inertia':'ink'].rgb,tint=focus?.72:downstream?.50:.43,base=color.map((v,i)=>v*tint+colors.surface.rgb[i]*(1-tint));
        for(const tri of mesh.triangles){const p=tri.map(i=>mesh.points[i]),ww=tri.map(i=>mesh.world[i]),normal=D.cross(D.sub(ww[1],ww[0]),D.sub(ww[2],ww[0])),n=Math.sqrt(D.dot(normal,normal));if(n<1e-10)continue;const light=.64+.36*Math.abs(D.dot(D.scale(normal,1/n),[.3,-.4,.866]));faces.push({p,depth:p.reduce((s,p)=>s+p[2],0)/3,c:rgb(base.map(v=>v*light))});}
      }
      faces.sort((a,b)=>a.depth-b.depth);for(const f of faces){const p=f.p.map(screen);ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.fillStyle=f.c;ctx.fill();}
      if(state.com)for(const frame of Object.values(result.fk.frames)){
        if(!frame.ancestors.length)continue;const c=proj(frame.com),end=proj(D.add(frame.com,[0,0,-.04-.035*Math.sqrt(frame.link.mass)]));ctx.fillStyle=colors.gravity.css;ctx.beginPath();ctx.arc(...c,frame.link.name===state.link?4:2.5,0,2*Math.PI);ctx.fill();line(c,end,colors.gravity.css,1.1);if(Math.hypot(end[0]-c[0],end[1]-c[1])>3)head(c,end,colors.gravity.css);
      }
      const max=Math.max(.01,...result.tau.map(Math.abs));
      result.fk.jointFrames.forEach((f,j)=>{
        const p=proj(f.p),axis=f.axis,seed=Math.abs(axis[2])<.9?[0,0,1]:[0,1,0];let u=D.cross(seed,axis);u=D.scale(u,1/Math.sqrt(D.dot(u,u)));const v=D.cross(axis,u);
        const color=colors[j===state.j?'inertia':'ink'].css;
        ctx.beginPath();ctx.arc(...p,j===state.j?4.5:3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
        if(Math.abs(result.tau[j])>.0005){const pts=[],dir=Math.sign(result.tau[j]);for(let k=0;k<=24;k++){const t=.4+dir*k/24*4.7;pts.push(proj(D.add(f.p,D.add(D.scale(u,.048*Math.cos(t)),D.scale(v,.048*Math.sin(t))))));}ctx.beginPath();ctx.moveTo(...pts[0]);pts.slice(1).forEach(p=>ctx.lineTo(...p));ctx.lineWidth=1+1.6*Math.sqrt(Math.abs(result.tau[j])/max);ctx.strokeStyle=color;ctx.stroke();head(pts.at(-2),pts.at(-1),color);}
      });
      // Fixed left/right lanes avoid a cluster of six overlapping CAD callouts.
      const nodes=result.fk.jointFrames.map((f,j)=>({j,p:proj(f.p)}));
      ctx.font=`11px ${getComputedStyle(document.documentElement).getPropertyValue('--mono')}`;ctx.textBaseline='middle';
      for(const side of [0,1]){
        const list=nodes.filter(n=>side?n.j>=3:n.j<3).sort((a,b)=>a.p[1]-b.p[1]);let last=30;
        for(const n of list){n.y=Math.max(last,Math.min(h-60,n.p[1]));last=n.y+42;}
        for(let k=list.length-1;k>=0;k--)list[k].y=Math.min(list[k].y,h-48-(list.length-1-k)*42);
        for(const n of list){const tau=result.tau[n.j],s=Math.abs(tau)<.0005?'≈0':(tau>=0?'+':'')+tau.toFixed(3),text=`J${n.j+1}  ${s}`,len=ctx.measureText(text).width,x=side?w-len-4:4;
          const anchor=[side?x-5:x+len+5,n.y];line(n.p,anchor,colors.muted.css,.75,[2,3]);
          ctx.fillStyle=colors.surface.css;ctx.globalAlpha=.95;ctx.fillRect(x-2,n.y-11,len+4,22);ctx.globalAlpha=1;ctx.fillStyle=colors[n.j===state.j?'inertia':'ink'].css;ctx.fillText(text,x,n.y);
          if(n.j===state.j)line([x,n.y+11],[x+len,n.y+11],colors.inertia.css,1.5);
          hits.push({j:n.j,x:x-5,y:n.y-16,w:len+10,h:32});
        }
      }
      ctx.fillStyle=colors.muted.css;ctx.fillText('拖动旋转 · 点击 J 标签观察',5,13);
      const length=.1*scale;line([w-length-10,h-14],[w-10,h-14],colors.muted.css);ctx.fillText('0.10 m',w-length-10,h-27);
      canvas.setAttribute('aria-label','当前六关节驱动力矩 / N·m：'+result.tau.map((t,j)=>`J${j+1} ${t.toFixed(4)}`).join('，')+'。拖动旋转视角。');
    }
    function pick(x,y){return hits.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)?.j;}
    theme();return {draw,theme,pick};
  }
  return {create};
})();
