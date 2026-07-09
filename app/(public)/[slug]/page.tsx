import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, Mail, MessageCircle, Clock, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/db';
import { ChatWidget } from '@/components/public/chat-widget';
import { OrderButton } from '@/components/public/order-button';
import { BookingButton } from '@/components/public/booking-button';
import { SiteHeader, SiteFooter, type SiteNavLink } from '@/components/public/site-chrome';

export const dynamic = 'force-dynamic';

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
      settings: { select: { primaryColor: true } },
      websiteConfig: true,
    },
  });
  if (!company || company.status === 'SUSPENDED') notFound();

  const wc = company.websiteConfig;
  const accent = company.settings?.primaryColor || '#0ea5e9';

  const showServices = company.hasServices && wc?.showServices !== false;

  const [departments, services, products, staff, widgetAgent, sitePages] = await Promise.all([
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
      const id = wc?.chatAgentId;
      return id
        ? db.agent.findFirst({ where: { id, companyId: company.id }, select: { name: true } })
        : db.agent.findFirst({
            where: { companyId: company.id, status: { not: 'ARCHIVED' } },
            orderBy: { createdAt: 'asc' },
            select: { name: true },
          });
    })(),
    db.sitePage.findMany({
      where: { companyId: company.id, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true, slug: true, showInFooter: true, showInNav: true },
    }),
  ]);

  const heroTitle = wc?.heroTitle || company.name;
  const heroSubtitle = wc?.heroSubtitle || 'احجز خدماتك بسهولة عبر الإنترنت';

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
  const ServiceCard = ({ s }: { s: Svc }) => (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:shadow-md">
      <Link href={`/${slug}/service/${s.id}`} className="block">
        {s.image && (
          <div className="relative aspect-[16/10] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt={s.title} className="h-full w-full object-cover" />
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/${slug}/service/${s.id}`} className="font-semibold hover:underline">
          {s.title}
        </Link>
        {s.description && (
          <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">{s.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: accent }}>
            {s.priceLabel || (s.price != null ? `${s.price} ر.س` : '')}
          </span>
          {s.durationMin != null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> {s.durationMin} د
            </span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {s.durationMin != null && s.availability.length > 0 ? (
            <BookingButton slug={slug} serviceId={s.id} color={accent} />
          ) : (
            <OrderButton slug={slug} serviceId={s.id} label="اطلب الخدمة" color={accent} />
          )}
          <Link
            href={`/${slug}/service/${s.id}`}
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            عرض التفاصيل
          </Link>
        </div>
      </div>
    </div>
  );

  // Owner-authored pages linked from the header nav and/or the footer.
  const navPages = sitePages.filter((p) => p.showInNav);
  const footerPages = sitePages.filter((p) => p.showInFooter);
  const headerNav: SiteNavLink[] = [
    ...(clinicSections.length > 0 ? [{ label: 'خدماتنا', href: '#services' }] : []),
    ...(staff.length > 0 ? [{ label: 'فريقنا', href: '#team' }] : []),
    ...(wc?.phone || wc?.email || wc?.whatsapp ? [{ label: 'تواصل', href: '#contact' }] : []),
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
        ctaHref="#services"
        ctaLabel="احجز موعد"
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
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
        <div className="mx-auto max-w-6xl px-5 py-24 text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <CalendarCheck className="size-3.5" style={{ color: accent }} /> احجز موعدك أونلاين خلال دقيقة
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">{heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#services"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <CalendarCheck className="size-4" /> احجز موعدك الآن
            </a>
            {(wc?.phone || wc?.whatsapp) && (
              <a
                href={wc?.whatsapp ? `https://wa.me/${wc.whatsapp.replace(/\D/g, '')}` : `tel:${wc?.phone}`}
                className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-accent"
              >
                <MessageCircle className="size-4" /> تواصل معنا
              </a>
            )}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" style={{ color: accent }} /> تأكيد فوري للحجز</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" style={{ color: accent }} /> مواعيد مرنة تناسبك</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5" style={{ color: accent }} /> دعم مباشر عبر الشات</span>
          </div>
        </div>
      </section>

      {/* About */}
      {wc?.showAbout !== false && wc?.aboutContent && (
        <section className="mx-auto max-w-3xl px-5 py-12 text-center">
          {wc.aboutTitle && <h2 className="mb-3 text-2xl font-bold">{wc.aboutTitle}</h2>}
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{wc.aboutContent}</p>
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
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <ServiceCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          ))}

          {ungrouped.length > 0 && (
            <section>
              <h2 className="mb-6 text-2xl font-bold">خدماتنا</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {ungrouped.map((s) => (
                  <ServiceCard key={s.id} s={s} />
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
            <h2 className="mb-8 text-center text-2xl font-bold">فريقنا</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {staff.map((m) => (
                <Link
                  key={m.id}
                  href={`/${slug}/team/${m.id}`}
                  className="group rounded-2xl border bg-card p-5 text-center transition hover:shadow-md"
                >
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.image}
                      alt={m.name}
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
          <h2 className="mb-6 text-2xl font-bold">منتجاتنا</h2>
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
                    {p.price.toString()} ر.س
                  </p>
                  <OrderButton slug={slug} productId={p.id} label="اطلب الآن" color={accent} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {wc?.showContact !== false && (wc?.phone || wc?.email || wc?.whatsapp) && (
        <section id="contact" className="border-t py-14 text-center">
          <div className="mx-auto max-w-3xl px-5">
            <h2 className="mb-5 text-2xl font-bold">تواصل معنا</h2>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              {wc.whatsapp && (
                <a
                  href={`https://wa.me/${wc.whatsapp.replace(/\D/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 transition hover:bg-accent"
                >
                  <MessageCircle className="h-4 w-4" /> واتساب
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

      <SiteFooter companyName={company.name} year={new Date().getFullYear()} links={footerLinks} />

      {/* Chat widget */}
      {wc?.chatEnabled !== false && widgetAgent && (
        <ChatWidget
          slug={slug}
          agentName={widgetAgent.name}
          greeting={wc?.chatGreeting || `مرحباً 👋 كيف أقدر أساعدك في ${company.name}؟`}
          primaryColor={wc?.chatPrimaryColor || accent}
        />
      )}
    </div>
  );
}
