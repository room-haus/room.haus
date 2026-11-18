import * as B from 'babylonjs';
import type {ToyRenderer} from '../shared/contracts.ts';
import type {EnsembleState,MemberState} from './EnsembleSimulation.ts';
import {members} from './config.ts';
interface Vessel {mesh:B.Mesh;rest:number[];positions:number[];normals:number[];indices:number[];stud:B.Mesh;shadow:B.Mesh;}
/** Original ring-authored hollow ceramics. No imported artwork, rigs or audio objects. */
export class BabylonEnsemble implements ToyRenderer<EnsembleState> {
 private engine:B.Engine;private scene:B.Scene;private camera:B.FreeCamera;private canvas:HTMLCanvasElement;
 private vessels:Vessel[]=[];private selection:B.Mesh;private light:B.HemisphericLight;
 private disposed=false;private draws=0;private current:Readonly<EnsembleState>|null=null;
 constructor(canvas:HTMLCanvasElement){
  this.canvas=canvas;this.engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,doNotHandleContextLost:true});this.scene=new B.Scene(this.engine);
  try{
   this.scene.clearColor=new B.Color4(.925,.916,.89,1);
   this.camera=new B.FreeCamera('ensemble-fixed',new B.Vector3(0,0,-10),this.scene);this.camera.setTarget(B.Vector3.Zero());this.camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;this.camera.minZ=.1;this.camera.maxZ=25;
   this.light=new B.HemisphericLight('window',new B.Vector3(-1,1,-.6),this.scene);this.light.intensity=.94;this.light.groundColor=new B.Color3(.32,.3,.27);
   const material=(name:string,color:string)=>{const m=new B.StandardMaterial(name,this.scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.23,.23,.23);m.specularPower=36;return m;};
   const ink=material('ink seams','#242A2D'),shadow=material('ink on chalk','#CBC8BC'),feet=material('undersides','#68685D');
   members.forEach((c,i)=>{
    const rest:number[]=[],indices:number[]=[],segments=40,rows=20;
    // Continuous outer wall → rim → inner wall, authored as unequal elliptical sections.
    for(let r=0;r<=rows*2+1;r++){
     const inside=r>rows,t=inside?(rows*2+1-r)/rows:r/rows;
     const slot=Math.min(c.profile.length-2,Math.floor(t*(c.profile.length-1))),f=t*(c.profile.length-1)-slot;
     const radius=(c.profile[slot]*(1-f)+c.profile[slot+1]*f)*(inside?.78:1);
     for(let a=0;a<=segments;a++){
      const theta=a/segments*Math.PI*2,irregular=1+.055*Math.sin(theta*3+i)+.025*Math.cos(theta*5);
      const bend=(i===1?.16:i===2?-.12:.04)*t*t;
      const x=Math.cos(theta)*c.width*radius*irregular+bend;
      const z=Math.sin(theta)*c.depth*radius*irregular-t*t*.18;
      // Rim's slanted plane exposes the dark hollow to the fixed camera.
      const y=t*c.height+Math.sin(theta)*.19*t*t+(inside?.04*(1-t):0);
      rest.push(x,y,z);
     }
    }
    for(let r=0;r<rows*2+1;r++)for(let a=0;a<segments;a++){const k=r*(segments+1)+a;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    const normals:number[]=[];B.VertexData.ComputeNormals(rest,indices,normals);
    const mesh=new B.Mesh(c.id,this.scene),data=new B.VertexData();data.positions=rest;data.indices=indices;data.normals=normals;data.applyToMesh(mesh,true);mesh.position.set(c.x,c.base,0);
    const clay=material(c.id+' glaze',c.color);clay.backFaceCulling=false;mesh.material=clay;
    const stud=B.MeshBuilder.CreateSphere(c.id+' seam',{diameter:1,segments:12},this.scene);stud.material=ink;
    const grounding=B.MeshBuilder.CreateDisc(c.id+' shadow',{radius:1,tessellation:40},this.scene);grounding.material=shadow;grounding.position.set(c.x+.08,c.base-.08,.6);grounding.scaling.set(c.width*1.18,.065,1);
    for(let foot=0;foot<2;foot++){const m=B.MeshBuilder.CreateSphere(c.id+' foot '+foot,{diameter:1,segments:12},this.scene);m.material=foot===0?clay:feet;m.position.set(c.x+(foot?1:-1)*c.width*.38,c.base-.045,-.06);m.scaling.set(c.width*(foot?.48:.6),.16,.32);}
    this.vessels.push({mesh,rest,positions:rest.slice(),normals,indices,stud,shadow:grounding});
   });
   this.selection=B.MeshBuilder.CreateTorus('selection footprint',{diameter:1,thickness:.014,tessellation:48},this.scene);this.selection.rotation.x=Math.PI/2;this.selection.material=material('cobalt mark','#244BCD');
   this.resize();
  }catch(error){this.scene.dispose();this.engine.dispose();throw error;}
 }
 resize(){
  const b=this.canvas.getBoundingClientRect(),aspect=b.width/Math.max(1,b.height),halfY=Math.max(2.25,2.85/aspect),halfX=halfY*aspect;
  this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1:1.5));this.engine.resize();
  this.camera.orthoLeft=-halfX;this.camera.orthoRight=halfX;this.camera.orthoTop=halfY;this.camera.orthoBottom=-halfY;
 }
 private deform(v:Vessel,m:MemberState,i:number){
  const c=members[i],width=1/Math.sqrt(m.stretch.value);
  for(let j=0;j<v.rest.length;j+=3){
   const y=v.rest[j+1],t=Math.max(0,Math.min(1,y/c.height)),rim=t*t*t;
   const aperture=1+rim*(m.aperture.value-.35)*.55;
   v.positions[j]=v.rest[j]*width*aperture+Math.sin(m.lean.value)*c.height*t*t;
   v.positions[j+1]=y*(1+(m.stretch.value-1)*t);
   v.positions[j+2]=v.rest[j+2]*width*aperture;
  }
  B.VertexData.ComputeNormals(v.positions,v.indices,v.normals);
  v.mesh.updateVerticesData(B.VertexBuffer.PositionKind,v.positions,true,false);v.mesh.updateVerticesData(B.VertexBuffer.NormalKind,v.normals,false,false);
  const t=.68,attention=m.attention?Math.sign(members.find(c=>c.id===m.attention)!.x-c.x):0;
  v.stud.position.set(c.x+Math.sin(m.lean.value)*c.height*t*t+attention*.055,c.base+c.height*t*(1+(m.stretch.value-1)*t)+m.detail,-c.depth*.88-.08);
  v.stud.scaling.set(i===0?.24:.075,i===0?.025:.16+.07*m.aperture.value,.035);v.stud.rotation.z=-m.lean.value;
 }
 render(state:Readonly<EnsembleState>){
  if(this.disposed)return;this.current=state;state.members.forEach((m,i)=>this.deform(this.vessels[i],m,i));
  const c=members.find(m=>m.id===state.selectedId)!;this.selection.position.set(c.x,c.base-.14,-.12);this.selection.scaling.set(c.width*1.7,1,.14);
  this.light.diffuse.set(1-.035*state.brightness,.975,.94+.04*state.brightness);
  const before=this.engine._drawCalls.current;this.scene.render();this.draws=this.engine._drawCalls.current-before;
 }
 point(clientX:number,clientY:number){const b=this.canvas.getBoundingClientRect();return {x:((clientX-b.left)/b.width*2-1)*this.camera.orthoRight!/3,y:(1-(clientY-b.top)/b.height*2)*this.camera.orthoTop!/3};}
 pick(clientX:number,clientY:number){
  const p=this.point(clientX,clientY),b=this.canvas.getBoundingClientRect();let chosen:string|null=null,best=Infinity;
  members.forEach((c,i)=>{const m=this.current?.members[i],stretch=m?.stretch.value||1,lean=m?.lean.value||0;
   const centerX=c.x+Math.sin(lean)*c.height*.3,centerY=c.base+c.height*stretch*.5;
   const rx=Math.max(c.width*1.1,22/b.width*this.camera.orthoRight!*2),ry=c.height*stretch*.6;
   const d=((p.x*3-centerX)/rx)**2+((p.y*3-centerY)/ry)**2;if(d<=1&&d<best){best=d;chosen=c.id;}
  });return chosen;
 }
 metrics(){return {meshes:this.scene.meshes.length,drawCalls:this.draws,triangles:this.scene.meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0)};}
 dispose(){if(this.disposed)return;this.disposed=true;this.scene.dispose();this.engine.dispose();}
}
