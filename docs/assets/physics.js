/* SPDX-License-Identifier: MIT
 * Teaching models, SI units. Angles are measured CCW from horizontal.
 * Gravity compensation g is opposite to the physical gravitational torque.
 */
(function(root){
  const G=9.81;
  function planar(q1,q2,m1=1,m2=1,l1=.35,l2=.3){
    const x1=l1*Math.cos(q1),z1=l1*Math.sin(q1);
    const x2=x1+l2*Math.cos(q1+q2),z2=z1+l2*Math.sin(q1+q2);
    const contributions=[[m1*G*x1,m2*G*x2],[0,m2*G*(x2-x1)]];
    return {points:[[0,0],[x1,z1],[x2,z2]],potential:G*(m1*z1+m2*z2),
      gravity:contributions.map(row=>row.reduce((a,b)=>a+b,0)),contributions};
  }
  // Static Newton-Euler balance for two massless links with point masses at
  // their tips. F1/F2 are downward load magnitudes; returned torques oppose
  // the physical gravitational moments about the positive joint axes.
  function planarNewtonEuler(q1,q2,m1=1,m2=1,l1=.35,l2=.3){
    const F2=m2*G,F1=m1*G+F2;
    const tau2=F2*l2*Math.cos(q1+q2);
    return {loads:[F1,F2],gravity:[F1*l1*Math.cos(q1)+tau2,tau2]};
  }
  // Two massless planar links: m1 at the elbow, m2 at the distal tip.
  function planarMass(q2,m1=1,m2=1.5,l1=.4,l2=.3){
    const coupling=m2*l1*l2*Math.cos(q2),distal=m2*l2*l2;
    return [[(m1+m2)*l1*l1+distal+2*coupling,distal+coupling],[distal+coupling,distal]];
  }
  function controller(s,p){
    const gravity=p.mass*G*p.length*Math.cos(s.q);
    const ff=p.mode==='off'?0:p.gravityRatio*gravity;
    const spring=p.mode==='hold'?p.kp*(p.target-s.q):0;
    const damping=(p.mode==='hold'||p.mode==='drag')?-p.kd*s.v:0;
    const friction=p.friction*Math.tanh(s.v/.03);
    return {gravity,ff,spring,damping,friction,motor:ff+spring+damping};
  }
  function derivative(s,p){const c=controller(s,p);return {q:s.v,v:(c.motor+p.external-c.gravity-c.friction)/(p.mass*p.length*p.length)};}
  function step(s,p,dt){
    const a=derivative(s,p),add=(k,f)=>({q:s.q+k.q*f,v:s.v+k.v*f});
    const b=derivative(add(a,dt/2),p),c=derivative(add(b,dt/2),p),d=derivative(add(c,dt),p);
    return {q:s.q+dt*(a.q+2*b.q+2*c.q+d.q)/6,v:s.v+dt*(a.v+2*b.v+2*c.v+d.v)/6};
  }
  function energy(s,p){return .5*p.mass*p.length*p.length*s.v*s.v+p.mass*G*p.length*Math.sin(s.q);}
  const api={G,planar,planarNewtonEuler,planarMass,controller,derivative,step,energy};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RobotLessonPhysics=api;
})(globalThis);
