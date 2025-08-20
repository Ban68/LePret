import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SectionProps = ComponentPropsWithoutRef<'section'>;

export function Section({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn('container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', className)}
      {...props}
    />
  );
}
