export function apiPath(path:string,locationPath=typeof window==='undefined'?'':window.location.pathname){
  return /^\/operator(?:\/|$)/.test(locationPath)&&path.startsWith('/api/') ? '/operator'+path : path;
}
