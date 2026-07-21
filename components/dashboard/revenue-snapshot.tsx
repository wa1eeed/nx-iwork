import Link from 'next/link';
import { CircleDollarSign, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';

// IBP-style "revenue summary" panel for the Command Center right rail: a 30-day
// daily-revenue sparkline + an income-statement-style breakdown by order type and
// VAT. Everything is REAL, tenant-scoped, computed from completed orders — no
// fabricated expense lines (the platform doesn't track those yet).
export async function RevenueSnapshot({
  companyId,
  locale,
}: {
  companyId: string;
  locale: string;
}) {
  const ar = locale !== 'en';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const from30 = new Date(now.getTime() - 29 * 86_400_000);
  const dayStart = new Date(from30.getFullYear(), from30.getMonth(), from30.getDate());

  const [byType, recent] = await Promise.all([
    db.order.groupBy({
      by: ['type'],
      where: { companyId, status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { subtotal: true, vat: true, total: true },
    }),
    db.order.findMany({
      where: { companyId, status: 'COMPLETED', createdAt: { gte: dayStart } },
      select: { total: true, createdAt: true },
    }),
  ]);

  const sumType = (t: 'SERVICE' | 'PRODUCT') => {
    const r = byType.find((x) => x.type === t);
    return {
      sub: Number(r?._sum.subtotal ?? 0),
      vat: Number(r?._sum.vat ?? 0),
      total: Number(r?._sum.total ?? 0),
    };
  };
  const svc = sumType('SERVICE');
  const prod = sumType('PRODUCT');
  const subTotal = svc.sub + prod.sub;
  const vat = svc.vat + prod.vat;
  const grand = svc.total + prod.total;

  // Daily buckets for the 30-day sparkline.
  const days = 30;
  const buckets = new Array(days).fill(0);
  for (const o of recent) {
    const i = Math.floor((o.createdAt.getTime() - dayStart.getTime()) / 86_400_000);
    if (i >= 0 && i < days) buckets[i] += Number(o.total);
  }
  const monthTotal = grand;

  const sar = (n: number) => `${Math.round(n).toLocaleString('en')} ${ar ? 'ر.س' : 'SAR'}`;

  // Inline SVG sparkline (area + line), computed server-side.
  const W = 300;
  const H = 56;
  const pad = 3;
  const max = Math.max(...buckets, 1);
  const min = Math.min(...buckets, 0);
  const span = max - min || 1;
  const pts = buckets.map((v, i) => {
    const x = pad + (i * (W - 2 * pad)) / (days - 1);
    const y = H - 3 - ((v - min) / span) * (H - 10);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `M${pts[0][0].toFixed(1)} ${H} ${pts
    .map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')} L${pts[pts.length - 1][0].toFixed(1)} ${H} Z`;

  const Row = ({ k, v, tone }: { k: string; v: string; tone?: 'sum' | 'vat' | 'net' }) => (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-2 text-[13px] ${
        tone === 'sum'
          ? 'bg-muted/40'
          : tone === 'net'
            ? 'bg-primary/10'
            : ''
      } ${tone !== 'net' ? 'border-b border-border/60' : ''}`}
    >
      <span className={tone === 'net' ? 'font-bold text-primary' : tone === 'sum' ? 'font-semibold' : 'text-muted-foreground'}>
        {k}
      </span>
      <span className={`tabular-nums ${tone === 'net' ? 'text-base font-extrabold text-primary' : 'font-bold'}`}>{v}</span>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          <CircleDollarSign className="size-4 text-muted-foreground" />
          {ar ? 'ملخّص الإيراد — هذا الشهر' : 'Revenue summary — this month'}
        </h2>
        <Link href="/sales" className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground">
          {ar ? 'التقارير' : 'Reports'} <ArrowRight className="size-3 rtl:rotate-180" />
        </Link>
      </div>

      {/* Sparkline + headline */}
      <div className="px-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-extrabold tracking-tight tabular-nums">
            {Math.round(monthTotal).toLocaleString('en')}
            <span className="ms-1 text-sm font-semibold text-muted-foreground">{ar ? 'ر.س' : 'SAR'}</span>
          </span>
          <span className="text-[11px] text-muted-foreground">{ar ? 'آخر ٣٠ يوماً' : 'last 30 days'}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1.5 h-14 w-full text-primary" aria-hidden>
          <path d={area} className="fill-primary/15" />
          <path d={line} fill="none" className="stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Income-statement style breakdown */}
      <div className="mt-2">
        <Row k={ar ? 'إيراد الخدمات' : 'Services revenue'} v={sar(svc.sub)} />
        <Row k={ar ? 'إيراد المنتجات' : 'Products revenue'} v={sar(prod.sub)} />
        <Row k={ar ? 'إجمالي الإيراد' : 'Net revenue'} v={sar(subTotal)} tone="sum" />
        <Row k={ar ? 'ضريبة القيمة المضافة (١٥٪)' : 'VAT (15%)'} v={sar(vat)} tone="vat" />
        <Row k={ar ? 'الإجمالي شامل الضريبة' : 'Total incl. VAT'} v={sar(grand)} tone="net" />
      </div>
    </section>
  );
}
