import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

// shadcn/ui Button composition, themed and scoped for the new public experience.
export const buttonVariants = cva('lb-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0', {
  variants: {
    variant: {
      default: 'lb-button-primary bg-primary text-primary-foreground hover:bg-primary/90',
      outline: 'lb-button-outline border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      ghost: 'lb-button-ghost hover:bg-accent hover:text-accent-foreground',
      secondary: 'lb-button-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80',
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-8 rounded-md px-3 text-xs', icon: 'h-10 w-10 p-0' },
  }, defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({className, variant, size, asChild=false, ...props},ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp type={asChild ? undefined : 'button'} className={cn(buttonVariants({variant,size,className}))} ref={ref} {...props}/>;
});
Button.displayName = 'Button';
