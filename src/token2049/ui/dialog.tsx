import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils.js';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>,React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({className,children,...props},ref)=><DialogPrimitive.Portal><DialogPrimitive.Overlay className="lb-overlay"/><DialogPrimitive.Content ref={ref} className={cn('lb-app lb-modal',className)} {...props}>{children}<DialogPrimitive.Close className="lb-modal-close" aria-label="Close"><X size={19}/></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>);
DialogContent.displayName='DialogContent';
export function DialogHeader({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('lb-modal-header',className)} {...props}/>;}
export const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>,React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({className,...props},ref)=><DialogPrimitive.Title ref={ref} className={cn('lb-modal-title',className)} {...props}/>);
DialogTitle.displayName='DialogTitle';
export const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>,React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({className,...props},ref)=><DialogPrimitive.Description ref={ref} className={cn('lb-modal-description',className)} {...props}/>);
DialogDescription.displayName='DialogDescription';
