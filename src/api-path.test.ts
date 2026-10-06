import {it,expect} from 'vitest';
import {apiPath} from './api-path.js';
it('keeps operator requests inside the Access-protected path',()=>{
  expect(apiPath('/api/state','/operator')).toBe('/operator/api/token2049/state');
  expect(apiPath('/api/control','/operator/')).toBe('/operator/api/token2049/control');
  expect(apiPath('/api/state','/')).toBe('/api/token2049/state');
  expect(apiPath('/api/state','/kbw')).toBe('/api/kbw/state');
  expect(apiPath('/api/state','/kbw/architecture')).toBe('/api/kbw/state');
  expect(apiPath('/api/state','/operators')).toBe('/api/state');
});
