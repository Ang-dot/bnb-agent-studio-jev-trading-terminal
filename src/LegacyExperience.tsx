import { lazy, Suspense } from 'react';
import { TerminalApp } from './ReplayDesk.js';
import './evidence-desk.css';
const Architecture = lazy(()=>import('./ArchitecturePage.js').then(m=>({default:m.ArchitecturePage})));
export default function LegacyExperience({architecture}:{architecture:boolean}) {
  return architecture ? <Suspense fallback={<p role="status" style={{padding:32}}>Loading architecture…</p>}><Architecture/></Suspense> : <TerminalApp/>;
}
