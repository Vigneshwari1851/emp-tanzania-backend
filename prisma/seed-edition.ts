import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding edition data...\n');

  // ── Feature Modules ──
  const moduleCodes = [
    { code: 'COMPANY_STRUCTURE',   name: 'Company Structure' },
    { code: 'EMPLOYEE_MANAGEMENT', name: 'Employee Management' },
    { code: 'RECRUITMENT',         name: 'Recruitment' },
    { code: 'TIME_ATTENDANCE',     name: 'Time & Attendance' },
    { code: 'TEAM_CALENDAR',       name: 'Team Calendar' },
    { code: 'PAYROLL',             name: 'Payroll' },
    { code: 'LOANS_ADVANCES',      name: 'Loans & Advances' },
    { code: 'TALENT_GROWTH',       name: 'Talent & Growth' },
    { code: 'SURVEY',              name: 'Surveys' },
    { code: 'NOTIFICATIONS',       name: 'Notifications' },
    { code: 'ASSET_MANAGEMENT',    name: 'Asset Management' },
    { code: 'AUDIT',               name: 'Audit Logs' },
  ];

  const moduleMap: Record<string, number> = {};
  for (const m of moduleCodes) {
    const mod = await prisma.featureModule.upsert({
      where: { code: m.code },
      update: { name: m.name },
      create: { code: m.code, name: m.name },
    });
    moduleMap[m.code] = mod.id;
  }
  console.log(`✅ ${moduleCodes.length} featureModule`);

  // ── Editions ──
  const editions = [
    { code: 'ENTERPRISE', name: 'Enterprise', description: 'All modules enabled', modules: moduleCodes.map(m => m.code) },
    { code: 'STANDARD',   name: 'Standard',   description: 'Core HR & Payroll',  modules: ['COMPANY_STRUCTURE', 'EMPLOYEE_MANAGEMENT', 'TIME_ATTENDANCE', 'TEAM_CALENDAR', 'PAYROLL', 'NOTIFICATIONS'] },
    { code: 'BASIC',      name: 'Basic',      description: 'Employee Management', modules: ['EMPLOYEE_MANAGEMENT', 'TIME_ATTENDANCE', 'NOTIFICATIONS'] },
  ];

  for (const ed of editions) {
    const edition = await prisma.edition.upsert({
      where: { code: ed.code },
      update: { name: ed.name, description: ed.description },
      create: { code: ed.code, name: ed.name, description: ed.description },
    });

    for (const modCode of ed.modules) {
      await prisma.editionModule.upsert({
        where: { editionId_featureModuleId: { editionId: edition.id, featureModuleId: moduleMap[modCode] } },
        update: {},
        create: { editionId: edition.id, featureModuleId: moduleMap[modCode] },
      });
    }
    console.log(`  ${ed.code} → ${ed.modules.length} modules`);
  }

  // ── Default Tenant (id=1) ──
  const enterprise = await prisma.edition.findUnique({ where: { code: 'ENTERPRISE' } });
  await prisma.tenant.upsert({
    where: { id: 1 },
    update: { editionId: enterprise!.id },
    create: { id: 1, tenantCode: 'rafiki', name: 'Default Tenant', editionId: enterprise!.id, billingEmail: 'billing@rafiki.com', status: 'ACTIVE' },
  });
  console.log('✅ Default tenant (id=1) → Enterprise edition');

  console.log('\n🎉 Edition seed complete!');
}

main().finally(() => prisma.$disconnect());
