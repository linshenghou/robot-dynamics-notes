/* Rigid-body inverse dynamics in world coordinates. SI units throughout. */
const YamDynamics = (() => {
  const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), scale=(a,s)=>a.map(x=>x*s);
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const eye=()=>[[1,0,0],[0,1,0],[0,0,1]], zeros=n=>Array(n).fill(0);
  const transpose=A=>A[0].map((_,i)=>A.map(r=>r[i]));
  const mv=(A,v)=>A.map(r=>dot(r,v));
  const mm=(A,B)=>A.map(r=>transpose(B).map(c=>dot(r,c)));
  const axisRot=(axis,t)=>{
    const [x,y,z]=axis, c=Math.cos(t),s=Math.sin(t),d=1-c;
    return [[c+x*x*d,x*y*d-z*s,x*z*d+y*s],[y*x*d+z*s,c+y*y*d,y*z*d-x*s],[z*x*d-y*s,z*y*d+x*s,c+z*z*d]];
  };
  const rpy=([r,p,y])=>mm(mm(axisRot([0,0,1],y),axisRot([0,1,0],p)),axisRot([1,0,0],r));
  function forward(model,q,qd=zeros(6),qdd=zeros(6)) {
    const frames={}; const root=model.links[model.root];
    frames[model.root]={p:[0,0,0],R:eye(),w:[0,0,0],alpha:[0,0,0],a:[0,0,0],ancestors:[],link:root};
    const axes=[], origins=[], jointFrames=[];
    let active=0;
    for (const joint of model.joints) {
      const parent=frames[joint.parent], arm=mv(parent.R,joint.origin.xyz), p=add(parent.p,arm);
      const R0=mm(parent.R,rpy(joint.origin.rpy)), axis=mv(R0,joint.axis);
      let R=R0, w=parent.w.slice(),alpha=parent.alpha.slice();
      let a=add(parent.a,add(cross(parent.alpha,arm),cross(parent.w,cross(parent.w,arm))));
      const ancestors=parent.ancestors.slice();
      if(joint.active) {
        R=mm(R0,axisRot(joint.axis,q[active]));
        w=add(parent.w,scale(axis,qd[active]));
        alpha=add(parent.alpha,add(scale(axis,qdd[active]),scale(cross(parent.w,axis),qd[active])));
        ancestors.push(active);axes.push(axis);origins.push(p);jointFrames.push({p,axis,R,name:joint.name});active++;
      }
      if(!joint.active && joint.lockedPosition!==0) throw Error('This demo locks both fingers at zero.');
      frames[joint.child]={p,R,w,alpha,a,ancestors,link:model.links[joint.child]};
    }
    for(const frame of Object.values(frames)) {
      const rc=mv(frame.R,frame.link.inertial.xyz);
      frame.com=add(frame.p,rc);
      frame.ac=add(frame.a,add(cross(frame.alpha,rc),cross(frame.w,cross(frame.w,rc))));
      const Ri=mm(frame.R,rpy(frame.link.inertial.rpy));
      frame.Iworld=mm(mm(Ri,frame.link.inertia),transpose(Ri));
    }
    const tcpFrame=frames[model.tcpLink];
    const tcp=add(tcpFrame.p,mv(tcpFrame.R,model.tcpOffset));
    const Jv=axes.map((axis,j)=>cross(axis,sub(tcp,origins[j])));
    return {frames,axes,origins,jointFrames,tcp,Jv};
  }
  function inverse(model,q,qd,qdd,gravity=[0,0,-9.81]) {
    const fk=forward(model,q,qd,qdd), tau=zeros(6), byLink={};
    for(const [name,f] of Object.entries(fk.frames)) {
      const F=scale(sub(f.ac,gravity),f.link.mass);
      const N=add(mv(f.Iworld,f.alpha),cross(f.w,mv(f.Iworld,f.w)));
      const row=zeros(6);
      for(const j of f.ancestors) row[j]=dot(fk.axes[j],add(cross(sub(f.com,fk.origins[j]),F),N));
      row.forEach((x,j)=>tau[j]+=x);byLink[name]=row;
    }
    return {tau,byLink,fk};
  }
  function mass(model,q) {
    const Z=zeros(6), M=Array.from({length:6},()=>zeros(6));
    for(let j=0;j<6;j++){const a=zeros(6);a[j]=1;const col=inverse(model,q,Z,a,[0,0,0]).tau;for(let i=0;i<6;i++)M[i][j]=col[i];}
    return M;
  }
  function external(fk,force=[0,0,0],moment=[0,0,0]) {
    return fk.axes.map((axis,j)=>dot(fk.Jv[j],force)+dot(axis,moment));
  }
  function compute(model,q,qd,qdd,force=[0,0,0],moment=[0,0,0],gravity=[0,0,-9.81]) {
    const Z=zeros(6),G=inverse(model,q,Z,Z,gravity),C=inverse(model,q,qd,Z,[0,0,0]);
    const A=inverse(model,q,Z,qdd,[0,0,0]),M=mass(model,q),ext=external(G.fk,force,moment);
    const tau=A.tau.map((v,i)=>v+C.tau[i]+G.tau[i]-ext[i]);
    return {M,acc:A.tau,vel:C.tau,g:G.tau,ext,tau,fk:G.fk,gravityByLink:G.byLink};
  }
  function massFromJacobians(model,q) {
    const fk=forward(model,q),M=Array.from({length:6},()=>zeros(6));
    for(const f of Object.values(fk.frames)) for(const i of f.ancestors) for(const j of f.ancestors) {
      const vi=cross(fk.axes[i],sub(f.com,fk.origins[i])),vj=cross(fk.axes[j],sub(f.com,fk.origins[j]));
      M[i][j]+=f.link.mass*dot(vi,vj)+dot(fk.axes[i],mv(f.Iworld,fk.axes[j]));
    }
    return M;
  }
  const potential=(model,q)=>Object.values(forward(model,q).frames).reduce((v,f)=>v+f.link.mass*9.81*f.com[2],0);
  function coriolisMatrix(model,q,v) {
    const eps=1e-5, derivatives=[];
    for(let k=0;k<6;k++){
      const p=q.slice(),m=q.slice();p[k]+=eps;m[k]-=eps;
      const P=massFromJacobians(model,p),N=massFromJacobians(model,m);
      derivatives.push(P.map((row,i)=>row.map((x,j)=>(x-N[i][j])/(2*eps))));
    }
    return Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>v.reduce((sum,vk,k)=>sum+.5*(derivatives[k][i][j]+derivatives[j][i][k]-derivatives[i][j][k])*vk,0)));
  }
  return {add,sub,scale,dot,cross,eye,transpose,mv,mm,axisRot,rpy,forward,inverse,mass,external,compute,massFromJacobians,potential,coriolisMatrix};
})();
if(typeof module!=='undefined' && module.exports)module.exports=YamDynamics;
