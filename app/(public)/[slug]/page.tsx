import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Mail, MessageCircle, Clock, CalendarCheck, CheckCircle2, Sparkles, Star, Eye } from 'lucide-react';
import { db } from '@/lib/db';
import { ChatWidget } from '@/components/public/chat-widget';
import { ReviewsSection } from '@/components/public/reviews-section';
import { OrderButton } from '@/components/public/order-button';
import { BookingButton } from '@/components/public/booking-button';
import { StickyBookBar } from '@/components/public/sticky-book-bar';
import { SiteHeader, SiteFooter, type SiteNavLink } from '@/components/public/site-chrome';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bznss.one';

// Every tenant storefront ships with real SEO: title/description/OG from the
// owner's WebsiteConfig (metaTitle/metaDescription/ogImage existed unused).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await db.company.findUnique({
    where: { slug },
    select: {
      name: true,
      logo: true,
      status: true,
      settings: { select: { primaryLanguage: true } },
      websiteConfig: {
        select: { metaTitle: true, metaDescription: true, ogImage: true, heroSubtitle: true, heroSubtitleEn: true },
      },
    },
  });
  if (!company || company.status === 'SUSPENDED') return {};
  const ar = (company.settings?.primaryLanguage ?? 'ar') === 'ar';
  const wc = company.websiteConfig;
  const title = wc?.metaTitle || company.name;
  const description =
    wc?.metaDescription ||
    (ar ? wc?.heroSubtitle : wc?.heroSubtitleEn) ||
    wc?.heroSubtitle ||
    (ar ? `احجز خدمات ${company.name} أونلاين` : `Book ${company.name} services online`);
  const image = wc?.ogImage || company.logo || undefined;
  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${slug}`,
      siteName: company.name,
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  };
}

export default async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const company = await db.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      status: true,
      hasEcommerce: true,
      hasServices: true,
      settings: { select: { primaryColor: true, primaryLanguage: true } },
      websiteConfig: true,
    },
  });
  if (!company || company.status === 'SUSPENDED') notFound();

  const wc = company.websiteConfig;
  const accent = company.settings?.primaryColor || '#0ea5e9';
  // The storefront renders in the BUSINESS's language, not the visitor's — it's
  // the shop's own front. Drives direction + chrome copy.
  const ar = (company.settings?.primaryLanguage ?? 'ar') === 'ar';

  const showServices = company.hasServices && wc?.showServices !== false;

  const [departments, services, products, staff, widgetAgent, sitePages, reviews, reviewAgg] = await Promise.all([
    showServices
      ? db.department.findMany({
          where: { companyId: company.id, landingVisible: true },
          orderBy: [{ landingOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, name: true, tagline: true, color: true },
        })
      : [],
    showServices
      ? db.service.findMany({
          where: { companyId: company.id, isActive: true },
          orderBy: { sortOrder: 'asc' },
          take: 60,
          select: {
            id: true,
            title: true,
            subtitle: true,
            description: true,
            price: true,
            priceLabel: true,
            durationMin: true,
            departmentId: true,
            image: true,
            availability: { select: { id: true }, take: 1 },
          },
        })
      : [],
    company.hasEcommerce && wc?.showProducts !== false
      ? db.product.findMany({
          where: { companyId: company.id, isActive: true },
          orderBy: { sortOrder: 'asc' },
          take: 12,
          select: { id: true, title: true, price: true, images: true },
        })
      : [],
    db.staffMember.findMany({
      where: { companyId: company.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 8,
      select: { id: true, name: true, role: true, image: true, bio: true },
    }),
    (async () => {
      // The widget agent must be customer-facing: use the designated one only if
      // it still faces customers, otherwise fall back to the first that does.
      const id = wc?.chatAgentId;
      if (id) {
        const designated = await db.agent.findFirst({
          where: { id, companyId: company.id, surface: 'CUSTOMER_FACING' },
          select: { name: true },
        });
        if (designated) return designated;
      }
      return db.agent.findFirst({
        where: { companyId: company.id, status: { not: 'ARCHIVED' }, surface: 'CUSTOMER_FACING' },
        orderBy: { createdAt: 'asc' },
        select: { name: true },
      });
    })(),
    db.sitePage.findMany({
      where: { companyId: company.id, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true, slug: true, showInFooter: true, showInNav: true },
    }),
    db.review.findMany({
      where: { companyId: company.id, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, authorName: true, rating: true, comment: true, createdAt: true },
    }),
    db.review.aggregate({
      where: { companyId: company.id, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const heroTitle = (ar ? wc?.heroTitle : wc?.heroTitleEn) || wc?.heroTitle || company.name;
  const heroSubtitle =
    (ar ? wc?.heroSubtitle : wc?.heroSubtitleEn) ||
    wc?.heroSubtitle ||
    (ar ? 'احجز خدماتك بسهولة عبر الإنترنت' : 'Book our services easily online');
  // Owner-configured CTA label (heroCTA/heroCTAEn existed but were ignored).
  const heroCta = (ar ? wc?.heroCTA : wc?.heroCTAEn) || wc?.heroCTA || (ar ? 'احجز موعدك الآن' : 'Book now');
  // Hero media — heroImages/heroVideo columns were stored but never rendered.
  const heroMedia =
    wc?.heroType === 'VIDEO' && wc.heroVideo
      ? ({ kind: 'video', src: wc.heroVideo } as const)
      : wc?.heroImages?.[0]
        ? ({ kind: 'image', src: wc.heroImages[0] } as const)
        : null;
  const avgRating = reviewAgg._avg.rating ?? 0;

  // SEO: LocalBusiness structured data (+ rating when reviews exist) so tenant
  // storefronts are eligible for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: company.name,
    url: `${SITE_URL}/${slug}`,
    ...(wc?.ogImage || company.logo ? { image: wc?.ogImage || company.logo } : {}),
    ...(wc?.phone ? { telephone: wc.phone } : {}),
    ...(wc?.address ? { address: wc.address } : {}),
    ...(reviewAgg._count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(avgRating.toFixed(1)),
            reviewCount: reviewAgg._count,
          },
        }
      : {}),
  };

  // Group services under their clinic/department; the rest go to a general block.
  type Svc = (typeof services)[number];
  const deptIds = new Set(departments.map((d) => d.id));
  const byDept = new Map<string, Svc[]>();
  const ungrouped: Svc[] = [];
  for (const s of services) {
    if (s.departmentId && deptIds.has(s.departmentId)) {
      const list = byDept.get(s.departmentId);
      if (list) list.push(s);
      else byDept.set(s.departmentId, [s]);
    } else {
      ungrouped.push(s);
    }
  }
  const clinicSections = departments
    .map((d) => ({ dept: d, items: byDept.get(d.id) ?? [] }))
    .filter((c) => c.items.length > 0);
  const ServiceCard = ({ s, coverColor }: { s: Svc; coverColor: string }) => (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition hover:shadow-md">
      <Link href={`/${slug}/service/${s.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          {s.image ? (
            <Image
              src={s.image}
              alt={s.title}
              fill
              sizes="300px"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${coverColor}26, ${coverColor}70)` }}
            >
              <Sparkles className="size-8 text-white/80" />
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/${slug}/service/${s.id}`} className="font-semibold hover:underline">
          {s.title}
        </Link>
        {s.subtitle ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.subtitle}</p>
        ) : s.description ? (
          <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: accent }}>
            {s.priceLabel || (s.price != null ? `${s.price} ${ar ? 'ر.س' : 'SAR'}` : '')}
          </span>
          {s.durationMin != null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> {s.durationMin} {ar ? 'د' : 'min'}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-stretch gap-2">
          <Link
            href={`/${slug}/service/${s.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition hover:bg-muted"
          >
            <Eye className="size-4" />
            {ar ? 'التفاصيل' : 'Details'}
          </Link>
          <div className="flex-1">
            {s.durationMin != null && s.availability.length > 0 ? (
              <BookingButton slug={slug} serviceId={s.id} color={accent} label={ar ? 'حجز سريع' : 'Quick book'} compact />
            ) : (
              <OrderButton slug={slug} serviceId={s.id} color={accent} />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Owner-authored pages linked from the header nav and/or the footer.
  const navPages = sitePages.filter((p) => p.showInNav);
  const footerPages = sitePages.filter((p) => p.showInFooter);
  const headerNav: SiteNavLink[] = [
    ...(clinicSections.length > 0 ? [{ label: ar ? 'خدماتنا' : 'Services', href: '#services' }] : []),
    ...(staff.length > 0 ? [{ label: ar ? 'فريقنا' : 'Our team', href: '#team' }] : []),
    ...(wc?.phone || wc?.email || wc?.whatsapp ? [{ label: ar ? 'تواصل' : 'Contact', href: '#contact' }] : []),
    ...navPages.map((p) => ({ label: p.title, href: `/${slug}/p/${p.slug}` })),
  ];
  const footerLinks: SiteNavLink[] = footerPages.map((p) => ({
    label: p.title,
    href: `/${slug}/p/${p.slug}`,
  }));

  // With hero media behind the text, everything flips to light-on-dark.
  const onMedia = Boolean(heroMedia);
  const heroMuted = onMedia ? 'text-white/85' : 'text-muted-foreground';
  const chipAccent = onMedia ? '#ffffff' : accent;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={ar ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader
        slug={slug}
        companyName={company.name}
        logo={company.logo}
        accent={accent}
        navLinks={headerNav}
        ctaHref="#services"
        ctaLabel={ar ? 'احجز موعد' : 'Book now'}
      />

      {/* Hero — with the owner's image/video when configured, gradient otherwise */}
      <section className={`relative overflow-hidden border-b ${onMedia ? 'text-white' : ''}`}>
        {heroMedia ? (
          <>
            {heroMedia.kind === 'video' ? (
              <video
                className="absolute inset-0 -z-20 h-full w-full object-cover"
                src={heroMedia.src}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <Image
                src={heroMedia.src}
                alt=""
                fill
                priority
                sizes="100vw"
                className="-z-20 object-cover"
              />
            )}
            {/* Contrast overlay + accent glow */}
            <div className="absolute inset-0 -z-10 bg-black/55" />
            <div
              className="absolute inset-0 -z-10 opacity-30"
              style={{ background: `radial-gradient(60% 80% at 50% 100%, ${accent}, transparent)` }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 -z-10 opacity-[0.14]"
              style={{ background: `radial-gradient(55% 75% at 70% 0%, ${accent}, transparent)` }}
            />
            <div
              className="absolute inset-0 -z-10 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                backgroundSize: '44px 44px',
              }}
            />
          </>
        )}
        <div className="mx-auto max-w-6xl px-5 py-24 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur ${onMedia ? 'border-white/25 bg-white/10 text-white/90' : 'bg-background/60 text-muted-foreground'}`}
            >
              <CalendarCheck className="size-3.5" style={{ color: chipAccent }} /> {ar ? 'احجز موعدك أونلاين خلال دقيقة' : 'Book online in under a minute'}
            </span>
            {reviewAgg._count > 0 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur ${onMedia ? 'border-white/25 bg-white/10 text-white/90' : 'bg-background/60'}`}
              >
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {avgRating.toFixed(1)}
                <span className={`font-normal ${heroMuted}`}>
                  ({reviewAgg._count} {ar ? 'تقييم' : 'reviews'})
                </span>
              </span>
            )}
          </div>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">{heroTitle}</h1>
          <p className={`mx-auto mt-4 max-w-2xl text-lg ${heroMuted}`}>{heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#services"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <CalendarCheck className="size-4" /> {heroCta}
            </a>
            {(wc?.phone || wc?.whatsapp) && (
              <a
                href={wc?.whatsapp ? `https://wa.me/${wc.whatsapp.replace(/\D/g, '')}` : `tel:${wc?.phone}`}
                className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold backdrop-blur transition ${onMedia ? 'border-white/30 bg-white/10 text-white hover:bg-white/20' : 'bg-background/60 hover:bg-accent'}`}
              >
                <MessageCircle className="size-4" /> {ar ? 'تواصل معنا' : 'Contact us'}
              </a>
            )}
          </div>
          <div className={`mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs ${heroMuted}`}>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" style={{ color: chipAccent }} /> {ar ? 'تأكيد فوري للحجز' : 'Instant booking confirmation'}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" style={{ color: chipAccent }} /> {ar ? 'مواعيد مرنة تناسبك' : 'Flexible times that suit you'}</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5" style={{ color: chipAccent }} /> {ar ? 'دعم مباشر عبر الشات' : 'Live chat support'}</span>
          </div>
        </div>
      </section>

      {/* About — honors the English fields on an English storefront */}
      {wc?.showAbout !== false && (wc?.aboutContent || wc?.aboutContentEn) && (
        <section className="mx-auto max-w-3xl px-5 py-12 text-center">
          {(ar ? wc?.aboutTitle : wc?.aboutTitleEn || wc?.aboutTitle) && (
            <h2 className="mb-3 text-2xl font-bold">{ar ? wc?.aboutTitle : wc?.aboutTitleEn || wc?.aboutTitle}</h2>
          )}
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {(ar ? wc?.aboutContent : wc?.aboutContentEn || wc?.aboutContent) ?? ''}
          </p>
        </section>
      )}

      {/* Clinics / service sections */}
      {(clinicSections.length > 0 || ungrouped.length > 0) && (
        <div id="services" className="mx-auto max-w-6xl space-y-16 px-5 py-14">
          {clinicSections.map(({ dept, items }) => (
            <section key={dept.id} id={`clinic-${dept.id}`}>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: dept.color }} />
                <div>
                  <h2 className="text-2xl font-bold">{dept.name}</h2>
                  {dept.tagline && <p className="text-sm text-muted-foreground">{dept.tagline}</p>}
                </div>
              </div>
              <div className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 [scrollbar-width:thin]">
                {items.map((s) => (
                  <div key={s.id} className="w-[270px] shrink-0 snap-start sm:w-[300px]">
                    <ServiceCard s={s} coverColor={dept.color} />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {ungrouped.length > 0 && (
            <section>
              <h2 className="mb-6 text-2xl font-bold">{ar ? 'خدماتنا' : 'Our services'}</h2>
              <div className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-4 [scrollbar-width:thin]">
                {ungrouped.map((s) => (
                  <div key={s.id} className="w-[270px] shrink-0 snap-start sm:w-[300px]">
                    <ServiceCard s={s} coverColor={accent} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Team */}
      {staff.length > 0 && (
        <section id="team" className="border-t bg-muted/30 py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="mb-8 text-center text-2xl font-bold">{ar ? 'فريقنا' : 'Our team'}</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {staff.map((m) => (
                <Link
                  key={m.id}
                  href={`/${slug}/team/${m.id}`}
                  className="group rounded-2xl border bg-card p-5 text-center transition hover:shadow-md"
                >
                  {m.image ? (
                    <Image
                      src={m.image}
                      alt={m.name}
                      width={80}
                      height={80}
                      className="mx-auto size-20 rounded-full border object-cover"
                    />
                  ) : (
                    <div
                      className="mx-auto flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {m.name.trim()[0]}
                    </div>
                  )}
                  <p className="mt-3 font-semibold group-hover:underline">{m.name}</p>
                  {m.role && <p className="text-xs text-muted-foreground">{m.role}</p>}
                  {m.bio && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products */}
      {products.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="mb-6 text-2xl font-bold">{ar ? 'منتجاتنا' : 'Our products'}</h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="relative aspect-square bg-muted">
                  {p.images[0] && (
                    <Image src={p.images[0]} alt={p.title} fill sizes="220px" className="object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate text-sm font-medium">{p.title}</h3>
                  <p className="mt-1 text-sm font-bold" style={{ color: accent }}>
                    {p.price.toString()} {ar ? 'ر.س' : 'SAR'}
                  </p>
                  <OrderButton slug={slug} productId={p.id} color={accent} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews — always shown so the first customer can leave one. */}
      <div className="border-t">
        <ReviewsSection
          slug={slug}
          reviews={reviews.map((r) => ({
            id: r.id,
            authorName: r.authorName,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt.toISOString(),
          }))}
          average={reviewAgg._avg.rating ?? 0}
          count={reviewAgg._count}
          color={accent}
        />
      </div>

      {/* Contact */}
      {wc?.showContact !== false && (wc?.phone || wc?.email || wc?.whatsapp) && (
        <section id="contact" className="border-t py-14 text-center">
          <div className="mx-auto max-w-3xl px-5">
            <h2 className="mb-5 text-2xl font-bold">{ar ? 'تواصل معنا' : 'Get in touch'}</h2>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              {wc.whatsapp && (
                <a
                  href={`https://wa.me/${wc.whatsapp.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 transition hover:bg-accent"
                >
                  <MessageCircle className="h-4 w-4" /> {ar ? 'واتساب' : 'WhatsApp'}
                </a>
              )}
              {wc.phone && (
                <a
                  href={`tel:${wc.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 transition hover:bg-accent"
                  dir="ltr"
                >
                  <Phone className="h-4 w-4" /> {wc.phone}
                </a>
              )}
              {wc.email && (
                <a
                  href={`mailto:${wc.email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 transition hover:bg-accent"
                  dir="ltr"
                >
                  <Mail className="h-4 w-4" /> {wc.email}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      <SiteFooter
        companyName={company.name}
        year={new Date().getFullYear()}
        links={footerLinks}
        sections={headerNav}
        contact={{ phone: wc?.phone, whatsapp: wc?.whatsapp, email: wc?.email, address: wc?.address }}
        accent={accent}
        socials={{
          instagram: wc?.instagram,
          twitter: wc?.twitter,
          tiktok: wc?.tiktok,
          linkedin: wc?.linkedin,
          snapchat: wc?.snapchat,
        }}
      />

      {/* Mobile: the primary booking CTA stays reachable after the hero scrolls away */}
      {(clinicSections.length > 0 || ungrouped.length > 0) && (
        <StickyBookBar label={heroCta} whatsapp={wc?.whatsapp} accent={accent} />
      )}

      {/* Chat widget */}
      {wc?.chatEnabled !== false && widgetAgent && (
        <ChatWidget
          slug={slug}
          agentName={widgetAgent.name}
          greeting={wc?.chatGreeting || (ar ? `مرحباً 👋 كيف أقدر أساعدك في ${company.name}؟` : `Hi 👋 How can we help you at ${company.name}?`)}
          primaryColor={wc?.chatPrimaryColor || accent}
          position={wc?.chatPosition}
        />
      )}
    </div>
  );
}
