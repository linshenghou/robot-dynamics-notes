/* Joint torque and mass-matrix decompositions in the model's joint coordinates. */
const YamLabMath = (() => {
  const zeros=()=>Array(6).fill(0);
  const emptyByLink=byLink=>Object.fromEntries(Object.keys(byLink).map(name=>[name,zeros()]));
  function massParts(D, model, fk) {
    const empty=()=>Array.from({length:6},()=>Array(6).fill(0));
    const M=empty(),links=[];
    for(const f of Object.values(fk.frames)){
      if(!f.ancestors.length)continue;
      const linear=empty(),angular=empty();
      const Jv=fk.axes.map((axis,j)=>f.ancestors.includes(j)?D.cross(axis,D.sub(f.com,fk.origins[j])):[0,0,0]);
      for(const i of f.ancestors)for(const j of f.ancestors){
        linear[i][j]=f.link.mass*D.dot(Jv[i],Jv[j]);
        angular[i][j]=D.dot(fk.axes[i],D.mv(f.Iworld,fk.axes[j]));
        M[i][j]+=linear[i][j]+angular[i][j];
      }
      links.push({name:f.link.name,frame:f,Jv,linear,angular});
    }
    return {M,links};
  }
  // For these fixed generalized coordinates, velocity torque is a quadratic
  // polynomial in qdot. "Centrifugal" means its qdot_j^2 terms; "Coriolis"
  // means its qdot_j*qdot_k (j != k) terms. This does not require choosing a
  // particular, non-unique C matrix and is not a split of world-space forces.
  function velocityParts(D,model,q,v,C){
    const Z=zeros(),centrifugal=zeros(),centrifugalByLink=emptyByLink(C.byLink);
    const squares=v.map((speed,joint)=>{
      let source={tau:zeros(),byLink:emptyByLink(C.byLink)};
      if(speed!==0){const single=zeros();single[joint]=speed;source=D.inverse(model,q,single,Z,[0,0,0]);}
      source.tau.forEach((x,j)=>centrifugal[j]+=x);
      for(const name of Object.keys(source.byLink))source.byLink[name].forEach((x,j)=>centrifugalByLink[name][j]+=x);
      return {joint,product:speed*speed,tau:source.tau,byLink:source.byLink};
    });
    const coriolis=C.tau.map((x,j)=>x-centrifugal[j]);
    const coriolisByLink=Object.fromEntries(Object.entries(C.byLink).map(([name,row])=>[name,row.map((x,j)=>x-centrifugalByLink[name][j])]));
    // Computing all pair sources costs up to 15 additional inverse-dynamics
    // passes, so defer it until a source-detail view requests them. Snapshot
    // q and v because the UI may edit its state arrays before the first call.
    const pose=q.slice(),speeds=v.slice();let pairs;
    const sources={squares,pairs:()=>{
      if(pairs)return pairs;
      pairs=[];
      for(let j=0;j<speeds.length;j++)for(let k=j+1;k<speeds.length;k++){
        const product=speeds[j]*speeds[k];let tau=zeros(),byLink=emptyByLink(C.byLink);
        if(product!==0){
          const pair=zeros();pair[j]=speeds[j];pair[k]=speeds[k];
          const source=D.inverse(model,pose,pair,Z,[0,0,0]);
          tau=source.tau.map((x,i)=>x-squares[j].tau[i]-squares[k].tau[i]);
          byLink=Object.fromEntries(Object.entries(source.byLink).map(([name,row])=>[name,row.map((x,i)=>x-squares[j].byLink[name][i]-squares[k].byLink[name][i])]));
        }
        pairs.push({joints:[j,k],product,tau,byLink});
      }
      return pairs;
    }};
    return {centrifugal,coriolis,centrifugalByLink,coriolisByLink,velocitySources:sources};
  }
  function compute(D,model,q,v,a){
    const Z=zeros(),G=D.inverse(model,q,Z,Z),C=D.inverse(model,q,v,Z,[0,0,0]);
    const {M,links}=massParts(D,model,G.fk),acc=D.mv(M,a),tau=acc.map((x,j)=>x+C.tau[j]+G.tau[j]);
    return {M,links,acc,c:C.tau,g:G.tau,tau,fk:G.fk,gravityByLink:G.byLink,velocityByLink:C.byLink,...velocityParts(D,model,q,v,C)};
  }
  return {massParts,compute};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=YamLabMath;
