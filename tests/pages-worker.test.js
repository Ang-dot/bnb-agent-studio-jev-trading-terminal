import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../public/_worker.js';
const env={BACKEND_ORIGIN:'https://production-example.tyzo.nodeops.app',ORIGIN_SECRET:'server-secret',ASSETS:{fetch:async()=>new Response('static')}};
const url='https://jev-trading-terminal.pages.dev';
afterEach(()=>vi.unstubAllGlobals());
describe('Pages event routes',()=>{
  it.each(['GET','HEAD'])('redirects legacy %s entry points while preserving query strings',async method=>{
    const asset=vi.fn();
    for(const [path,target] of [['/','/token2049'],['/architecture/','/kbw/architecture']]){
      const response=await worker.fetch(new Request(url+path+'?source=event',{method}),{ASSETS:{fetch:asset}});
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(url+target+'?source=event');
    }
    expect(asset).not.toHaveBeenCalled();
  });
  it.each(['/kbw','/kbw/','/kbw/architecture','/token2049','/token2049/architecture/','/token2049/build','/token2049/build/','/operator/kbw','/operator/token2049/architecture'])('serves %s as an app shell without redirecting its event path',async path=>{
    const asset=vi.fn(async request=>new Response(new URL(request.url).pathname));
    const response=await worker.fetch(new Request(url+path),{...env,ASSETS:{fetch:asset}});
    expect(response.status).toBe(200);
    expect(response.headers.get('Location')).toBeNull();
    expect(await response.text()).toBe('/');
  });
  it('keeps compiled assets on their own paths',async()=>{
    const asset=vi.fn(async request=>new Response(new URL(request.url).pathname));
    const response=await worker.fetch(new Request(url+'/assets/terminal.js'),{...env,ASSETS:{fetch:asset}});
    expect(await response.text()).toBe('/assets/terminal.js');
  });
  it.each(['GET','HEAD'])('serves the build shell for %s with query parameters and without a configured backend',async method=>{
    const upstream=vi.fn();vi.stubGlobal('fetch',upstream);
    const asset=vi.fn(async request=>new Response(new URL(request.url).search));
    const response=await worker.fetch(new Request(url+'/token2049/build?assistant=claude',{method}),{ASSETS:{fetch:asset}});
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('?assistant=claude');
    expect(asset.mock.calls[0][0].method).toBe(method);
    expect(upstream).not.toHaveBeenCalled();
  });
  it.each(['/kbw/build','/token2049/build/extra'])('does not claim %s as a new application route',async path=>{
    const asset=vi.fn(async request=>new Response(new URL(request.url).pathname));
    const response=await worker.fetch(new Request(url+path),{ASSETS:{fetch:asset}});
    expect(await response.text()).toBe(path);
  });
});
describe('Pages API boundary',()=>{
  it('serves the operator shell without triggering the index.html canonical redirect',async()=>{
    const asset=vi.fn(async request=>new Response(new URL(request.url).pathname));
    const response=await worker.fetch(new Request(url+'/operator'),{...env,ASSETS:{fetch:asset}});
    expect(response.status).toBe(200);expect(await response.text()).toBe('/');
  });
  it('rejects public writes and missing operator assertions without reaching origin',async()=>{
    const upstream=vi.fn();vi.stubGlobal('fetch',upstream);
    expect((await worker.fetch(new Request(url+'/api/control',{method:'POST'}),env)).status).toBe(403);
    expect((await worker.fetch(new Request(url+'/operator/api/state'),env)).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('never forwards visitor supplied secret, cookies or access assertions on the public route',async()=>{
    const upstream=vi.fn(async()=>Response.json({access:{operator:false}}));vi.stubGlobal('fetch',upstream);
    const response=await worker.fetch(new Request(url+'/api/state',{headers:{'X-Jev-Origin-Secret':'attacker','Cf-Access-Jwt-Assertion':'fake',Cookie:'private'}}),env);
    expect(response.status).toBe(200);
    const headers=upstream.mock.calls[0][1].headers;
    expect(headers.get('x-jev-origin-secret')).toBe(env.ORIGIN_SECRET);
    expect(headers.get('cf-access-jwt-assertion')).toBeNull();expect(headers.get('cookie')).toBeNull();
    expect(response.headers.get('x-jev-origin-secret')).toBeNull();
  });
  it('preserves state validators so unchanged polls return no response body',async()=>{
    const tag='\"state-v1\"';
    const upstream=vi.fn(async(_url,options)=>new Response(null,{status:304,headers:{ETag:tag}}));
    vi.stubGlobal('fetch',upstream);
    const response=await worker.fetch(new Request(url+'/api/kbw/state',{headers:{'If-None-Match':tag}}),env);
    expect(upstream.mock.calls[0][1].headers.get('If-None-Match')).toBe(tag);
    expect(response.status).toBe(304);
    expect(response.headers.get('ETag')).toBe(tag);
    expect(await response.text()).toBe('');
  });
  it('forwards operator assertion for backend signature verification and rejects cross-origin writes',async()=>{
    const upstream=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',upstream);
    const options={method:'POST',headers:{'Content-Type':'application/json',Origin:url,'Cf-Access-Jwt-Assertion':'backend-must-verify'},body:'{"action":"pause"}'};
    expect((await worker.fetch(new Request(url+'/operator/api/control',options),env)).status).toBe(200);
    expect(upstream.mock.calls[0][0].pathname).toBe('/api/control');
    expect(upstream.mock.calls[0][1].headers.get('cf-access-jwt-assertion')).toBe('backend-must-verify');
    expect((await worker.fetch(new Request(url+'/operator/api/control',{...options,headers:{...options.headers,Origin:'https://evil.test'}}),env)).status).toBe(403);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});
