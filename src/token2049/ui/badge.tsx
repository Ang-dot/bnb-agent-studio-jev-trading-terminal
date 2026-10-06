import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';
export function Badge({className, variant='secondary', ...props}: HTMLAttributes<HTMLSpanElement>&{variant?:'default'|'secondary'|'outline'}) {
  return <span className={cn('lb-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', `lb-badge-${variant}`, className)} {...props}/>;
}
