/* Decompose the joint-space mass matrix into COM translation and body rotation. */
const YamLabMath = (() => {
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
  function compute(D,model,q,v,a){
    const Z=Array(6).fill(0),G=D.inverse(model,q,Z,Z),C=D.inverse(model,q,v,Z,[0,0,0]);
    const {M,links}=massParts(D,model,G.fk),acc=D.mv(M,a),tau=acc.map((x,j)=>x+C.tau[j]+G.tau[j]);
    return {M,links,acc,c:C.tau,g:G.tau,tau,fk:G.fk,gravityByLink:G.byLink,velocityByLink:C.byLink};
  }
  return {massParts,compute};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=YamLabMath;
