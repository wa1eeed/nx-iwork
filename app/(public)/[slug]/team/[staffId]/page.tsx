import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarCheck, Mail, Phone } from 'lucide-react';
import { db } from '@/lib/db';
import { SiteHeader, SiteFooter, type SiteNavLink } from '@/components/public/site-chrome';

export const dynamic = 'force-dynamic';

async function load(slug: string, staffId: string) {
  const company = await db.company.findUnique({
    where: { slug },
    select: { id: true, name: true, logo: true, status: true, settings: { select: { primaryColor: true } } },
  });
  if (!company || company.status === 'SUSPENDED') return null;

  const [member, sitePages] = await Promise.all([
    db.staffMember.findFirst({
      where: { id: staffId, companyId: company.id, isActive: true },
      select: { id: true, name: true, role: true, bio: true, image: true, phone: true, email: true },
    }),
    db.sitePage.findMany({
      where: { companyId: company.id, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true, slug: true, showInFooter: true, showInNav: true },
    }),
  ]);
  if (!member) return null;
  return { company, member, sitePages };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; staffId: string }>;
}): Promise<Metadata> {
  const { slug, staffId } = await params;
  const data = await load(slug, staffId);
  if (!data) return { title: 'Not found' };
  return { title: `${data.member.name} · ${data.company.name}` };
}

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ slug: string; staffId: string }>;
}) {
  const { slug, staffId } = await params;
  const data = await load(slug, staffId);
  if (!data) notFound();
  const { company, member, sitePages } = data;
  const accent = company.settings?.primaryColor || '#0ea5e9';

  const navPages = sitePages.filter((p) => p.showInNav);
  const footerPages = sitePages.filter((p) => p.showInFooter);
  const headerNav: SiteNavLink[] = [
    { label: 'الرئيسية', href: `/${slug}` },
    { label: 'فريقنا', href: `/${slug}#team` },
    ...navPages.map((p) => ({ label: p.title, href: `/${slug}/p/${p.slug}` })),
  ];
  const footerLinks: SiteNavLink[] = footerPages.map((p) => ({
    label: p.title,
    href: `/${slug}/p/${p.slug}`,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <SiteHeader
        slug={slug}
        companyName={company.name}
        logo={company.logo}
        accent={accent}
        navLinks={headerNav}
        ctaHref={`/${slug}#services`}
        ctaLabel="احجز موعد"
      />

      <div className="mx-auto max-w-3xl px-5 py-12">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-start">
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.image}
              alt={member.name}
              className="size-32 shrink-0 rounded-2xl border object-cover"
            />
          ) : (
            <div
              className="flex size-32 shrink-0 items-center justify-center rounded-2xl text-4xl font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {member.name.trim()[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{member.name}</h1>
            {member.role && <p className="mt-1 text-lg text-muted-foreground">{member.role}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <a
                href={`/${slug}#services`}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow"
                style={{ backgroundColor: accent }}
              >
                <CalendarCheck className="size-4" /> احجز موعداً
              </a>
              {member.phone && (
                <a
                  href={`tel:${member.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm transition hover:bg-accent"
                  dir="ltr"
                >
                  <Phone className="size-4" /> {member.phone}
                </a>
              )}
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm transition hover:bg-accent"
                  dir="ltr"
                >
                  <Mail className="size-4" /> {member.email}
                </a>
              )}
            </div>
          </div>
        </div>

        {member.bio && (
          <div className="mt-8 border-t pt-8">
            <h2 className="mb-2 text-lg font-semibold">نبذة</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{member.bio}</p>
          </div>
        )}
      </div>

      <SiteFooter companyName={company.name} year={new Date().getFullYear()} links={footerLinks} />
    </div>
  );
}
