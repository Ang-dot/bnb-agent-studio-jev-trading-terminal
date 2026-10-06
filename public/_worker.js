// Pages Advanced Mode: secrets exist only in server-side bindings.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Retired presentation files may remain in the asset cache after deployment.
    // Stop these paths before reaching ASSETS; publish only the generic coin icon.
    let assetPath;
    try { assetPath = decodeURIComponent(url.pathname).replace(/\/{2,}/g, '/'); }
    catch { return new Response(null, {status:400}); }
    const retiredResearch = /^\/assets\/research(?:\/|$)/.test(assetPath);
    const retiredCoin = /^\/assets\/coins(?:\/|$)/.test(assetPath) && assetPath !== '/assets/coins/coin.svg';
    if (retiredResearch || retiredCoin) {
      return new Response(null, {status:410, headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
    }
    const publicPath = url.pathname.replace(/\/+$/, '') || '/';
    if (['GET', 'HEAD'].includes(request.method) && (publicPath === '/' || publicPath === '/architecture')) {
      url.pathname = publicPath === '/' ? '/token2049' : '/kbw/architecture';
      return Response.redirect(url.toString(), 302);
    }
    const operator = url.pathname === '/operator' || url.pathname.startsWith('/operator/');
    const path = operator ? url.pathname.slice('/operator'.length) : url.pathname;
    if (path.startsWith('/api/')) {
      if (!env.BACKEND_ORIGIN || !env.ORIGIN_SECRET) return Response.json({error:'Hosted backend is being configured'}, {status:503});
      if (!operator && !['GET','HEAD'].includes(request.method)) return Response.json({error:'Public terminal is read only'}, {status:403});
      if (!['GET','HEAD','POST'].includes(request.method)) return new Response(null,{status:405});
      if (request.method === 'POST' && (request.headers.get('Origin') !== url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))) return new Response(null,{status:403});
      const backend = new URL(env.BACKEND_ORIGIN);
      if (backend.protocol !== 'https:' || !backend.hostname.endsWith('.nodeops.app')) return new Response(null,{status:503});
      backend.pathname = path;backend.search = url.search;
      const headers = new Headers({'X-Jev-Origin-Secret':env.ORIGIN_SECRET});
      const stateRequest=/^\/api\/(?:(?:kbw|token2049)\/)?state$/.test(path);
      if (request.method === 'GET' && stateRequest) {
        const tag=request.headers.get('If-None-Match');
        if (tag) headers.set('If-None-Match',tag);
      }
      if (request.method === 'POST') {headers.set('Content-Type','application/json');headers.set('Origin',url.origin);}
      if (operator) {
        const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
        if (!jwt) return Response.json({error:'Sign in through operator access'}, {status:403});
        headers.set('Cf-Access-Jwt-Assertion',jwt);
      }
      try {
        const body = request.method === 'POST' ? await request.text() : undefined;
        if (body && new TextEncoder().encode(body).length>16384) return new Response(null,{status:413});
        const upstream=await fetch(backend,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(25000)});
        if(upstream.status>=300&&upstream.status<400&&upstream.status!==304)return new Response(null,{status:502});
        const responseHeaders=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        if (stateRequest) {
          const tag=upstream.headers.get('ETag');
          if (tag) responseHeaders.set('ETag',tag);
        }
        return new Response(upstream.status===304?null:upstream.body,{status:upstream.status,headers:responseHeaders});
      } catch {return Response.json({error:'Backend temporarily unavailable; no action confirmed'}, {status:503});}
    }
    // Pages redirects /index.html to /. Read the root asset internally so the
    // browser keeps its event edition or authenticated operator path.
    if (operator || /^\/(kbw|token2049)(?:\/architecture)?\/?$/.test(url.pathname) || /^\/token2049\/build\/?$/.test(url.pathname)) {url.pathname='/';return env.ASSETS.fetch(new Request(url,request));}
    return env.ASSETS.fetch(request);
  },
};
