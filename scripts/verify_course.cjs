/* SPDX-License-Identifier: MIT */
const assert=require('node:assert/strict');
const P=require('../docs/assets/physics.js'),D=require('../src/gravity/dynamics.js'),G=require('../src/gravity/gravity_geometry.js'),Lab=require('../src/workbench/lab_math.js'),model=require('../src/model/model.json');
let maxPlanar=0,maxPlanarNe=0,maxYam=0,maxMassInverse=0,maxMassSymmetry=0,maxMassEnergy=0,maxInertiaGravity=0,maxPlanarMassEnergy=0,minMassPivot=Infinity,seed=41;
function random(){seed=(1664525*seed+1013904223)>>>0;return seed/2**32;}
for(let i=0;i<40;i++){
 const q1=(random()-.5)*5,q2=(random()-.5)*5,m2=.2+3*random(),a=P.planar(q1,q2,1,m2),ne=P.planarNewtonEuler(q1,q2,1,m2),e=1e-5;
 const grad=[(P.planar(q1+e,q2,1,m2).potential-P.planar(q1-e,q2,1,m2).potential)/(2*e),(P.planar(q1,q2+e,1,m2).potential-P.planar(q1,q2-e,1,m2).potential)/(2*e)];
 a.gravity.forEach((v,j)=>{maxPlanar=Math.max(maxPlanar,Math.abs(v-grad[j]));maxPlanarNe=Math.max(maxPlanarNe,Math.abs(v-ne.gravity[j]));});
 const q=model.joints.filter(j=>j.active).map(j=>j.lower+random()*(j.upper-j.lower)),z=Array(6).fill(0),out=D.inverse(model,q,z,z);
 const M=D.massFromJacobians(model,q),columns=D.mass(model,q),jointAcceleration=q.map(()=>random()*4-2),v=q.map(()=>random()*2-1),inertia=D.mv(M,jointAcceleration);
 M.forEach((row,i)=>row.forEach((x,j)=>{maxMassInverse=Math.max(maxMassInverse,Math.abs(x-columns[i][j]));maxMassSymmetry=Math.max(maxMassSymmetry,Math.abs(x-M[j][i]));}));
 const L=Array.from({length:6},()=>Array(6).fill(0));
 for(let r=0;r<6;r++)for(let c=0;c<=r;c++){let x=M[r][c];for(let k=0;k<c;k++)x-=L[r][k]*L[c][k];if(r===c){assert(x>0,'Positive kinetic-energy matrix');minMassPivot=Math.min(minMassPivot,x);L[r][c]=Math.sqrt(x);}else L[r][c]=x/L[c][c];}
 const full=D.inverse(model,q,z,jointAcceleration).tau;
 full.forEach((x,j)=>maxInertiaGravity=Math.max(maxInertiaGravity,Math.abs(x-(inertia[j]+out.tau[j]))));
 // Independent energy check: differentiate COM positions along v, and use
 // recursively propagated body angular velocities rather than M's Jacobians.
 const dt=1e-6,plusFk=D.forward(model,q.map((x,j)=>x+dt*v[j])),minusFk=D.forward(model,q.map((x,j)=>x-dt*v[j])),velocityFk=D.forward(model,q,v,z);
 let bodyEnergy=0;
 for(const f of Object.values(velocityFk.frames)){const linearVelocity=D.scale(D.sub(plusFk.frames[f.link.name].com,minusFk.frames[f.link.name].com),1/(2*dt));bodyEnergy+=.5*(f.link.mass*D.dot(linearVelocity,linearVelocity)+D.dot(f.w,D.mv(f.Iworld,f.w)));}
 maxMassEnergy=Math.max(maxMassEnergy,Math.abs(bodyEnergy-.5*D.dot(v,D.mv(M,v))));
 const l1=.2+random(),l2=.2+random(),pm1=.2+random(),pm2=.2+random(),dq1=random()*3-1.5,dq2=random()*3-1.5,PM=P.planarMass(q2,pm1,pm2,l1,l2);
 const vx1=-l1*Math.sin(q1)*dq1,vy1=l1*Math.cos(q1)*dq1,vx2=vx1-l2*Math.sin(q1+q2)*(dq1+dq2),vy2=vy1+l2*Math.cos(q1+q2)*(dq1+dq2);
 const pointEnergy=.5*(pm1*(vx1*vx1+vy1*vy1)+pm2*(vx2*vx2+vy2*vy2));
 maxPlanarMassEnergy=Math.max(maxPlanarMassEnergy,Math.abs(pointEnergy-.5*(dq1*(PM[0][0]*dq1+PM[0][1]*dq2)+dq2*(PM[1][0]*dq1+PM[1][1]*dq2))));
 for(let j=0;j<6;j++){
  const plus=q.slice(),minus=q.slice();plus[j]+=e;minus[j]-=e;
  maxYam=Math.max(maxYam,Math.abs((D.potential(model,plus)-D.potential(model,minus))/(2*e)-out.tau[j]));
  const info=G.summarize(D,model,out,j);
  assert(Math.abs(info.rows.reduce((s,r)=>s+r.torque,0)-out.tau[j])<1e-10);
  assert(Math.abs(D.dot(info.a,D.cross(D.sub(info.com,info.p),[0,0,-info.mass*9.81]))+out.tau[j])<1e-10);
 }
}
assert(maxPlanar<1e-7);assert(maxPlanarNe<1e-12);assert(maxYam<1e-7);
assert(maxMassInverse<1e-10);assert(maxMassSymmetry<1e-10);assert(maxMassEnergy<1e-7);assert(maxInertiaGravity<1e-10);assert(maxPlanarMassEnergy<1e-10);
assert(Math.abs(P.planarMass(0)[0][0]-.895)<1e-12);assert(Math.abs(P.planarMass(Math.PI/2)[0][0]-.535)<1e-12);
// A single downstream coordinate change must be traceable to the moving links.
// Independently check the torque differences against two potential-energy gradients.
let maxCouplingGradient=0;
for(let sample=0;sample<12;sample++){
 const joints=model.joints.filter(j=>j.active),q0=joints.map(j=>j.lower+(.2+.6*random())*(j.upper-j.lower));
 const driver=sample%6,q=q0.slice();q[driver]+=.12;
 const c=G.compare(D,model,q,q0,driver),eps=1e-5;
 for(let j=0;j<6;j++){
  const gradient=pose=>{const p=pose.slice(),n=pose.slice();p[j]+=eps;n[j]-=eps;return (D.potential(model,p)-D.potential(model,n))/(2*eps);};
  maxCouplingGradient=Math.max(maxCouplingGradient,Math.abs(c.delta[j]-(gradient(q)-gradient(q0))));
  assert(Math.abs(c.rows.reduce((s,r)=>s+r.delta[j],0)-c.delta[j])<1e-10);
  if(j<=driver)assert(Math.abs(c.rows.filter(r=>r.moved).reduce((s,r)=>s+r.delta[j],0)-c.delta[j])<1e-10);
 }
 for(const row of c.rows){
  if(!row.moved)assert(row.delta.every(v=>Math.abs(v)<1e-10));
  for(let j=0;j<6;j++)if(!row.ancestors.includes(j))assert.equal(row.current[j],0);
 }
 // The URDF rounds the nominally vertical base-axis rotation (1.5708 rad).
 assert(Math.abs(c.current.tau[0])<1e-4);
}
assert(maxCouplingGradient<1e-7);
// Independently recover velocity monomials from derivatives of the Jacobian
// mass matrix: Gamma_ijk = (M_ij,k + M_ik,j - M_jk,i) / 2.
let maxVelocityChristoffel=0,maxVelocitySourceChristoffel=0,maxTorqueDecomposition=0,maxVelocityLinkSum=0;
function closeVector(actual,expected,tolerance=1e-10){actual.forEach((x,j)=>assert(Math.abs(x-expected[j])<tolerance,`${x} != ${expected[j]} at joint ${j+1}`));}
const sumRows=rows=>rows.reduce((sum,row)=>sum.map((x,j)=>x+row[j]),Array(6).fill(0));
for(let sample=0;sample<12;sample++){
 const q=model.joints.filter(j=>j.active).map(j=>j.lower+(.1+.8*random())*(j.upper-j.lower)),v=q.map(()=>random()*4-2),a=q.map(()=>random()*4-2),z=Array(6).fill(0);
 const result=Lab.compute(D,model,q,v,a),full=D.inverse(model,q,v,a).tau,eps=1e-5;
 const derivatives=q.map((_,k)=>{const p=q.slice(),n=q.slice();p[k]+=eps;n[k]-=eps;const P=D.massFromJacobians(model,p),N=D.massFromJacobians(model,n);return P.map((row,i)=>row.map((x,j)=>(x-N[i][j])/(2*eps)));});
 const gamma=(i,j,k)=>(derivatives[k][i][j]+derivatives[j][i][k]-derivatives[i][j][k])/2;
 const squareExpected=q.map((_,i)=>v.reduce((sum,speed,j)=>sum+gamma(i,j,j)*speed*speed,0));
 const crossExpected=q.map((_,i)=>{let sum=0;for(let j=0;j<6;j++)for(let k=j+1;k<6;k++)sum+=2*gamma(i,j,k)*v[j]*v[k];return sum;});
 for(let i=0;i<6;i++){
  maxVelocityChristoffel=Math.max(maxVelocityChristoffel,Math.abs(result.centrifugal[i]-squareExpected[i]),Math.abs(result.coriolis[i]-crossExpected[i]));
  maxTorqueDecomposition=Math.max(maxTorqueDecomposition,Math.abs(full[i]-(result.acc[i]+result.g[i]+result.centrifugal[i]+result.coriolis[i])));
 }
 closeVector(result.tau,full);closeVector(result.c,result.centrifugal.map((x,j)=>x+result.coriolis[j]));
 const squares=result.velocitySources.squares,pairs=result.velocitySources.pairs();
 assert.equal(squares.length,6);assert.equal(pairs.length,15);assert.strictEqual(result.velocitySources.pairs(),pairs);
 closeVector(sumRows(squares.map(s=>s.tau)),result.centrifugal);closeVector(sumRows(pairs.map(s=>s.tau)),result.coriolis);
 for(const source of squares){const j=source.joint;assert.equal(source.product,v[j]**2);source.tau.forEach((x,i)=>maxVelocitySourceChristoffel=Math.max(maxVelocitySourceChristoffel,Math.abs(x-gamma(i,j,j)*v[j]**2)));}
 for(const source of pairs){const [j,k]=source.joints;assert.equal(source.product,v[j]*v[k]);source.tau.forEach((x,i)=>maxVelocitySourceChristoffel=Math.max(maxVelocitySourceChristoffel,Math.abs(x-2*gamma(i,j,k)*v[j]*v[k])));}
 for(const component of ['centrifugal','coriolis']){
  const sum=sumRows(Object.values(result[component+'ByLink']));
  sum.forEach((x,i)=>maxVelocityLinkSum=Math.max(maxVelocityLinkSum,Math.abs(x-result[component][i])));
 }
 for(const name of Object.keys(result.velocityByLink)){
  closeVector(result.velocityByLink[name],result.centrifugalByLink[name].map((x,j)=>x+result.coriolisByLink[name][j]));
  closeVector(sumRows(squares.map(s=>s.byLink[name])),result.centrifugalByLink[name]);
  closeVector(sumRows(pairs.map(s=>s.byLink[name])),result.coriolisByLink[name]);
 }
 const reversed=Lab.compute(D,model,q,v.map(x=>-x),a),scaled=Lab.compute(D,model,q,v.map(x=>2*x),a);
 closeVector(reversed.centrifugal,result.centrifugal);closeVector(reversed.coriolis,result.coriolis);
 closeVector(scaled.centrifugal,result.centrifugal.map(x=>4*x));closeVector(scaled.coriolis,result.coriolis.map(x=>4*x));
 const flip=sample%6,flipped=Lab.compute(D,model,q,v.map((x,j)=>j===flip?-x:x),a);
 closeVector(flipped.centrifugal,result.centrifugal);
 flipped.velocitySources.pairs().forEach((source,i)=>closeVector(source.tau,pairs[i].tau.map(x=>source.joints.includes(flip)?-x:x)));
 const rest=Lab.compute(D,model,q,z,a);closeVector(rest.centrifugal,z);closeVector(rest.coriolis,z);
 for(let j=0;j<6;j++){const single=z.slice();single[j]=v[j];const only=Lab.compute(D,model,q,single,a);closeVector(only.coriolis,z);closeVector(only.centrifugal,only.c);}
}
assert(maxVelocityChristoffel<1e-7);assert(maxVelocitySourceChristoffel<1e-7);assert(maxTorqueDecomposition<1e-10);assert(maxVelocityLinkSum<1e-10);
// Sparse velocities skip unnecessary passes; pair details are computed once
// on demand, and remain tied to the state that produced the result.
{
 let inverseCalls=0;const tracked={...D,inverse:(...args)=>{inverseCalls++;return D.inverse(...args);}},z=Array(6).fill(0),q=z.slice(),v=[.7,0,-.4,0,0,0];
 const sparse=Lab.compute(tracked,model,q,v,z);assert.equal(inverseCalls,4);
 const expected=Lab.compute(D,model,q,v,z).velocitySources.pairs();q[0]=.9;v[0]=2;
 const pairs=sparse.velocitySources.pairs();assert.equal(inverseCalls,5);
 pairs.forEach((source,i)=>closeVector(source.tau,expected[i].tau));sparse.velocitySources.pairs();assert.equal(inverseCalls,5);
 inverseCalls=0;const rest=Lab.compute(tracked,model,z,z,z);rest.velocitySources.pairs();assert.equal(inverseCalls,2);
}
const base={mode:'off',mass:2,length:.35,kp:10,kd:.7,target:.3,external:0,gravityRatio:1,friction:0};
function evolve(initial,params,seconds){let s={...initial};const n=Math.round(seconds*240);for(let i=0;i<n;i++)s=P.step(s,params,1/240);return s;}
const initial={q:.3,v:0},free=evolve(initial,base,5);
const energyError=Math.abs(P.energy(free,base)-P.energy(initial,base));assert(energyError<2e-5);
const coast=evolve({q:.3,v:.8},{...base,mode:'gravity'},2);
assert(Math.abs(coast.q-1.9)<1e-10);assert(Math.abs(coast.v-.8)<1e-12);
const t=2,I=base.mass*base.length**2,decay=Math.exp(-base.kd*t/I),damped=evolve({q:.3,v:.8},{...base,mode:'drag'},t);
assert(Math.abs(damped.v-.8*decay)<1e-8);assert(Math.abs(damped.q-(.3+.8*I/base.kd*(1-decay)))<1e-8);
const held=evolve(initial,{...base,mode:'hold',external:1},12);
assert(Math.abs(held.q-(base.target+1/base.kp))<1e-7);
const drifting=evolve(initial,{...base,mode:'drag',gravityRatio:.9},.4);assert(drifting.q<initial.q);
console.log(JSON.stringify({passed:true,randomPoses:40,velocityDecompositionPoses:12,maxPlanarGradientError:maxPlanar,maxPlanarNewtonEulerError:maxPlanarNe,maxYamGradientError:maxYam,maxMassInverseError:maxMassInverse,maxMassSymmetryError:maxMassSymmetry,maxMassEnergyError:maxMassEnergy,minPositiveMassPivot:minMassPivot,maxInertiaGravityError:maxInertiaGravity,maxPlanarMassEnergyError:maxPlanarMassEnergy,maxCouplingGradientError:maxCouplingGradient,maxVelocityChristoffelError:maxVelocityChristoffel,maxVelocitySourceChristoffelError:maxVelocitySourceChristoffel,maxTorqueDecompositionError:maxTorqueDecomposition,maxVelocityLinkSumError:maxVelocityLinkSum,freePendulumEnergyError:energyError,pdEquilibriumError:Math.abs(held.q-.4),checks:['YAM mass matrix vs inverse dynamics unit columns','mass symmetry and positive definiteness','mass matrix vs independently differentiated body kinetic energy','inertia and gravity torque superposition','2R mass matrix vs point kinetic energy','single-joint change and upstream link contributions','potential gradients and static Newton-Euler agreement','YAM link sum and COM equivalence','centrifugal and Coriolis sources vs mass-matrix Christoffel derivatives','four torque components vs direct inverse dynamics','velocity component and source sums by link','zero and single-joint velocity limits','velocity reversal, individual source sign, and quadratic scaling','sparse and cached velocity source evaluation','energy conservation','gravity-compensated coasting','analytic damping decay','PD equilibrium','gravity estimation drift']},null,2));
