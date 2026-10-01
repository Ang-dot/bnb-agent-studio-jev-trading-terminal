import {describe,it,expect} from 'vitest';
import {AssessmentPacer} from './assessment-pacer.js';
describe('shared actual-model pacing',()=>{
  it('reserves ten of thirty minute starts for inventory and releases slots after a minute',()=>{
    let now=1000000;const pacer=new AssessmentPacer(()=>now);
    for(let i=0;i<20;i++)expect(pacer.reserve(false)).toBe(true);
    expect(pacer.reserve(false)).toBe(false);
    for(let i=0;i<10;i++)expect(pacer.reserve(true)).toBe(true);
    expect(pacer.reserve(true)).toBe(false);
    now+=59999;expect(pacer.reserve(false)).toBe(false);
    now++;expect(pacer.reserve(false)).toBe(true);
  });
  it('allows inventory to use the whole window, without an accumulated hourly lockout',()=>{
    let now=1000000;const pacer=new AssessmentPacer(()=>now);
    for(let minute=0;minute<4;minute++){
      for(let i=0;i<30;i++)expect(pacer.reserve(true)).toBe(true);
      expect(pacer.reserve(false)).toBe(false);now+=60000;
    }
  });
});
