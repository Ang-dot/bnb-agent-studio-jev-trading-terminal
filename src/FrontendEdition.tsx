import { createContext, useContext, type ReactNode } from 'react';
import brainLogo from './assets/living-brain-logo.png';
import tidbLogo from './assets/tidb-symbol.svg';
import { frontendRoute, type FrontendRoute } from './frontend-route.js';

const brands = {
  kbw: { label: 'KBW', memoryName: 'MEM9', memoryLogo: tidbLogo, memoryLogoAlt: 'TiDB' },
  token2049: { label: 'TOKEN2049', memoryName: 'Living Brain', memoryLogo: brainLogo, memoryLogoAlt: 'Living Brain' },
} as const;

const editionForRoute = (route: FrontendRoute) => ({ ...route, ...brands[route.edition] });
const EditionContext = createContext(editionForRoute(frontendRoute('/token2049')));

export function FrontendEditionProvider({ route, children }: { route: FrontendRoute; children: ReactNode }) {
  return <EditionContext.Provider value={editionForRoute(route)}>{children}</EditionContext.Provider>;
}

export const useFrontendEdition = () => useContext(EditionContext);

export function MemoryLogo({ size = 38, className }: { size?: number; className?: string }) {
  const { memoryLogo, memoryLogoAlt } = useFrontendEdition();
  return <img src={memoryLogo} alt={memoryLogoAlt} width={size} height={size} className={className} />;
}
