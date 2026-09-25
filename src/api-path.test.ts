import {it,expect} from 'vitest';
import {apiPath} from './api-path.js';
it('keeps operator requests inside the Access-protected path',()=>{
  expect(apiPath('/api/state','/operator')).toBe('/operator/api/state');
  expect(apiPath('/api/control','/operator/')).toBe('/operator/api/control');
  expect(apiPath('/api/state','/')).toBe('/api/state');
  expect(apiPath('/api/state','/operators')).toBe('/api/state');
});
