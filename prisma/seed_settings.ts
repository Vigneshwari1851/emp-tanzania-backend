import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const defaults = [
    { key: 'EPF_WAGE_CEILING', value: '15000' },
    { key: 'EPF_EMPLOYEE_RATE', value: '0.12' },
    { key: 'EPF_EMPLOYER_EPS_RATE', value: '0.0833' },
    { key: 'EPF_EMPLOYER_EPF_RATE', value: '0.0367' },
    { key: 'ESI_WAGE_CEILING', value: '21000' },
    { key: 'ESI_EMPLOYEE_RATE', value: '0.0075' },
    { key: 'ESI_EMPLOYER_RATE', value: '0.0325' },
    { key: 'GRATUITY_YEARS_THRESHOLD', value: '5' },
    { key: 'GRATUITY_MULTIPLIER', value: '15' },
    { key: 'GRATUITY_DIVISOR', value: '26' },
    { key: 'LEAVE_ENCASHMENT_DIVISOR', value: '30' },
    { key: 'STANDARD_DEDUCTION_OLD', value: '50000' },
    { key: 'STANDARD_DEDUCTION_NEW', value: '75000' },
    { key: 'HRA_METRO_PERCENT', value: '0.50' },
    { key: 'HRA_NON_METRO_PERCENT', value: '0.40' },
    { key: 'HRA_RENT_BASIC_PERCENT', value: '0.10' },
    { key: 'GLOBAL_80C_LIMIT', value: '150000' }
  ];

  for (const item of defaults) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value: item.value },
      create: { key: item.key, value: item.value }
    });
  }
  console.log('System settings successfully seeded!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
