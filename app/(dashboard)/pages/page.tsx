import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { SitePagesManager, type SitePageRow } from '@/components/dashboard/site-pages-manager';

// Website content pages (Terms, Instructions, Privacy…). The owner authors them
// here; they render inside the public site chrome and can be linked in the
// footer and/or the main site menu.
export default async function SitePagesPage() {
  const t = await getTranslations('biz.pages');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [company, pages] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { slug: true } }),
    db.sitePage.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        titleEn: true,
        slug: true,
        content: true,
        contentEn: true,
        showInFooter: true,
        showInNav: true,
        isPublished: true,
      },
    }),
  ]);

  const rows: SitePageRow[] = pages;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SitePagesManager pages={rows} siteSlug={company?.slug ?? null} />
    </div>
  );
}
