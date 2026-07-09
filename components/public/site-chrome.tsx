// Shared public-site chrome — the same sticky header and footer used by the
// storefront landing and every content page (Terms, Instructions…), so a page
// feels like part of the website, not a bare document. Presentational + server-
// safe (no client state); callers build the hrefs so anchors resolve correctly
// whether they're on the landing (#services) or a sub-page (/{slug}#services).

import Link from 'next/link';
import Image from 'next/image';

export interface SiteNavLink {
  label: string;
  href: string;
}

export function SiteHeader({
  slug,
  companyName,
  logo,
  accent,
  navLinks,
  ctaHref,
  ctaLabel,
}: {
  slug: string;
  companyName: string;
  logo: string | null;
  accent: string;
  navLinks: SiteNavLink[];
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <Link href={`/${slug}`} className="flex items-center gap-2.5">
          {logo && <Image src={logo} alt="" width={34} height={34} className="rounded-lg" />}
          <span className="text-lg font-bold tracking-tight">{companyName}</span>
        </Link>
        {navLinks.length > 0 && (
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            {navLinks.map((l) =>
              l.href.startsWith('#') || l.href.includes('#') ? (
                <a key={l.href} href={l.href} className="hover:text-foreground">
                  {l.label}
                </a>
              ) : (
                <Link key={l.href} href={l.href} className="hover:text-foreground">
                  {l.label}
                </Link>
              )
            )}
          </nav>
        )}
        <a
          href={ctaHref}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          {ctaLabel}
        </a>
      </div>
    </header>
  );
}

export function SiteFooter({
  companyName,
  year,
  links,
}: {
  companyName: string;
  year: number;
  links: SiteNavLink[];
}) {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-5 py-10">
        {links.length > 0 && (
          <nav className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <p className="text-center text-xs text-muted-foreground">
          © {year} {companyName}
        </p>
      </div>
    </footer>
  );
}
