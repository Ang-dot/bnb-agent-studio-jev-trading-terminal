import { TypeSafeLogo } from '../TypeSafeLogo.js';
import './workspace-loading.css';
export function WorkspaceLoading({terminal = false}: {terminal?: boolean}) {
  return <div className={`lb-boot${terminal ? ' lb-boot-dark' : ''}`} role="status" aria-label="Loading workspace">
    <div className="lb-boot-header"><TypeSafeLogo size={32}/><strong>Trading Terminal</strong><span/></div>
    <div className="lb-boot-stage" aria-hidden="true"><div className="lb-boot-chart"><i/><div className="lb-boot-grid"/><i/></div><div className="lb-boot-context"><i/><div className="lb-boot-shimmer"/><i/></div></div>
    <div className="lb-boot-track" aria-hidden="true"/>
  </div>;
}
