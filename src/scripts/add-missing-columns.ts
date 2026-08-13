import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const em: any[] = await prisma.$queryRawUnsafe(`
      SELECT em.editionId, e.name as edition_name, em.featureModuleId, fm.name as module_name, fm.code
      FROM edition_modules em
      JOIN editions e ON e.id = em.editionId
      JOIN feature_modules fm ON fm.id = em.featureModuleId
      ORDER BY em.editionId, em.featureModuleId
    `);
    console.log('=== edition_modules (with names) ===');
    em.forEach(r => {
      console.log(`  [${r.edition_name}] ${r.module_name} (featureModuleId=${r.featureModuleId}, type=${typeof r.featureModuleId})`);
    });

    const modules: any[] = await prisma.$queryRawUnsafe(`SELECT id, name, code FROM feature_modules ORDER BY id`);
    console.log('\n=== feature_modules ===');
    modules.forEach(m => console.log(`  id=${m.id} (type=${typeof m.id}) name=${m.name}`));

  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
