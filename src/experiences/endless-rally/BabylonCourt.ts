import {Color3, Color4, Engine, FreeCamera, HemisphericLight, Mesh, MeshBuilder, Scene, SceneInstrumentation, StandardMaterial, Vector3} from 'babylonjs';
import type {ToyRenderer} from '../shared/contracts.ts';
import type {RallyState} from './RallySimulation.ts';
import {COURT} from './geometry.ts';

/** Decorative imperfections never move the collision planes. No audio engine or render loop here. */
export class BabylonCourt implements ToyRenderer<RallyState> {
  private engine: Engine;
  private scene: Scene;
  private instrumentation: SceneInstrumentation;
  private camera: FreeCamera;
  private ball;
  private seam;
  private shadow;
  private near;
  private far;
  private bumper;
  private floorMaterial: StandardMaterial;
  private seamMaterial: StandardMaterial;
  private disposed = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const engine = this.engine = new Engine(canvas, true, {audioEngine: false, stencil: false, preserveDrawingBuffer: false, doNotHandleContextLost: true}, false);
    engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.5));
    const scene = this.scene = new Scene(engine);
    scene.clearColor = new Color4(.91, .90, .87, 1);
    this.instrumentation = new SceneInstrumentation(scene);
    const camera = this.camera = new FreeCamera('fixed elevated camera', new Vector3(0, 8.8, 7.6), scene);
    camera.setTarget(new Vector3(0, 0, 0));
    camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA;
    const light = new HemisphericLight('soft skylight', new Vector3(-.4, 1, -.25), scene);
    light.intensity = 1;
    light.groundColor = Color3.FromHexString('#6d685d');
    const material = (name: string, hex: string) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(.08, .08, .08);
      return m;
    };
    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial) => {
      const mesh = MeshBuilder.CreateBox(name, {width:w, height:h, depth:d}, scene);
      mesh.position.set(x,y,z); mesh.material = mat; return mesh;
    };
    const cream = material('unglazed ceramic', '#eee5ce');
    const ink = material('ink ball', '#202826');
    const cobalt = material('cobalt glaze', '#2448c4');
    const pale = material('chalk glaze', '#cad3b5');
    const rubber = material('citron rubber', '#d2df51');
    this.floorMaterial = material('clay playing surface', '#e2b7a4');
    box('shallow court plinth',4.3,.14,6.2,0,-.19,0,material('plinth edge','#aab29f'));
    box('flat playing field',4,.08,6,0,-.08,0,this.floorMaterial);
    for (const side of [-1,1]) {
      box('reflecting side wall',.10,.25,6,side*2.05,.035,0,cream);
      // The short outside feet are only art; both goal ends remain visibly open.
      box('awkward foot',.30,.17,.42,side*1.65,-.31,side*2.3,pale).rotation.y = side*.12;
    }
    const line = material('court markings', '#b08270');
    const markings:Mesh[]=[];
    for(let i=-8;i<=8;i++) markings.push(box('midcourt dash',.12,.006,.018,i*.22,-.032,0,line));
    for(const z of [-2.6,2.6]) markings.push(box('paddle plane',3.7,.005,.014,0,-.032,z,line));
    Mesh.MergeMeshes(markings,true);
    this.near = box('near-paddle',1.1,.23,.22,0,.13,2.71,cobalt);
    this.near.metadata = {targetId:'near-paddle'};
    this.far = box('far automated paddle',1.1,.23,.22,0,.13,-2.71,pale);
    // Torus arch is a soft-looking silhouette around the fixed circular footprint.
    this.bumper = MeshBuilder.CreateTorus('deforming bumper', {diameter:.46, thickness:.16, tessellation:20}, scene);
    this.bumper.rotation.x = Math.PI/2;
    this.bumper.position.set(-COURT.bumper.x,.24,COURT.bumper.z);
    this.bumper.material = rubber;
    const bumperFoot = MeshBuilder.CreateCylinder('fixed bumper footprint',{diameter:.60,height:.06,tessellation:24},scene);
    bumperFoot.position.set(-COURT.bumper.x,0,COURT.bumper.z); bumperFoot.material = rubber;
    this.ball = MeshBuilder.CreateSphere('one ball',{diameter:.2,segments:12},scene); this.ball.material=ink;
    this.seam = MeshBuilder.CreateTorus('cobalt ball seam',{diameter:.197,thickness:.018,tessellation:20},scene);
    this.seam.parent=this.ball; this.seam.rotation.z=.45;
    this.seamMaterial=material('ball seam highlight','#627ff3');this.seam.material=this.seamMaterial;
    const shade = material('static contact shadow','#8a7569'); shade.alpha=.23;
    this.shadow=MeshBuilder.CreateDisc('ball contact shadow',{radius:.13,tessellation:20},scene);
    this.shadow.rotation.x=Math.PI/2; this.shadow.position.y=-.025; this.shadow.material=shade;
    this.resize();
  }
  render(state: Readonly<RallyState>) {
    if(this.disposed) return;
    // Babylon's camera looks down -z: mirror presentation x so positive simulation
    // x, slider Right, keyboard Right and a rightward drag all appear to the right.
    this.ball.position.set(-state.ball.x, .14 + (state.phase==='returning' ? .18*Math.sin(Math.PI*state.returnProgress) : 0), state.ball.z);
    this.shadow.position.x=-state.ball.x; this.shadow.position.z=state.ball.z;
    this.ball.rotation.y=state.elapsed*.8;
    this.near.position.x=-state.near.x; this.far.position.x=-state.far.x;
    this.near.rotation.z=-state.near.velocity*.018; this.far.rotation.z=state.far.velocity*.018;
    this.near.scaling.y=1-state.paddleAccent;
    this.far.scaling.y=1-state.paddleAccent;
    this.ball.scaling.y=1-state.paddleAccent;
    this.ball.scaling.x=1+state.paddleAccent*.5;
    this.seamMaterial.emissiveColor.set(state.seam*.3,state.seam*.4,state.seam);
    this.bumper.scaling.y=1-state.bumperCompression;
    this.bumper.scaling.x=1+state.bumperCompression*.3;
    this.floorMaterial.diffuseColor.set(.886+state.warmth*.025,.718+state.warmth*.015,.643);
    this.scene.render();
  }
  pick(clientX: number, clientY: number) {
    const box=this.canvas.getBoundingClientRect();
    // The labelled lower edge is a generous alternate drag target on small screens.
    if(clientX>=box.left&&clientX<=box.right&&clientY>=box.bottom-56&&clientY<=box.bottom)return 'near-paddle';
    // Babylon applies hardware scaling internally; its public picking API takes CSS pixels.
    const hit=this.scene.pick(clientX-box.left,clientY-box.top);
    return hit?.pickedMesh?.metadata?.targetId || null;
  }
  point(clientX: number, clientY: number) {
    const box=this.canvas.getBoundingClientRect();
    // Fixed, centered orthographic camera keeps screen x linear in world x.
    const x=(clientX-box.left)/Math.max(1,box.width)*2-1;
    return {x:Math.max(-1,Math.min(1,x*(this.camera.orthoRight || 1)/COURT.paddleLimit)),y:0};
  }
  resize() {
    if(this.disposed) return;
    this.engine.resize();
    const aspect=this.engine.getRenderWidth()/Math.max(1,this.engine.getRenderHeight());
    const halfHeight=Math.max(3.6,2.8/aspect);
    this.camera.orthoTop=halfHeight; this.camera.orthoBottom=-halfHeight;
    this.camera.orthoLeft=-halfHeight*aspect; this.camera.orthoRight=halfHeight*aspect;
  }
  metrics() { return {meshes:this.scene.meshes.length,drawCalls:this.instrumentation.drawCallsCounter.current,triangles:this.scene.meshes.reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0)}; }
  dispose() { if(this.disposed) return; this.disposed=true; this.instrumentation.dispose(); this.scene.dispose(); this.engine.dispose(); }
}
