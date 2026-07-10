import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import { db } from '@/lib/db';
import { SiteHeader, SiteFooter, type SiteNavLink } from '@/components/public/site-chrome';

export const dynamic = 'force-dynamic';

async function load(slug: string, pageSlug: string) {
  const company = await db.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      status: true,
      settings: { select: { primaryColor: true } },
    },
  });
  if (!company || company.status === 'SUSPENDED') return null;

  const [page, sitePages] = await Promise.all([
    db.sitePage.findFirst({
      where: { companyId: company.id, slug: pageSlug, isPublished: true },
      select: { title: true, content: true },
    }),
    db.sitePage.findMany({
      where: { companyId: company.id, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true, slug: true, showInFooter: true, showInNav: true },
    }),
  ]);
  if (!page) return null;
  return { company, page, sitePages };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const data = await load(slug, pageSlug);
  if (!data) return { title: 'Not found' };
  return { title: `${data.page.title} · ${data.company.name}` };
}

export default async function SiteContentPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const data = await load(slug, pageSlug);
  if (!data) notFound();
  const { company, page, sitePages } = data;
  const accent = company.settings?.primaryColor || '#0ea5e9';

  const navPages = sitePages.filter((p) => p.showInNav);
  const footerPages = sitePages.filter((p) => p.showInFooter);
  const headerNav: SiteNavLink[] = [
    { label: 'الرئيسية', href: `/${slug}` },
    { label: 'خدماتنا', href: `/${slug}#services` },
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

      <article className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight">{page.title}</h1>
        <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pe-5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pe-5">
          <ReactMarkdown>{page.content}</ReactMarkdown>
        </div>
      </article>

      <SiteFooter companyName={company.name} year={new Date().getFullYear()} links={footerLinks} />
    </div>
  );
}
