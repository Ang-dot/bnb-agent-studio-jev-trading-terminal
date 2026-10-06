import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { frontendRoute } from './frontend-route.js';
import { FrontendEditionProvider } from './FrontendEdition.js';
import { WorkspaceLoading } from './token2049/WorkspaceLoading.js';
const LegacyExperience = lazy(() => import('./LegacyExperience.js'));
const Token2049Experience = lazy(() => import('./token2049/Token2049Experience.js'));
const route = frontendRoute(window.location.pathname);
if (route.redirectTo) {
  window.location.replace(route.redirectTo + window.location.search + window.location.hash);
} else createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FrontendEditionProvider route={route}>
      <Suspense fallback={route.edition==='token2049'&&!window.location.pathname.startsWith('/operator')?<WorkspaceLoading terminal={route.page==='build'}/>:<p role="status" style={{padding:32,fontFamily:'system-ui'}}>Opening Trading Terminal…</p>}>
        {route.edition==='token2049' && !window.location.pathname.startsWith('/operator')
          ? <Token2049Experience page={route.page}/>
          : <LegacyExperience architecture={route.page==='architecture'}/>}
      </Suspense>
    </FrontendEditionProvider>
  </React.StrictMode>,
);
