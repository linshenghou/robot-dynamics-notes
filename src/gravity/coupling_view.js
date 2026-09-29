/* SPDX-License-Identifier: MIT */
const GravityCouplingView=(()=>{
  const fmt=(v,n=3)=>(Math.abs(v)<.5*10**(-n)?0:v).toFixed(n);
  const signed=(v,n=3)=>(v>=.5*10**(-n)?'+':'')+fmt(v,n);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const relation=(i,k)=>i<k?'上游承载关节':i===k?'正在转动的关节':'下游关节';
  const line=(a,b,color,extra='')=>'<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="'+color+'" '+extra+'/>';
  const text=(x,y,t,anchor='middle')=>'<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'">'+t+'</text>';
  function plane(info){
    const mint='var(--viz-series-1)',amber='var(--viz-series-2)',muted='var(--muted-foreground)';
    let s='<title>J'+(info.j+1)+'：当前下游总质心与带符号力臂</title>';
    if(info.degenerate)return s+'<circle cx="150" cy="57" r="27" fill="none" stroke="var(--border)"/><circle cx="150" cy="57" r="4" fill="'+mint+'"/>'+text(150,111,'重力沿着关节轴')+text(150,135,'平面内重力 ≈ 0，补偿 ≈ 0');
    const scale=Math.min(150/Math.max(.12,Math.abs(info.x)),60/Math.max(.12,Math.abs(info.y)));
    const p=[150-info.x*scale/2,62+info.y*scale/2],c=[150+info.x*scale/2,62-info.y*scale/2],y=123;
    s+=line(p,c,muted,'stroke-dasharray="3 4"')+line([c[0],22],[c[0],y],'var(--border)');
    s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="'+mint+'"/><path d="M'+c[0]+','+(c[1]-5)+' l5,5 -5,5 -5,-5 Z" fill="'+amber+'"/>';
    s+=line([c[0],c[1]+7],[c[0],c[1]+30],amber,'stroke-width="2"')+'<path d="M'+(c[0]-4)+','+(c[1]+26)+' l4,7 4,-7 Z" fill="'+amber+'"/>';
    s+=line([p[0],y-4],[p[0],y+4],muted)+line([c[0],y-4],[c[0],y+4],muted)+line([p[0],y],[c[0],y],muted);
    if(Math.abs(info.torque)>.0005){
      const sign=Math.sign(info.torque),points=Array.from({length:21},(_,k)=>{const t=.2+sign*k/20*4;return [p[0]+19*Math.cos(t),p[1]-19*Math.sin(t)];});
      const end=points[20],before=points[19],angle=Math.atan2(end[1]-before[1],end[0]-before[0]);
      s+='<polyline points="'+points.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="'+mint+'" stroke-width="1.7"/><path d="M'+end.join(',')+' L'+[end[0]-6*Math.cos(angle-.5),end[1]-6*Math.sin(angle-.5)].join(',')+' L'+[end[0]-6*Math.cos(angle+.5),end[1]-6*Math.sin(angle+.5)].join(',')+' Z" fill="'+mint+'"/>';
    }
    return s+text(150,145,'d = '+signed(info.x,4)+' m');
  }
  function bars(before,now,bound){
    const x=v=>150+v/bound*136;
    return '<title>参考 '+fmt(before,6)+'，当前 '+fmt(now,6)+' N·m；六关节共用刻度</title>'
      +line([14,21],[286,21],'var(--border)')+line([150,8],[150,35],'var(--muted-foreground)')
      +'<rect x="'+Math.min(150,x(before))+'" y="11" width="'+Math.abs(x(before)-150)+'" height="7" fill="none" stroke="var(--muted-foreground)"/>'
      +'<rect x="'+Math.min(150,x(now))+'" y="24" width="'+Math.abs(x(now)-150)+'" height="7" fill="var(--viz-series-1)"/>'
      +'<circle cx="'+x(now)+'" cy="27.5" r="2" fill="var(--viz-series-1)"/>';
  }
  function render(root,c,state,active){
    const $=id=>root.querySelector('#'+id),k=state.driver,deg=180/Math.PI,ref=state.referenceQ[k]*deg,angle=state.q[k]*deg,dq=angle-ref;
    $('yg-driver').value=k;
    const slider=$('yg-coupled-angle'),joint=active[k];
    slider.min=Math.ceil(joint.lower*deg*10)/10;slider.max=Math.floor(joint.upper*deg*10)/10;
    slider.value=angle;slider.setAttribute('aria-label','只改变 J'+(k+1)+' 的角度 / 度');
    $('yg-driver-readout').textContent=fmt(ref,1)+'° → '+fmt(angle,1)+'°  (Δ '+signed(dq,1)+'°)';
    $('yg-nudge').disabled=angle>=Number(slider.max)-.001;
    $('yg-revert').disabled=state.q.every((v,i)=>Math.abs(v-state.referenceQ[i])<1e-10);
    root.querySelectorAll('[data-driver]').forEach(b=>{
      const i=Number(b.dataset.driver);b.setAttribute('aria-pressed',String(i===k));b.dataset.relation=i<k?'upstream':i===k?'driver':'downstream';
      b.querySelector('small').textContent=i<k?'上游':i===k?'转动':'下游';
    });
    const names=c.rows.filter(r=>r.moved).map(r=>r.name);
    const upstream=Array.from({length:k},(_,i)=>'J'+(i+1));
    $('yg-scope').textContent='J'+(k+1)+' 带着 '+names.join('、')+' 转动，共 '+fmt(c.movedMass,3)+' kg。'+(k?'这些连杆的重量同时由 '+upstream.join('、')+' 及 J'+(k+1)+' 承担。':'它位于基座处，没有更上游的活动关节。');
    const bound=Math.max(.02,...c.current.tau.map(Math.abs),...c.reference.tau.map(Math.abs))*1.1;
    $('yg-response-grid').innerHTML=c.infos.map((info,i)=>{
      const before=c.reference.tau[i],now=c.current.tau[i],delta=c.delta[i],changed=Math.abs(delta)>=.00005;
      const calc=info.degenerate?'重力近乎平行于轴 · 此轴补偿 ≈ 0':fmt(info.force,3)+' N × ('+signed(info.x,4)+' m)';
      return '<article class="yg-response-card '+(i<k?'upstream':i===k?'driver':'downstream')+'" data-response="'+i+'">'
        +'<div class="yg-card-head"><b>J'+(i+1)+'</b><span>'+relation(i,k)+'</span></div>'
        +'<div class="yg-card-values"><span class="yg-reference-value">'+signed(before,4)+'<small>参考</small></span><span class="yg-transition">→</span><strong>'+signed(now,4)+'<small>当前 / N·m</small></strong></div>'
        +'<div class="yg-delta '+(changed?'changed':'')+'">Δg'+(i+1)+' <output id="yg-delta-'+i+'">'+signed(delta,4)+'</output><span> N·m</span></div>'
        +'<svg class="yg-compare-bars" viewBox="0 0 300 42" role="img" aria-label="J'+(i+1)+' 参考与当前力矩比较">'+bars(before,now,bound)+'</svg>'
        +'<svg class="yg-mini-plane" viewBox="0 0 300 153" role="img" aria-label="J'+(i+1)+' 当前力臂示意">'+plane(info)+'</svg>'
        +'<div class="yg-card-calc">'+calc+'</div><div class="yg-card-bottom"><span>下游总质量 '+fmt(info.mass,3)+' kg</span><button type="button" data-detail-joint="'+i+'">展开 J'+(i+1)+' ↗</button></div></article>';
    }).join('');
    const changedUpstream=upstream.filter((_,i)=>Math.abs(c.delta[i])>=.00005);
    let summary=Math.abs(dq)<.00005?'当前与参考姿态相同。试着转动选中的关节，看上游卡片的 Δg 如何一起变化。'
      :'只改变 J'+(k+1)+' '+signed(dq,1)+'°：'+(changedUpstream.length?changedUpstream.join('、')+' 的补偿已变化，即使这些关节自己的角度没有变化。':k?'本次姿态变化下，上游补偿变化小于显示精度。':'没有上游活动关节；下方保留整条链的结果。');
    if(k>0)summary+=' J1 的轴近乎竖直，重力绕这根轴的力矩仍近似为零。';
    $('yg-response-summary').textContent=summary;
    const max=Math.max(.0001,...c.rows.flatMap(r=>r.current.map(Math.abs)));
    $('yg-matrix-body').innerHTML=c.rows.map(r=>'<tr class="'+(r.moved?'yg-moving-link':'')+'"><th>'+esc(r.name)+'<small>'+fmt(r.mass,3)+' kg'+(r.moved?' · 随动':'')+'</small></th>'+r.current.map((v,i)=>{
      if(!r.ancestors.includes(i))return '<td class="yg-no-load" aria-label="J'+(i+1)+' 不承载此连杆">—</td>';
      return '<td style="--load:'+Math.round(5+30*Math.sqrt(Math.abs(v)/max))+'%"><span>'+signed(v)+'</span><small>Δ '+signed(r.delta[i],4)+'</small></td>';
    }).join('')+'</tr>').join('');
    $('yg-matrix-total').innerHTML='<tr><th>合计 g<small>Δg</small></th>'+c.current.tau.map((v,i)=>'<td>'+signed(v)+'<small>Δ '+signed(c.delta[i],4)+'</small></td>').join('')+'</tr>';
  }
  return {render};
})();
