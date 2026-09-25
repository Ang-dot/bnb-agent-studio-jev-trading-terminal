import { describe, expect, it } from 'vitest';
import { claimLease, ownsLease } from './cloud-store.js';
describe('single worker fencing',()=>{
  it('does not let a different worker claim an unexpired lease',()=>{
    expect(claimLease({owner:'a',epoch:1,expires:2000},'b',1000,5000)).toBeNull();
  });
  it('advances the fence on takeover, rejects stale workers and expired ownership',()=>{
    const next=claimLease({owner:'a',epoch:1,expires:2000},'b',2000,5000)!;
    expect(next).toEqual({owner:'b',epoch:2,expires:7000});
    expect(ownsLease(next,'a',1,2100)).toBe(false);
    expect(ownsLease(next,'b',2,2100)).toBe(true);
    expect(ownsLease(next,'b',2,7000)).toBe(false);
    expect(ownsLease(next,'b',1,2100)).toBe(false);
  });
});
