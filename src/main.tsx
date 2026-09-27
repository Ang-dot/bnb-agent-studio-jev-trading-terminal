import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { TerminalApp as App } from "./ReplayDesk.js";
import "./evidence-desk.css";
import { frontendRoute } from './frontend-route.js';
import { FrontendEditionProvider } from './FrontendEdition.js';
const ArchitecturePage = lazy(() => import('./ArchitecturePage.js').then(m => ({default:m.ArchitecturePage})));
const route = frontendRoute(window.location.pathname);
if (route.redirectTo) {
  window.location.replace(route.redirectTo + window.location.search + window.location.hash);
} else createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FrontendEditionProvider route={route}>
      {route.page==='architecture' ? <Suspense fallback={<p role="status" style={{padding:32}}>Loading architecture…</p>}><ArchitecturePage /></Suspense> : <App />}
    </FrontendEditionProvider>
  </React.StrictMode>,
);
