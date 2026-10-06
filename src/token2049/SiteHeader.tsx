import { ArrowUpRight, Github } from 'lucide-react';
import { TypeSafeLogo } from '../TypeSafeLogo.js';
import bnbLogo from '../assets/bnb-chain-symbol-yellow.svg';
import { Button } from './ui/button.js';
export function SiteHeader({active='trading',query:providedQuery}:{active?:'trading'|'architecture';query?:string}) {
  const query=providedQuery ?? (typeof window==='undefined'?'':window.location.search);
  return <header className="lb-header">
    <a className="lb-brand" href={`/token2049${query}`} aria-label="Trading Terminal home"><img className="lb-chain" src={bnbLogo} alt="BNB Chain"/><span className="lb-brand-divider"/><TypeSafeLogo size={32}/><span>Trading Terminal</span></a>
    <nav aria-label="Main navigation" className="lb-nav"><Button asChild variant="ghost" className={active==='trading'?'is-current':''}><a href={`/token2049${query}`} aria-current={active==='trading'?'page':undefined}>Trading</a></Button><Button asChild variant="ghost" className={active==='architecture'?'is-current':''}><a href={`/token2049/architecture${query}`} aria-current={active==='architecture'?'page':undefined}>Architecture</a></Button></nav>
    <div className="lb-header-actions"><Button asChild variant="ghost" size="icon"><a href="https://github.com/Ang-dot/bnb-agent-studio-jev-trading-terminal" target="_blank" rel="noreferrer" aria-label="View source on GitHub"><Github/></a></Button><Button asChild><a href={`/token2049/build${query}`}>Build this agent <ArrowUpRight/></a></Button></div>
  </header>;
}
