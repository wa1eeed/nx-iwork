import { cn } from '@/lib/utils';

// Minimal loading placeholder — a muted, pulsing block. Compose several to
// sketch a page's layout while its data streams in.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
