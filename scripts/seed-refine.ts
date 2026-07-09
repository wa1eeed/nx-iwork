// Local runner for the Refine Medical Complex client demo. The seed logic lives
// in lib/seed/refine.ts so it can ALSO run inside the production image via
// POST /api/admin/seed-refine (the standalone runner ships API routes but not
// scripts/ + tsx).
//
//   DATABASE_URL=postgres://…  npm run seed:refine
//   (optional) DEMO_PASSWORD=…  to set the owner's password (default refine1234)

import { seedRefine } from '@/lib/seed/refine';

seedRefine()
  .then((r) => {
    console.log(`  Site:  /${r.slug}`);
    console.log(`  Login: ${r.ownerEmail} / ${process.env.DEMO_PASSWORD ?? 'refine1234'}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Refine seed failed:', err);
    process.exit(1);
  });
