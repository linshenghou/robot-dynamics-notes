/* Gravity geometry; viewing the rotation plane from +axis toward its origin. */
const GravityGeometry = (()=>{
  function summarize(D, model, result, j) {
    const a=result.fk.axes[j], p=result.fk.origins[j];
    const frames=Object.values(result.fk.frames).filter(f=>f.ancestors.includes(j));
    const mass=frames.reduce((s,f)=>s+f.link.mass,0);
    const com=D.scale(frames.reduce((s,f)=>D.add(s,D.scale(f.com,f.link.mass)),[0,0,0]),1/mass);
    const down=[0,0,-1], projectedDown=D.sub(down,D.scale(a,D.dot(a,down)));
    const sinTilt=Math.sqrt(D.dot(projectedDown,projectedDown));
    // Near a vertical joint axis there is no meaningful gravity-defined horizontal direction.
    const degenerate=sinTilt<1e-5;
    let ey=degenerate?D.sub([0,1,0],D.scale(a,a[1])):D.scale(projectedDown,-1/sinTilt);
    ey=D.scale(ey,1/Math.sqrt(D.dot(ey,ey)));
    const ex=D.cross(ey,a), r=D.sub(com,p), x=D.dot(r,ex), y=D.dot(r,ey);
    const force=mass*9.81*sinTilt, torque=result.tau[j];
    const rows=frames.map(f=>({name:f.link.name,mass:f.link.mass,com:f.com,x:D.dot(D.sub(f.com,p),ex),y:D.dot(D.sub(f.com,p),ey),torque:result.byLink[f.link.name][j]}));
    return {j,a,p,frames,mass,com,sinTilt,degenerate,ex,ey,x,y,force,torque,rows};
  }
  // Compare two static poses. The UI holds every coordinate except driver fixed.
  // Rows remain physical links, not joints; their weights load their ancestor joints.
  function compare(D,model,q,referenceQ,driver){
    const zero=Array(6).fill(0),current=D.inverse(model,q,zero,zero),reference=D.inverse(model,referenceQ,zero,zero);
    const moved=Object.values(current.fk.frames).filter(f=>f.ancestors.includes(driver));
    const delta=current.tau.map((v,j)=>v-reference.tau[j]);
    const rows=Object.values(current.fk.frames).filter(f=>f.ancestors.length).map(f=>({
      name:f.link.name,mass:f.link.mass,ancestors:f.ancestors,moved:f.ancestors.includes(driver),
      current:current.byLink[f.link.name],reference:reference.byLink[f.link.name],
      delta:current.byLink[f.link.name].map((v,j)=>v-reference.byLink[f.link.name][j])
    }));
    return {current,reference,delta,rows,movedMass:moved.reduce((s,f)=>s+f.link.mass,0),infos:zero.map((_,j)=>summarize(D,model,current,j))};
  }
  return {summarize,compare};
})();
if(typeof module!=='undefined' && module.exports) module.exports=GravityGeometry;
