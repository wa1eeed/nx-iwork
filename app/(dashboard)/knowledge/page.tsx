import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FaqManager } from '@/components/dashboard/faq-manager';
import { TriggerManager } from '@/components/dashboard/trigger-manager';

// Two pillars that make agents smarter and proactive:
//  - FAQ: structured knowledge the agents read (search_faq)
//  - Event triggers: "when X happens, wake agent Y"
export default async function KnowledgePage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [faqs, triggers, agents] = companyId
    ? await Promise.all([
        db.faqItem.findMany({
          where: { companyId },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, question: true, answer: true, category: true },
        }),
        db.eventTrigger.findMany({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            event: true,
            name: true,
            isActive: true,
            fireCount: true,
            agent: { select: { name: true } },
          },
        }),
        db.agent.findMany({
          where: { companyId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">المعرفة والمشغّلات</h1>
        <p className="text-sm text-muted-foreground">
          عرّف أسئلة عملك ليجيب عنها الوكلاء بدقة، واجعلهم يتحركون تلقائياً عند الأحداث.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">قاعدة المعرفة (الأسئلة الشائعة)</CardTitle>
          <CardDescription>
            يقرأ منها الوكلاء عبر أداة search_faq — إجابات دقيقة بدل التخمين.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FaqManager
            items={faqs.map((f) => ({
              id: f.id,
              question: f.question,
              answer: f.answer,
              category: f.category,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المشغّلات التلقائية (Triggers)</CardTitle>
          <CardDescription>
            "عند حدث → يصحى وكيل وينفّذ مهمة" — تتطلب تفعيل مُشغّل الجدولة في الخادم.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TriggerManager
            agents={agents}
            triggers={triggers.map((t) => ({
              id: t.id,
              event: t.event,
              name: t.name,
              isActive: t.isActive,
              fireCount: t.fireCount,
              agentName: t.agent?.name ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
