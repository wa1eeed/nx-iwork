// Shared public-site chrome — the same sticky header and footer used by the
// storefront landing and every content page (Terms, Instructions…), so a page
// feels like part of the website, not a bare document. Presentational + server-
// safe (no client state); callers build the hrefs so anchors resolve correctly
// whether they're on the landing (#services) or a sub-page (/{slug}#services).

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Mail, MessageCircle, Instagram, Twitter, Linkedin, Music2, Ghost } from 'lucide-react';
import { MobileNav } from './mobile-nav';

export interface SiteNavLink {
  label: string;
  href: string;
}

// Owner-configured social profiles (WebsiteConfig) — previously stored but
// never rendered anywhere on the public site.
export interface SiteSocials {
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
  snapchat?: string | null;
}

const SOCIAL_DEFS: Array<{ key: keyof SiteSocials; icon: typeof Instagram; base: string }> = [
  { key: 'instagram', icon: Instagram, base: 'https://instagram.com/' },
  { key: 'twitter', icon: Twitter, base: 'https://x.com/' },
  { key: 'tiktok', icon: Music2, base: 'https://tiktok.com/@' },
  { key: 'linkedin', icon: Linkedin, base: 'https://linkedin.com/company/' },
  { key: 'snapchat', icon: Ghost, base: 'https://snapchat.com/add/' },
];

// Accepts a full URL or a bare handle (with or without @).
function socialHref(base: string, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}${v.replace(/^@/, '')}`;
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
        <div className="flex items-center gap-2">
          <a
            href={ctaHref}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            {ctaLabel}
          </a>
          <MobileNav links={navLinks} label={ctaLabel} />
        </div>
      </div>
    </header>
  );
}

export interface SiteContact {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
}

export function SiteFooter({
  companyName,
  year,
  links,
  sections,
  contact,
  accent,
  socials,
}: {
  companyName: string;
  year: number;
  links: SiteNavLink[];
  sections?: SiteNavLink[];
  contact?: SiteContact;
  accent?: string;
  socials?: SiteSocials;
}) {
  const socialLinks = SOCIAL_DEFS.filter((d) => socials?.[d.key]);
  const hasContact = contact && (contact.phone || contact.whatsapp || contact.email || contact.address);
  const mapsUrl = contact?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
    : null;
  const rich = (sections && sections.length > 0) || hasContact;

  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-5 py-12">
        {rich && (
          <div className="grid gap-10 sm:grid-cols-2">
            {/* Right (start in RTL): brand + site sections + pages, stacked. */}
            <div>
              <p className="text-lg font-bold">{companyName}</p>
              {sections && sections.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {sections.map((l) =>
                    l.href.includes('#') ? (
                      <li key={l.href}>
                        <a href={l.href} className="hover:text-foreground">{l.label}</a>
                      </li>
                    ) : (
                      <li key={l.href}>
                        <Link href={l.href} className="hover:text-foreground">{l.label}</Link>
                      </li>
                    )
                  )}
                </ul>
              )}
              {links.length > 0 && (
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="hover:text-foreground">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Left (end in RTL): contact + interactive Google Maps button. */}
            {hasContact && (
              <div className="sm:text-end">
                <p className="text-sm font-semibold">تواصل معنا</p>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  {contact?.address && (
                    <li className="flex items-start gap-2 sm:flex-row-reverse">
                      <MapPin className="mt-0.5 size-4 shrink-0" style={{ color: accent }} />
                      <span>{contact.address}</span>
                    </li>
                  )}
                  {contact?.phone && (
                    <li className="flex items-center gap-2 sm:flex-row-reverse" dir="ltr">
                      <Phone className="size-4 shrink-0" style={{ color: accent }} />
                      <a href={`tel:${contact.phone}`} className="hover:text-foreground">{contact.phone}</a>
                    </li>
                  )}
                  {contact?.whatsapp && (
                    <li className="flex items-center gap-2 sm:flex-row-reverse" dir="ltr">
                      <MessageCircle className="size-4 shrink-0" style={{ color: accent }} />
                      <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} className="hover:text-foreground">واتساب</a>
                    </li>
                  )}
                  {contact?.email && (
                    <li className="flex items-center gap-2 sm:flex-row-reverse" dir="ltr">
                      <Mail className="size-4 shrink-0" style={{ color: accent }} />
                      <a href={`mailto:${contact.email}`} className="hover:text-foreground">{contact.email}</a>
                    </li>
                  )}
                </ul>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                    style={{ backgroundColor: accent || '#0ea5e9' }}
                  >
                    <MapPin className="size-4" /> الموقع على الخريطة
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {!rich && links.length > 0 && (
          <nav className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">{l.label}</Link>
            ))}
          </nav>
        )}

        {socialLinks.length > 0 && (
          <div className={`flex justify-center gap-2.5 ${rich ? 'mt-8' : 'mt-2'}`}>
            {socialLinks.map(({ key, icon: Icon, base }) => (
              <a
                key={key}
                href={socialHref(base, socials![key]!)}
                target="_blank"
                rel="noreferrer"
                aria-label={key}
                className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition hover:text-foreground"
                style={{ borderColor: `${accent}40` }}
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        )}

        <p className={`text-xs text-muted-foreground ${rich ? 'mt-6 border-t pt-6' : ''} text-center`}>
          © {year} {companyName}
        </p>
      </div>
    </footer>
  );
}
