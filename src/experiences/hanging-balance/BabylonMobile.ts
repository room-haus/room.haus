import * as B from 'babylonjs';
import type {ToyRenderer} from '../shared/contracts.ts';
import {transforms,type MobileState,type Point} from './MobileSimulation.ts';
import {objects,rods} from './config.ts';
/** Fixed orthographic camera: rendering and picking share one interaction plane. */
export class BabylonMobile implements ToyRenderer<MobileState> {
  private engine:B.Engine;
  private scene:B.Scene;
  private camera:B.FreeCamera;
  private canvas:HTMLCanvasElement;
  private bars:B.Mesh[]=[];
  private cords:B.Mesh[]=[];
  private forms:B.Mesh[]=[];
  private detail:B.Mesh;
  private weight:B.Mesh;
  private selection:B.Mesh;
  private light:B.HemisphericLight;
  private positions:Point[]=[];
  private disposed=false;
  private drawCalls=0;
  constructor(canvas:HTMLCanvasElement) {
    this.canvas=canvas;
    this.engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,doNotHandleContextLost:true});
    this.scene=new B.Scene(this.engine);
    try {
      this.scene.clearColor=new B.Color4(.89,.88,.85,1);
      this.camera=new B.FreeCamera('fixed',new B.Vector3(0,0,-8),this.scene);
      this.camera.setTarget(B.Vector3.Zero());this.camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;
      this.camera.minZ=.1;this.camera.maxZ=30;
      this.light=new B.HemisphericLight('softbox',new B.Vector3(-.7,1,-1),this.scene);this.light.intensity=.95;
      this.light.groundColor=new B.Color3(.28,.26,.24);
      const material=(name:string,color:string,rough=true)=>{const m=new B.StandardMaterial(name,this.scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=rough?new B.Color3(.12,.12,.12):new B.Color3(.55,.55,.55);return m;};
      const ink=material('ink','#333631'),cobalt=material('cobalt ceramic','#2146BD',false),stone=material('warm stone','#96917E'),metal=material('brushed disc','#B7B7AD',false),cream=material('chalk vessel','#D8D0B9'),red=material('vermilion','#BD3D27');
      const cordMat=material('thread','#66685D');
      for(let i=0;i<3;i++) {const bar=B.MeshBuilder.CreateCylinder('rod-'+i,{height:1,diameter:.025,tessellation:8},this.scene);bar.material=ink;this.bars.push(bar);}
      for(let i=0;i<8;i++) {const cord=B.MeshBuilder.CreateCylinder('cord-'+i,{height:1,diameter:.009,tessellation:6},this.scene);cord.material=cordMat;this.cords.push(cord);}
      const bell=B.MeshBuilder.CreateCylinder('bell',{height:.36,diameterTop:.14,diameterBottom:.4,tessellation:32},this.scene);bell.material=cobalt;
      const rock=B.MeshBuilder.CreateIcoSphere('stone',{radius:.23,subdivisions:1,flat:true},this.scene);rock.scaling.set(.85,1.28,.85);rock.material=stone;
      const disc=B.MeshBuilder.CreateCylinder('disc',{height:.04,diameter:.42,tessellation:28},this.scene);disc.rotation.x=Math.PI/2-.25;disc.material=metal;
      const vessel=B.MeshBuilder.CreateLathe('vessel',{shape:[new B.Vector3(.08,-.23,0),new B.Vector3(.2,-.13,0),new B.Vector3(.21,.08,0),new B.Vector3(.13,.24,0),new B.Vector3(.1,.24,0),new B.Vector3(.15,.05,0),new B.Vector3(.12,-.14,0)],tessellation:28,sideOrientation:B.Mesh.DOUBLESIDE},this.scene);vessel.material=cream;vessel.rotation.x=-.35;
      const oddity=B.MeshBuilder.CreateSphere('oddity',{diameter:.27,segments:12},this.scene);oddity.scaling.set(1,.7,.8);oddity.material=red;
      this.forms=[bell,rock,disc,vessel,oddity];
      this.detail=B.MeshBuilder.CreateSphere('aperture',{diameter:.09,segments:8},this.scene);this.detail.scaling.set(.6,1,.3);this.detail.material=ink;
      this.weight=B.MeshBuilder.CreateBox('counterweight',{width:.19,height:.13,depth:.16},this.scene);this.weight.material=red;
      this.selection=B.MeshBuilder.CreateTorus('selected',{diameter:.58,thickness:.012,tessellation:48},this.scene);this.selection.rotation.x=Math.PI/2;this.selection.material=cobalt;
      const anchor=B.MeshBuilder.CreateTorus('anchor',{diameter:.09,thickness:.015,tessellation:16},this.scene);anchor.rotation.x=Math.PI/2;anchor.position.set(0,2,0);anchor.material=ink;
      // Static floor ellipse supplies a quiet grounding mark without a shadow map.
      const shadow=B.MeshBuilder.CreateDisc('grounding',{radius:1,tessellation:48},this.scene);shadow.position.set(0,-1.95,.4);shadow.scaling.set(1.1,.045,1);shadow.material=material('grounding','#CBC9C1');
      this.resize();
    } catch(error) {this.scene.dispose();this.engine.dispose();throw error;}
  }
  resize() {
    const box=this.canvas.getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);
    const cap=matchMedia('(pointer: coarse)').matches?1:1.5;
    this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,cap));this.engine.resize();
    const halfY=Math.max(2.4,2.1/aspect),halfX=halfY*aspect;
    this.camera.orthoLeft=-halfX;this.camera.orthoRight=halfX;this.camera.orthoTop=halfY;this.camera.orthoBottom=-halfY;
  }
  private line(mesh:B.Mesh,a:Point,b:Point) {
    mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,0);mesh.scaling.y=Math.hypot(b.x-a.x,b.y-a.y);
    mesh.rotation.z=Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2;
  }
  render(state:Readonly<MobileState>) {
    if(this.disposed)return;
    const t=transforms(state);
    this.positions=[...t.positions,t.counterweight];
    this.line(this.cords[0],{x:0,y:2},t.anchors[0]);
    rods.forEach((r,i)=>{
      const a=state.rods[i].angle,p=t.anchors[i],v={x:Math.cos(a)*r.length/2,y:Math.sin(a)*r.length/2};
      this.line(this.bars[i],{x:p.x-v.x,y:p.y-v.y},{x:p.x+v.x,y:p.y+v.y});
      if(i) {const parent=t.anchors[0],angle=state.rods[0].angle;this.line(this.cords[i],{x:parent.x+r.attachment*Math.cos(angle),y:parent.y+r.attachment*Math.sin(angle)},p);}
    });
    objects.forEach((o,i)=>{
      this.line(this.cords[i+3],t.joints[i],t.positions[i]);
      this.forms[i].scaling.y=[1,1.28,1,1,.7][i]*(1-state.contacts[i]*.2);
      const p=t.positions[i];this.forms[i].position.set(p.x,p.y,0);this.forms[i].rotation.z=state.objects[i].angle*(i===1?.3:1)+(i===2?state.detail:0);
    });
    const odd=t.positions[4];this.detail.position.set(odd.x+Math.sin(state.time*.16)*.045,odd.y,-.105);
    this.weight.position.set(t.counterweight.x,t.counterweight.y,0);this.weight.rotation.z=state.rods[0].angle;
    const index=objects.findIndex(o=>o.id===state.selectedId),selected=index<0?t.counterweight:t.positions[index];
    this.selection.position.set(selected.x,selected.y,-.25);this.selection.scaling.setAll(index<0?.65:1);
    this.light.diffuse=new B.Color3(1-.08*state.brightness,.97,.9+.1*state.brightness);
    const before=this.engine._drawCalls.current;
    this.scene.render();
    this.drawCalls=this.engine._drawCalls.current-before;
  }
  point(clientX:number,clientY:number) {
    const b=this.canvas.getBoundingClientRect();
    return {x:((clientX-b.left)/b.width*2-1)*this.camera.orthoRight!/2.5,y:(1-(clientY-b.top)/b.height*2)*this.camera.orthoTop!/2.5};
  }
  pick(clientX:number,clientY:number):string|null {
    const p=this.point(clientX,clientY),b=this.canvas.getBoundingClientRect();
    // Minimum 44px diameter hit area, independent of the visible sculptural mesh.
    const radius=Math.max(.25,44/b.width*this.camera.orthoRight!);
    let best=-1,distance=Infinity;
    this.positions.forEach((v,i)=>{const d=Math.hypot(p.x*2.5-v.x,p.y*2.5-v.y);if(d<radius&&d<distance){best=i;distance=d;}});
    return best<0?null:best===5?'counterweight':objects[best].id;
  }
  metrics() {return {meshes:this.scene.meshes.length,drawCalls:this.drawCalls,triangles:this.scene.meshes.reduce((sum,mesh)=>sum+mesh.getTotalIndices(),0)/3};}
  dispose() {if(this.disposed)return;this.disposed=true;this.scene.dispose();this.engine.dispose();}
}
