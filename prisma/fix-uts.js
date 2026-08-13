const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // First, ensure all required user types exist
  const requiredTypes = [
    { name: 'HR Head', system_key: 'HR_HEAD', description: 'Head of HR with org-wide HR access' },
    { name: 'HR Manager', system_key: 'HR_MANAGER', description: 'HR Manager with team operations access' },
    { name: 'HR Executive', system_key: 'HR_EXECUTIVE', description: 'HR Executive with day-to-day HR ops access' },
    { name: 'Finance Manager', system_key: 'FINANCE_MANAGER', description: 'Finance Manager with financial operations access' },
    { name: 'Finance Executive', system_key: 'FINANCE_EXECUTIVE', description: 'Finance Executive with daily finance ops access' },
  ];

  const org = await p.organization.findFirst();
  if (org) {
    for (const def of requiredTypes) {
      let ut = await p.user_types.findFirst({ where: { system_key: def.system_key } });
      if (!ut) {
        ut = await p.user_types.create({
          data: {
            organization_id: org.id,
            name: def.name,
            system_key: def.system_key,
            description: def.description,
          },
        });
        console.log('Created missing user type:', def.name, '(' + def.system_key + ')');
      }
    }
  }

  // Map email patterns to target user type system_key
  const emailToType = {
    'superadmin@gmail.com': 'SUPER_ADMIN',
    'admin@demo.com': 'ADMIN',
    'manager@demo.com': 'MANAGER',
    'hrmanager@demo.com': 'HR_MANAGER',
    'hrexecutive@demo.com': 'HR_EXECUTIVE',
    'financemanager@demo.com': 'FINANCE_MANAGER',
    'financeexecutive@demo.com': 'FINANCE_EXECUTIVE',
    'employee@socedge.com': 'EMPLOYEE',
  };

  for (const [email, systemKey] of Object.entries(emailToType)) {
    const ut = await p.user_types.findFirst({ where: { system_key: systemKey } });
    if (!ut) {
      console.log('User type still not found:', systemKey);
      continue;
    }
    const user = await p.user.findFirst({
      where: { email },
      include: { details: true },
    });
    if (user?.details?.id) {
      await p.userDetail.update({
        where: { id: user.details.id },
        data: { user_type_id: ut.id },
      });
      console.log(email + ' -> ' + ut.name + ' (' + systemKey + ')');
    } else {
      console.log('No details for:', email);
    }
  }
  await p.$disconnect();
})();
