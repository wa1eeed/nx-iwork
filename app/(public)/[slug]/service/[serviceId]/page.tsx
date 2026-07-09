import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Clock, CalendarCheck, Tag } from 'lucide-react';
import { db } from '@/lib/db';
import { BookingButton } from '@/components/public/booking-button';
import { OrderButton } from '@/components/public/order-button';
import { SiteHeader, SiteFooter, type SiteNavLink } from '@/components/public/site-chrome';

export const dynamic = 'force-dynamic';

async function load(slug: string, serviceId: string) {
  const company = await db.company.findUnique({
    where: { slug },
    select: { id: true, name: true, logo: true, status: true, settings: { select: { primaryColor: true } } },
  });
  if (!company || company.status === 'SUSPENDED') return null;

  const [service, sitePages] = await Promise.all([
    db.service.findFirst({
      where: { id: serviceId, companyId: company.id, isActive: true },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        price: true,
        priceLabel: true,
        durationMin: true,
        image: true,
        department: { select: { name: true, tagline: true, color: true } },
        availability: { select: { id: true }, take: 1 },
      },
    }),
    db.sitePage.findMany({
      where: { companyId: company.id, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true, slug: true, showInFooter: true, showInNav: true },
    }),
  ]);
  if (!service) return null;
  return { company, service, sitePages };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const data = await load(slug, serviceId);
  if (!data) return { title: 'Not found' };
  return {
    title: `${data.service.title} · ${data.company.name}`,
    description: data.service.subtitle || data.service.description?.slice(0, 150) || undefined,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const data = await load(slug, serviceId);
  if (!data) notFound();
  const { company, service, sitePages } = data;

  const accent = company.settings?.primaryColor || '#0ea5e9';
  const bookable = service.durationMin != null && service.availability.length > 0;

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
        ctaLabel="كل الخدمات"
      />

      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Left: details */}
          <div>
            {service.department && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: service.department.color }} />
                <span className="text-sm font-medium text-muted-foreground">{service.department.name}</span>
              </div>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{service.title}</h1>
            {service.subtitle && (
              <p className="mt-2 text-lg text-muted-foreground">{service.subtitle}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {(service.price != null || service.priceLabel) && (
                <span className="inline-flex items-center gap-1.5 text-xl font-bold" style={{ color: accent }}>
                  <Tag className="size-4" />
                  {service.priceLabel || `${service.price} ر.س`}
                </span>
              )}
              {service.durationMin != null && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-4" /> {service.durationMin} دقيقة
                </span>
              )}
            </div>

            {service.image && (
              <div className="mt-6 overflow-hidden rounded-2xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={service.image} alt={service.title} className="w-full object-cover" />
              </div>
            )}

            {service.description && (
              <div className="mt-6">
                <h2 className="mb-2 text-lg font-semibold">تفاصيل الخدمة</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {service.description}
                </p>
              </div>
            )}
          </div>

          {/* Right: booking panel */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CalendarCheck className="size-5" style={{ color: accent }} />
                <h2 className="text-lg font-semibold">احجز موعدك</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                {bookable
                  ? 'اختر التاريخ والوقت المناسب لك وأكمل الحجز في ثوانٍ.'
                  : 'اطلب هذه الخدمة وسنتواصل معك لتأكيد الموعد.'}
              </p>
              {bookable ? (
                <BookingButton slug={slug} serviceId={service.id} color={accent} />
              ) : (
                <OrderButton slug={slug} serviceId={service.id} label="اطلب الخدمة" color={accent} />
              )}
            </div>
          </div>
        </div>
      </div>

      <SiteFooter companyName={company.name} year={new Date().getFullYear()} links={footerLinks} />
    </div>
  );
}
