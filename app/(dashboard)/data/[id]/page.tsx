import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { parseFields } from '@/lib/objects/fields';
import { ObjectRecordsManager } from '@/components/dashboard/object-records-manager';

export default async function DataTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('pages.data');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) notFound();

  const type = await db.objectType.findFirst({
    where: { id, companyId },
    select: { id: true, name: true, description: true, fields: true },
  });
  if (!type) notFound();

  const records = await db.objectRecord.findMany({
    where: { objectTypeId: id, companyId },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: { id: true, data: true, title: true, createdAt: true },
  });

  const fields = parseFields(type.fields);

  return (
    <div className="space-y-6">
      <Link href="/data" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('back')}
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{type.name}</h1>
        <p className="text-sm text-muted-foreground">
          {type.description || t('recordsCount', { count: records.length })}
        </p>
      </div>
      <ObjectRecordsManager
        typeId={type.id}
        fields={fields}
        records={records.map((r) => ({
          id: r.id,
          data: (r.data ?? {}) as Record<string, unknown>,
          title: r.title,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
