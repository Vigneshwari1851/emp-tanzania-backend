import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgId = 1; // From the list
  
  console.log(`Seeding payroll data for Organization ID: ${orgId}`);

  // 1. Salary Components
  const components = [
    { name: 'Basic Salary', type: 'earning', calculation_type: 'fixed', value: 20000, is_taxable: true, is_statutory: false },
    { name: 'HRA', type: 'earning', calculation_type: 'percentage', value: 40, is_taxable: true, is_statutory: false },
    { name: 'Conveyance Allowance', type: 'earning', calculation_type: 'fixed', value: 1600, is_taxable: false, is_statutory: false },
    { name: 'PF - Employee', type: 'deduction', calculation_type: 'percentage', value: 12, is_taxable: false, is_statutory: true },
    { name: 'Professional Tax', type: 'deduction', calculation_type: 'fixed', value: 200, is_taxable: false, is_statutory: true },
  ];

  for (const comp of components) {
    await prisma.salaryComponent.upsert({
      where: { organization_id_name: { organization_id: orgId, name: comp.name } },
      update: comp,
      create: { ...comp, organization_id: orgId }
    });
  }

  // 2. Tax Sections
  const taxSections = [
    { section: '80C', label: 'Life Insurance, PPF, ELSS', limit: 150000, instruments: ['PPF', 'Life Insurance', 'ELSS', 'School Fees'] },
    { section: '80D', label: 'Medical Insurance', limit: 25000, instruments: ['Self & Family', 'Parents'] },
    { section: 'Section 24', label: 'Home Loan Interest', limit: 200000, instruments: ['Self-occupied Property'] },
  ];

  for (const sec of taxSections) {
    await prisma.taxSection.upsert({
      where: { organization_id_section: { organization_id: orgId, section: sec.section } },
      update: sec,
      create: { ...sec, organization_id: orgId }
    });
  }

  // 3. Payment Categories
  const categories = [
    { name: 'Full-Time Regular', frequency: 'Monthly', pay_day: '30' },
    { name: 'Contractors', frequency: 'Monthly', pay_day: '5' },
  ];

  for (const cat of categories) {
    await prisma.paymentCategory.upsert({
      where: { organization_id_name: { organization_id: orgId, name: cat.name } },
      update: cat,
      create: { ...cat, organization_id: orgId }
    });
  }

  // 4. Pay Cycle
  const payCycle = {
    frequency: 'monthly',
    pay_day: '30',
    attendance_start_day: '1',
    attendance_end_day: '31',
    cutoff_day: '25'
  };

  const existingCycle = await prisma.payCycle.findFirst({ where: { organization_id: orgId } });
  if (existingCycle) {
    await prisma.payCycle.update({ where: { id: existingCycle.id }, data: payCycle });
  } else {
    await prisma.payCycle.create({ data: { ...payCycle, organization_id: orgId } });
  }

  console.log('Seed data inserted successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
