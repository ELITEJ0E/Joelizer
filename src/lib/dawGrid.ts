/** Consistent musical grid quantization for DAW clip edits. */
export type DAWGridDivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | 'off';
export function gridStepSeconds(bpm: number, division: DAWGridDivision): number {
  if (division === 'off') return 0;
  const denominator = Number(division.split('/')[1]);
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  // 1/1 means a whole 4/4 bar; 1/16 is one sixteenth note.
  return (60 / Math.max(40,Math.min(280,bpm))) * (4 / denominator);
}
export function snapDawTime(time: number,bpm:number,division:DAWGridDivision,enabled:boolean): number {
  const value = Math.max(0,time);
  const step=enabled?gridStepSeconds(bpm,division):0;
  return step>0?Math.max(0,Math.round(value/step)*step):value;
}
export function clampDawTrim(start:number,duration:number,delta:number,fromLeft:boolean) {
  if (fromLeft) {
    const move = Math.max(-start,Math.min(delta,duration-0.1));
    return {start:Math.max(0,start+move),duration:duration-move,offset:move};
  }
  const end=Math.max(0.1,duration+delta);
  return {start,duration:end,offset:end-duration};
}
