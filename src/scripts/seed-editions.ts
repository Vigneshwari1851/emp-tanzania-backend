import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Edition and Feature data...');

  try {
    // 1. Insert Feature Modules
    const features = [
      { id: 1, code: 'COMPANY_STRUCTURE', name: 'Company Structure', description: '' },
      { id: 2, code: 'EMPLOYEE_MANAGEMENT', name: 'Employee Management', description: '' },
      { id: 3, code: 'RECRUITMENT', name: 'Recruitment (ATS)', description: '' },
      { id: 4, code: 'TIME_ATTENDANCE', name: 'Time & Attendance', description: '' },
      { id: 5, code: 'TEAM_CALENDAR', name: 'Team Calendar', description: '' },
      { id: 6, code: 'PAYROLL', name: 'Payroll', description: '' },
      { id: 7, code: 'TALENT_GROWTH', name: 'Talent & Growth', description: '' },
      { id: 8, code: 'SURVEY', name: 'Survey Manager', description: '' },
      { id: 9, code: 'NOTIFICATIONS', name: 'Notifications', description: '' },
      { id: 10, code: 'ASSET_MANAGEMENT', name: 'Asset Management', description: '' },
      { id: 11, code: 'EXIT', name: 'Employee Exit', description: '' },
      { id: 12, code: 'AUDIT', name: 'Audit Logs', description: '' },
      { id: 13, code: 'SETTINGS', name: 'System Settings', description: '' },
      { id: 14, code: 'DOCUMENT_HUB', name: 'Document Hub', description: '' },
      { id: 15, code: 'LOANS_ADVANCES', name: 'Loans & Advances', description: '' },
    ];

    for (const f of features) {
      await prisma.$executeRawUnsafe(
        `INSERT IGNORE INTO feature_modules (id, code, name, description) VALUES (?, ?, ?, ?)`,
        f.id, f.code, f.name, f.description
      );
    }
    console.log('✅ Inserted feature modules');

    // 2. Insert Editions
    const editions = [
      { id: 1, code: 'LITE', name: 'Lite', description: 'Essential HR features' },
      { id: 2, code: 'PRO', name: 'Pro', description: 'Advanced features' },
      { id: 3, code: 'ULTRA', name: 'Ultra', description: 'Full suite' },
      { id: 4, code: 'ENTERPRISE', name: 'Enterprise', description: 'Customizable solution' },
    ];

    for (const e of editions) {
      await prisma.$executeRawUnsafe(
        `INSERT IGNORE INTO editions (id, code, name, description) VALUES (?, ?, ?, ?)`,
        e.id, e.code, e.name, e.description
      );
    }
    console.log('✅ Inserted editions');

    // 3. Map Editions to Modules
    const lite = [1,2,3,4,5,6,8,9,11,13,14,15];
    const pro = [...lite, 7];
    const ultra = [...pro, 12];
    const enterprise = [...ultra, 10]; // all 15

    const mapping = [
      { editionId: 1, modules: lite },
      { editionId: 2, modules: pro },
      { editionId: 3, modules: ultra },
      { editionId: 4, modules: enterprise },
    ];

    for (const m of mapping) {
      for (const modId of m.modules) {
        await prisma.$executeRawUnsafe(
          `INSERT IGNORE INTO edition_modules (editionId, featureModuleId) VALUES (?, ?)`,
          m.editionId, modId
        );
      }
    }
    console.log('✅ Mapped modules to editions');

    // 4. Ensure Tenant exists and is assigned an edition
    const tenantCheck: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM tenants WHERE id = 1`);
    if (tenantCheck.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO tenants (id, name, editionId) VALUES (?, ?, ?)`,
        1, 'Demo Organization', 1
      );
      console.log('✅ Created default tenant assigned to Lite plan');
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
