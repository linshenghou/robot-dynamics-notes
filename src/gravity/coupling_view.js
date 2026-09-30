/* SPDX-License-Identifier: MIT */
const GravityCouplingView=(()=>{
  const fmt=(v,n=3)=>(Math.abs(v)<.5*10**(-n)?0:v).toFixed(n);
  const signed=(v,n=3)=>(v>=.5*10**(-n)?'+':'')+fmt(v,n);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const relation=(i,k)=>i<k?'上游承载关节':i===k?'正在转动的关节':'下游关节';
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
    const bound=Math.max(.0001,...c.delta.map(Math.abs));
    $('yg-response-grid').innerHTML=c.delta.map((_,i)=>{
      const before=c.reference.tau[i],now=c.current.tau[i],delta=c.delta[i],changed=Math.abs(delta)>=.00005;
      const width=Math.min(50,Math.abs(delta)/bound*50);
      return '<article class="yg-response-row '+(i<k?'upstream':i===k?'driver':'downstream')+'" data-response="'+i+'">'
        +'<div class="yg-response-identity"><b>J'+(i+1)+'</b><small>'+relation(i,k)+'</small></div>'
        +'<div class="yg-value-pair"><span>'+signed(before,4)+'</span><i aria-hidden="true">→</i><strong>'+signed(now,4)+'</strong></div>'
        +'<div class="yg-change '+(changed?'changed':'')+'"><output id="yg-delta-'+i+'">'+signed(delta,4)+'</output><span class="yg-delta-track" aria-hidden="true"><i class="yg-zero"></i><i class="yg-delta-fill '+(delta<0?'negative':'positive')+'" style="width:'+width+'%"></i></span></div>'
        +'<button type="button" data-detail-joint="'+i+'" aria-label="查看 J'+(i+1)+' 的力臂计算">看力臂 ↗</button></article>';
    }).join('');
    const changedUpstream=upstream.filter((_,i)=>Math.abs(c.delta[i])>=.00005);
    let summary=Math.abs(dq)<.00005?'当前与参考姿态相同。试着转动选中的关节，看上游各行的 Δg 如何一起变化。'
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
