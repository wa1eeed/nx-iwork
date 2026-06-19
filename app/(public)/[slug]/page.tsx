import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { ChatWidget } from '@/components/public/chat-widget';

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
  const accent = company.settings?.primaryColor || '#06b6d4';

  const [services, products, widgetAgent] = await Promise.all([
    company.hasServices && wc?.showServices !== false
      ? db.service.findMany({
          where: { companyId: company.id, isActive: true },
          orderBy: { sortOrder: 'asc' },
          take: 12,
          select: { id: true, title: true, description: true, price: true, priceLabel: true },
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
    (async () => {
      const id = wc?.chatAgentId;
      const a = id
        ? await db.agent.findFirst({ where: { id, companyId: company.id }, select: { name: true } })
        : await db.agent.findFirst({
            where: { companyId: company.id, status: { not: 'ARCHIVED' } },
            orderBy: { createdAt: 'asc' },
            select: { name: true },
          });
      return a;
    })(),
  ]);

  const heroTitle = wc?.heroTitle || company.name;
  const heroSubtitle = wc?.heroSubtitle || '';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
          {company.logo && (
            <Image src={company.logo} alt="" width={36} height={36} className="rounded-lg" />
          )}
          <span className="text-lg font-semibold">{company.name}</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{heroTitle}</h1>
          {heroSubtitle && (
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{heroSubtitle}</p>
          )}
        </div>
        <div className="absolute inset-x-0 top-0 -z-10 h-40 opacity-10" style={{ background: accent }} />
      </section>

      {/* About */}
      {wc?.showAbout !== false && wc?.aboutContent && (
        <section className="mx-auto max-w-3xl px-5 py-8">
          {wc.aboutTitle && <h2 className="mb-2 text-xl font-semibold">{wc.aboutTitle}</h2>}
          <p className="whitespace-pre-wrap text-muted-foreground">{wc.aboutContent}</p>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-8">
          <h2 className="mb-4 text-xl font-semibold">خدماتنا</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.id} className="rounded-xl border p-4">
                <h3 className="font-medium">{s.title}</h3>
                {s.description && (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
                )}
                {(s.price || s.priceLabel) && (
                  <p className="mt-2 text-sm font-semibold" style={{ color: accent }}>
                    {s.priceLabel || `${s.price} ر.س`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      {products.length > 0 && (
        <section className="mx-auto max-w-5xl px-5 py-8">
          <h2 className="mb-4 text-xl font-semibold">منتجاتنا</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border">
                <div className="relative aspect-square bg-muted">
                  {p.images[0] && (
                    <Image src={p.images[0]} alt={p.title} fill sizes="200px" className="object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="truncate text-sm font-medium">{p.title}</h3>
                  <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>
                    {p.price.toString()} ر.س
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {wc?.showContact !== false && (wc?.phone || wc?.email || wc?.whatsapp) && (
        <section className="mx-auto max-w-3xl px-5 py-10 text-center">
          <h2 className="mb-4 text-xl font-semibold">تواصل معنا</h2>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {wc.whatsapp && (
              <a href={`https://wa.me/${wc.whatsapp.replace(/\D/g, '')}`} className="inline-flex items-center gap-1 hover:underline">
                <MessageCircle className="h-4 w-4" /> واتساب
              </a>
            )}
            {wc.phone && (
              <a href={`tel:${wc.phone}`} className="inline-flex items-center gap-1 hover:underline" dir="ltr">
                <Phone className="h-4 w-4" /> {wc.phone}
              </a>
            )}
            {wc.email && (
              <a href={`mailto:${wc.email}`} className="inline-flex items-center gap-1 hover:underline" dir="ltr">
                <Mail className="h-4 w-4" /> {wc.email}
              </a>
            )}
          </div>
        </section>
      )}

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {company.name}
      </footer>

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
