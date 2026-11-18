import type {AudioFrame} from './audio/contracts.ts';
export type {AudioFrame, PlaybackSnapshot} from './audio/contracts.ts';
export type ToyMode = 'watch' | 'control';
export type AudioSourceMode = 'live' | 'ambient' | 'inactive';
export type ResetReason = 'open' | 'user' | 'seek' | 'mix-change';
export type ToyValueControl = 'counterweight' | 'paddle-position';
export type ToyCommand = 'poke' | 'nudge-object' | 'settle' | 'nudge-ball';
export type ToyAction =
  | {type: 'select'; targetId: string}
  | {type: 'grab'; targetId: string; x: number; y: number}
  | {type: 'move'; x: number; y: number}
  | {type: 'release'}
  | {type: 'nudge'; targetId: string; x: number; y: number}
  | {type: 'set-value'; control: ToyValueControl; value: number}
  | {type: 'command'; command: ToyCommand; targetId?: string};
export interface ToyFrame {
  dt: number; simTime: number; mediaTime: number; features: Readonly<AudioFrame>;
  featureSequence: number; source: AudioSourceMode; mode: ToyMode; autonomy: number; motion: number; reducedMotion: boolean;
}
export interface ToySimulation<State> {
  reset(seed: number, mediaTime: number, reason: ResetReason): State;
  /** False rejects an action without claiming ownership or resetting inactivity. */
  act(action: ToyAction): boolean;
  step(frame: ToyFrame): State;
  snapshot(): Readonly<State>;
  /** Drop queued discrete events on pause/visibility suspension, preserving physical state. */
  suspend?():void;
}
export interface ToyRenderer<State> {
  render(state: Readonly<State>): void;
  pick(clientX: number, clientY: number): string | null;
  resize(): void;
  dispose(): void;
  point(clientX:number, clientY:number):{x:number;y:number};
  metrics(): {meshes: number; drawCalls: number; triangles: number};
}
export interface ToyConfig<State> {
  id:string; title:string; description:string; poster:string;
  hint?:string; stageLabel?:string; stageMeta?:string; posterAlt?:string; controlLabel?:string;
  idleHint?:string; activeHint?:string; phase?:(state:Readonly<State>)=>string; horizontalValueKeys?:boolean;
  targetButtons?:boolean;
  directionLabels?:{left:string;right:string;up:string;down:string};
  sceneCommand?:ToyCommand;
  mix:{id:string;artist:string;url:string};
  targets:ReadonlyArray<{id:string;name:string}>;
  valueControl?:{id:ToyValueControl;label:string;read:(state:Readonly<State>)=>number};
  commands:ReadonlyArray<{id:ToyCommand;label:string;targeted:boolean}>;
  createSimulation:()=>ToySimulation<State>;
  createRenderer:(canvas:HTMLCanvasElement)=>ToyRenderer<State>;
  selected:(state:Readonly<State>)=>string;
  grabbed:(state:Readonly<State>)=>string|null;
  diagnostics:(state:Readonly<State>)=>Record<string,number>;
}
