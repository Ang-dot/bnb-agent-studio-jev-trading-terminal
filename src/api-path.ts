import { frontendRoute } from './frontend-route.js';
export function apiPath(path:string,locationPath=typeof window==='undefined'?'':window.location.pathname){
  if(!path.startsWith('/api/'))return path;
  const operator=/^\/operator(?:\/|$)/.test(locationPath);
  const event=/^\/(?:operator\/)?(?:kbw|token2049)(?:\/|$)/.test(locationPath);
  if(!operator&&!event&&locationPath!=='/')return path;
  const {edition}=frontendRoute(locationPath);
  return `${operator?'/operator':''}/api/${edition}${path.slice('/api'.length)}`;
}
