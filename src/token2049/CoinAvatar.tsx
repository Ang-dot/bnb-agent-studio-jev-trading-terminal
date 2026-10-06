import type { CSSProperties } from 'react';
import { getCoinAsset } from './coin-assets';
import './coin-avatar.css';

export type CoinAvatarProps = {
  caseId: string;
  size?: number;
  decorative?: boolean;
  alt?: string;
  className?: string;
};

export function CoinAvatar({ caseId, size = 36, decorative = false, alt, className = '' }: CoinAvatarProps) {
  const asset = getCoinAsset(caseId);
  if (!asset) return null;
  const pixels = Number.isFinite(size) && size > 0 ? size : 36;
  const style = {
    '--coin-avatar-size': `${pixels}px`,
    '--coin-avatar-accent': asset.accent,
  } as CSSProperties;

  return (
    <span className={`coin-avatar ${className}`.trim()} style={style} data-coin-id={caseId} aria-hidden={decorative || undefined}>
      <img src={asset.src} alt={decorative ? '' : alt ?? asset.alt} width={pixels} height={pixels} loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

export default CoinAvatar;
