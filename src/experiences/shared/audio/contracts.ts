export interface AudioFrame {
  time: number; playing: boolean; available: boolean;
  rms: number; sub: number; bass: number; lowMid: number; mid: number; high: number;
  brightness: number; onset: number; intensity: number; bpm: number; beatConfidence: number;
  tempoBeats?: number; tempoPulses?: number;
}
export interface PlaybackSnapshot { playing: boolean; status: string; time: number; duration: number; error: string | null }
