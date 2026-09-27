export type FrontendEdition = 'kbw' | 'token2049';

export interface FrontendRoute {
  edition: FrontendEdition;
  page: 'terminal' | 'architecture';
  terminalPath: string;
  architecturePath: string;
  redirectTo?: string;
}

export function frontendRoute(pathname: string): FrontendRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  const operator = /^\/operator(?:\/|$)/.test(path);
  const localPath = operator ? path.slice('/operator'.length) || '/' : path;
  const editionMatch = localPath.match(/^\/(kbw|token2049)(?:\/|$)/);
  // Existing operator URLs retain their original Living Brain edition.
  const edition = (editionMatch?.[1] ?? (operator ? 'token2049' : 'kbw')) as FrontendEdition;
  const terminalPath = operator
    ? `/operator${editionMatch ? `/${edition}` : ''}`
    : `/${edition}`;
  const architecturePath = `${terminalPath}/architecture`;
  const page = path === architecturePath || localPath === '/architecture' ? 'architecture' : 'terminal';
  const redirectTo = !operator && (path === '/' || path === '/architecture')
    ? page === 'architecture' ? architecturePath : terminalPath
    : undefined;
  return { edition, page, terminalPath, architecturePath, redirectTo };
}
