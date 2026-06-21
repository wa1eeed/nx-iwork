'use client';

import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu({ name, email, isSuperAdmin }: { name: string; email: string; isSuperAdmin?: boolean }) {
  const t = useTranslations('common');
  const ta = useTranslations('admin');
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={name || 'User menu'}>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isSuperAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck className="me-2 size-4" />
              {ta('panel')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/' })}>
          <LogOut className="me-2 size-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
