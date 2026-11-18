export const members = [
  {id:'low',name:'Low',x:-1.65,base:-1.05,height:1.35,width:.72,depth:.55,color:'#D8D1BF',period:9.7,phase:.3,strength:.7,profile:[.35,.8,1,.98,.73,.52]},
  {id:'knuckle',name:'Knuckle',x:.05,base:-1.05,height:2.1,width:.51,depth:.48,color:'#244BCD',period:7.8,phase:2.2,strength:1,profile:[.55,.9,1,.78,.53,.65]},
  {id:'pip',name:'Pip',x:1.6,base:-1.05,height:1.22,width:.43,depth:.37,color:'#B6A74F',period:6.6,phase:4.5,strength:1.2,profile:[.42,.68,1,.88,.62,.78]},
] as const;
export const targets=members.map(({id,name})=>({id,name}));
export const limits={stretch:[.75,1.35],lean:[-Math.PI/12,Math.PI/12],aperture:[0,1]} as const;
export const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:0));
