type AudioClip = {
  id: string;
  chord: string;
  start: number;        // seconds
  duration: number;     // seconds
  buffer?: AudioBuffer; // set after loading
  color: string;
  peaks?: Float32Array; // normalized [-1, 1], envelope per small time step
};
export type { AudioClip };