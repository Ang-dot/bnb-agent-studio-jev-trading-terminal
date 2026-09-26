import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { TerminalApp as App } from "./ReplayDesk.js";
import "./evidence-desk.css";
import { pageForPath } from './architecture-model.js';
const ArchitecturePage = lazy(() => import('./ArchitecturePage.js').then(m => ({default:m.ArchitecturePage})));
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {pageForPath(window.location.pathname)==='architecture' ? <Suspense fallback={<p role="status" style={{padding:32}}>Loading architecture…</p>}><ArchitecturePage /></Suspense> : <App />}
  </React.StrictMode>,
);
