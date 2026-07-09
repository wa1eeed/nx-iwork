import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, CalendarCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { BookingButton } from '@/components/public/booking-button';
import { OrderButton } from '@/components/public/order-button';

export const dynamic = 'force-dynamic';

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;

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
  if (!company || company.status === 'SUSPENDED') notFound();

  const service = await db.service.findFirst({
    where: { id: serviceId, companyId: company.id, isActive: true },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      priceLabel: true,
      durationMin: true,
      image: true,
      department: { select: { name: true, tagline: true, color: true } },
      availability: { select: { id: true }, take: 1 },
    },
  });
  if (!service) notFound();

  const accent = company.settings?.primaryColor || '#0ea5e9';
  const bookable = service.durationMin != null && service.availability.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link href={`/${slug}`} className="flex items-center gap-2.5">
            {company.logo && (
              <Image src={company.logo} alt="" width={32} height={32} className="rounded-lg" />
            )}
            <span className="text-lg font-bold tracking-tight">{company.name}</span>
          </Link>
          <Link
            href={`/${slug}#services`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-4 rtl:rotate-180" /> كل الخدمات
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Left: details */}
          <div>
            {service.department && (
              <div className="mb-3 inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: service.department.color }}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  {service.department.name}
                </span>
              </div>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight">{service.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {(service.price != null || service.priceLabel) && (
                <span className="text-xl font-bold" style={{ color: accent }}>
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

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {company.name}
      </footer>
    </div>
  );
}
