import assert from 'node:assert/strict';
import { dawClipEnvelopeGain, scheduleDawClipEnvelope, dawSafePeakGain } from '../lib/dawMixing';
import { gridStepSeconds, snapDawTime, clampDawTrim } from '../lib/dawGrid';

assert.equal(gridStepSeconds(120,'1/1'),2);
assert.equal(gridStepSeconds(120,'1/4'),.5);
assert.equal(gridStepSeconds(120,'1/16'),.125);
assert.equal(gridStepSeconds(120,'off'),0);
assert.equal(snapDawTime(.31,120,'1/16',true),.25);
assert.equal(snapDawTime(.31,120,'1/4',true),.5);
assert.equal(snapDawTime(.31,120,'1/16',false),.31);
assert.deepEqual(clampDawTrim(3,2,0.5,true),{start:3.5,duration:1.5,offset:.5});
assert.deepEqual(clampDawTrim(0,2,-1,true),{start:0,duration:2,offset:0});
const clip={ duration:4, volume:.8, fadeIn:1, fadeOut:1 };
assert.equal(dawClipEnvelopeGain(clip,0),0);
assert.equal(dawClipEnvelopeGain(clip,.5),.4);
assert.equal(dawClipEnvelopeGain(clip,2),.8);
assert.equal(dawClipEnvelopeGain(clip,3.5),.4);
assert.equal(dawClipEnvelopeGain(clip,4),0);
const events: Array<{kind:string;value?:number;when:number}>=[];
const mock={
  cancelScheduledValues(when:number){events.push({kind:'cancel',when});return this;},
  setValueAtTime(value:number,when:number){events.push({kind:'set',value,when});return this;},
  linearRampToValueAtTime(value:number,when:number){events.push({kind:'ramp',value,when});return this;}
};
scheduleDawClipEnvelope(mock,clip,20,0,4);
assert.ok(events.some(e=>e.kind==='set'&&e.value===0&&e.when===20));
assert.ok(events.some(e=>e.kind==='ramp'&&e.value===.8&&e.when===21));
assert.ok(events.some(e=>e.kind==='ramp'&&e.value===0&&e.when===24));
events.length=0;
scheduleDawClipEnvelope(mock,clip,50,3.5,.5);
assert.ok(events.some(e=>e.kind==='set'&&Math.abs(e.value!-.4)<1e-8), 'Seek mid-fade should start at correct gain');
assert.equal(dawSafePeakGain(0),1);
assert.equal(dawSafePeakGain(.5),1);
assert.ok(dawSafePeakGain(1.5)<1);
const overlap={duration:2,volume:1,fadeIn:1.5,fadeOut:1.5};
assert.ok(dawClipEnvelopeGain(overlap,1)<1);
console.log('DAW quantization, smooth trim geometry, fade automation and export peak safety passed.');
