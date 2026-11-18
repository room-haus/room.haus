export const ROD_LIMIT=35*Math.PI/180, OBJECT_LIMIT=Math.PI/6, SPEED_LIMIT=1.5;
export const rods = [
  {length:2,parent:-1,attachment:0,drop:0},
  {length:1.2,parent:0,attachment:-.82,drop:.48},
  {length:.9,parent:0,attachment:.82,drop:.72},
] as const;
export const objects = [
  {id:'bell',name:'Ceramic bell',rod:1,attachment:-.5,length:.55,mass:.8,radius:.17},
  {id:'stone',name:'Heavy stone',rod:1,attachment:.48,length:.86,mass:1.8,radius:.18},
  {id:'disc',name:'Bent disc',rod:2,attachment:-.36,length:.4,mass:.6,radius:.17},
  {id:'vessel',name:'Hollow vessel',rod:2,attachment:.36,length:.75,mass:1.4,radius:.2},
  {id:'oddity',name:'Little onlooker',rod:0,attachment:.08,length:.58,mass:.65,radius:.12},
] as const;
export const targets=[...objects.map(({id,name})=>({id,name})),{id:'counterweight',name:'Counterweight'}];
export const clamp=(n:number, min:number, max:number)=>Math.max(min,Math.min(max,n));
export const finite=(n:number, fallback=0)=>Number.isFinite(n)?n:fallback;
