export type Mode = 'DRIFT' | 'EXPLORE' | 'STILL';
export type Direction = 'forward' | 'back' | 'left' | 'right';
export type Chapter = 'THRESHOLD' | 'CATACOMBS' | 'TRANSMITTER' | 'THE HALL' | 'AFTERIMAGE';
export interface AudioFrame {
  time: number; playing: boolean; available: boolean;
  rms: number; sub: number; bass: number; lowMid: number; mid: number; high: number;
  brightness: number; onset: number; intensity: number; bpm: number; beatConfidence: number;
  tempoBeats?: number; tempoPulses?: number;
}
export interface Cue { id: string; time: number; kind: 'breakdown' | 'build' | 'drop' | 'transition' | 'outro'; intensity: number; chapter: Chapter }
export interface WorldEvent { id: string; time: number; type: 'artifact-awaken' | 'open-gate' | 'reveal-room' | 'change-atmosphere'; magnitude: number; targetId?: string }
export interface DirectorState { time: number; cycleTime: number; chapter: Chapter; gateOpen: number; reveal: number; artifact: number; atmosphere: number; palette: 'ember' | 'violet'; events: WorldEvent[] }
export interface Tile { x: number; z: number; zone: 'corridor' | 'chamber' | 'hall'; variant: number }
export interface Pose { x: number; y: number; z: number; yaw: number }
export interface Waypoint { time: number; x: number; z: number; yaw: number }
export interface Dungeon { seed: number; tileSize: number; tiles: Tile[]; route: Waypoint[]; gate: {x: number; z: number}; artifact: {x: number; z: number}; duration: number }
export interface NavigationState { mode: Mode; pose: Pose; resumeOffered: boolean }
export interface SceneFrame { audio: AudioFrame; director: DirectorState; navigation: NavigationState; reducedMotion: boolean; motion: number; delta: number; response?: WorldResponse; encounters?: EncounterSnapshot }
export interface SceneMetrics { fps: number; meshes: number; drawCalls: number; width: number; height: number }
export interface SceneHandle { update(frame: SceneFrame): void; metrics(): SceneMetrics; dispose(): void }
export interface PlaybackSnapshot { playing: boolean; status: string; time: number; duration: number; error: string | null }

/** Shared perceptual mappings: one truth for renderer, HUD and UX documentation. */
export interface WorldResponse {
  lantern: number; runes: number; fog: number; dust: number; resonance: number;
  enemyEnergy: number; cadence: number; intensity: number; reaction: number;
  tempoPulse: number; tempoColor: number;
  source: 'live' | 'cue' | 'paused';
}
export interface EnemyDefinition {
  id: string; name: string; kind: 'bone' | 'eye' | 'moth';
  x: number; z: number; height: number; width: number;
  signal: 'bass' | 'mid' | 'high'; description: string; reply: string;
}
export interface EnemyState {
  id: string; visible: boolean; proximity: number; energy: number;
  reaction: number; acknowledged: boolean;
  health: number; maxHealth: number; defeated: boolean;
}
export interface EncounterSnapshot {
  enemies: EnemyState[]; selectedId: string | null; message: string; reaction: number;
  action: 'provoke' | 'attack';
  mana: number;
}
export interface EnemyTarget { id: string; x: number; y: number; visible: boolean }
