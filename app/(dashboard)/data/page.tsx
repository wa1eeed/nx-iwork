import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { parseFields } from '@/lib/objects/fields';
import { ObjectTypesManager, type TypeCard } from '@/components/dashboard/object-types-manager';

export default async function DataPage() {
  const t = await getTranslations('pages.data');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const types = companyId
    ? await db.objectType.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          nameEn: true,
          icon: true,
          description: true,
          fields: true,
          _count: { select: { records: true } },
        },
      })
    : [];

  const cards: TypeCard[] = types.map((ty) => ({
    id: ty.id,
    name: ty.name,
    nameEn: ty.nameEn,
    icon: ty.icon,
    description: ty.description,
    fields: parseFields(ty.fields),
    recordCount: ty._count.records,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ObjectTypesManager types={cards} />
    </div>
  );
}
