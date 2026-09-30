/* SPDX-License-Identifier: MIT */
const assert=require('node:assert/strict');
const P=require('../docs/assets/physics.js'),D=require('../src/gravity/dynamics.js'),G=require('../src/gravity/gravity_geometry.js'),model=require('../src/model/model.json');
let maxPlanar=0,maxPlanarNe=0,maxYam=0,seed=41;
function random(){seed=(1664525*seed+1013904223)>>>0;return seed/2**32;}
for(let i=0;i<40;i++){
 const q1=(random()-.5)*5,q2=(random()-.5)*5,m2=.2+3*random(),a=P.planar(q1,q2,1,m2),ne=P.planarNewtonEuler(q1,q2,1,m2),e=1e-5;
 const grad=[(P.planar(q1+e,q2,1,m2).potential-P.planar(q1-e,q2,1,m2).potential)/(2*e),(P.planar(q1,q2+e,1,m2).potential-P.planar(q1,q2-e,1,m2).potential)/(2*e)];
 a.gravity.forEach((v,j)=>{maxPlanar=Math.max(maxPlanar,Math.abs(v-grad[j]));maxPlanarNe=Math.max(maxPlanarNe,Math.abs(v-ne.gravity[j]));});
 const q=model.joints.filter(j=>j.active).map(j=>j.lower+random()*(j.upper-j.lower)),z=Array(6).fill(0),out=D.inverse(model,q,z,z);
 for(let j=0;j<6;j++){
  const plus=q.slice(),minus=q.slice();plus[j]+=e;minus[j]-=e;
  maxYam=Math.max(maxYam,Math.abs((D.potential(model,plus)-D.potential(model,minus))/(2*e)-out.tau[j]));
  const info=G.summarize(D,model,out,j);
  assert(Math.abs(info.rows.reduce((s,r)=>s+r.torque,0)-out.tau[j])<1e-10);
  assert(Math.abs(D.dot(info.a,D.cross(D.sub(info.com,info.p),[0,0,-info.mass*9.81]))+out.tau[j])<1e-10);
 }
}
assert(maxPlanar<1e-7);assert(maxPlanarNe<1e-12);assert(maxYam<1e-7);
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
console.log(JSON.stringify({passed:true,randomPoses:40,maxPlanarGradientError:maxPlanar,maxPlanarNewtonEulerError:maxPlanarNe,maxYamGradientError:maxYam,maxCouplingGradientError:maxCouplingGradient,freePendulumEnergyError:energyError,pdEquilibriumError:Math.abs(held.q-.4),checks:['single-joint change and upstream link contributions','potential gradients and static Newton-Euler agreement','YAM link sum and COM equivalence','energy conservation','gravity-compensated coasting','analytic damping decay','PD equilibrium','gravity estimation drift']},null,2));
