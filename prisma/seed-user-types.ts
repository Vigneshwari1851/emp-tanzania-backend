import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding User Types...');

  // 1. Find or create the default organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    const fullSeed = await import('./seed');
    console.log('No organization found. Please run the main seed first: npx prisma db seed');
    return;
  }

  // 2. Define user types
  const userTypeDefs = [
    { name: 'Super Admin', system_key: 'SUPER_ADMIN', description: 'Full system access to all modules and features' },
    { name: 'Admin', system_key: 'ADMIN', description: 'Administrative access to most modules' },
    { name: 'Manager', system_key: 'MANAGER', description: 'Managerial access to team and people modules' },
    { name: 'Employee', system_key: 'EMPLOYEE', description: 'Standard employee with self-service access' },
    { name: 'Contractor', system_key: 'CONTRACTOR', description: 'Third-party contract employees with limited access' },
    { name: 'Intern', system_key: 'INTERN', description: 'Trainee with minimal module access' },
    { name: 'HR Head', system_key: 'HR_HEAD', description: 'Head of HR with org-wide HR access' },
    { name: 'HR Manager', system_key: 'HR_MANAGER', description: 'HR Manager with team operations access' },
    { name: 'HR Executive', system_key: 'HR_EXECUTIVE', description: 'HR Executive with day-to-day HR ops access' },
    { name: 'Finance Manager', system_key: 'FINANCE_MANAGER', description: 'Finance Manager with financial operations access' },
    { name: 'Finance Executive', system_key: 'FINANCE_EXECUTIVE', description: 'Finance Executive with daily finance ops access' },
  ];

  // 3. Get all modules for assignment later
  const allModules = await prisma.module.findMany();
  const moduleMap = new Map(allModules.map(m => [m.id, m]));

  // 4. Define which modules each user type gets
  const userTypeModules: Record<string, string[]> = {
    SUPER_ADMIN: allModules.map(m => m.id),
    ADMIN: allModules.map(m => m.id),
    MANAGER: ['employees', 'attendance', 'leaves', 'departments', 'organization', 'policies'],
    EMPLOYEE: ['attendance', 'leaves', 'policies'],
    CONTRACTOR: ['attendance', 'leaves'],
    INTERN: ['attendance'],
    HR_HEAD: ['employees', 'attendance', 'leaves', 'departments', 'organization', 'policies', 'performance', 'engagement', 'settings'],
    HR_MANAGER: ['employees', 'attendance', 'leaves', 'departments', 'organization', 'policies', 'performance'],
    HR_EXECUTIVE: ['employees', 'attendance', 'leaves', 'departments', 'policies'],
    FINANCE_MANAGER: ['employees', 'attendance', 'leaves', 'departments', 'organization', 'policies', 'settings'],
    FINANCE_EXECUTIVE: ['employees', 'attendance', 'leaves', 'departments', 'policies'],
  };

  // 5. Create or update user types
  const createdUserTypes: Record<string, number> = {};

  for (const def of userTypeDefs) {
    let ut = await prisma.user_types.findFirst({
      where: { organization_id: org.id, name: def.name },
    });

    if (!ut) {
      ut = await prisma.user_types.create({
        data: {
          organization_id: org.id,
          name: def.name,
          system_key: def.system_key,
          description: def.description,
        },
      });
      console.log(`  Created user type: ${def.name} (${def.system_key})`);
    } else {
      ut = await prisma.user_types.update({
        where: { id: ut.id },
        data: { system_key: def.system_key, description: def.description },
      });
      console.log(`  Updated user type: ${def.name} (${def.system_key})`);
    }

    createdUserTypes[def.system_key] = ut.id;

    // 6. Assign module permissions
    const moduleIds = userTypeModules[def.system_key] || [];
    const permissions = await prisma.permission.findMany({
      where: { moduleId: { in: moduleIds } },
    });

    // Clear existing assignments
    await prisma.user_type_permissions.deleteMany({
      where: { user_type_id: ut.id },
    });

    // Assign new permissions
    if (permissions.length > 0) {
      await prisma.user_type_permissions.createMany({
        data: permissions.map(p => ({
          user_type_id: ut.id,
          permission_id: p.id,
        })),
      });
      console.log(`  Assigned ${permissions.length} permissions (${moduleIds.length} modules) to ${def.name}`);
    }
  }

  // 7. Update existing user_details with appropriate user_type_id based on their role
  const userDetails = await prisma.userDetail.findMany({
    include: {
      role: true,
      user: {
        include: {
          roles: { include: { role: true } },
        },
      },
    },
  });

  // Helper: get all role names for a user (from direct role + user_roles)
  function getRoleNames(ud: typeof userDetails[0]): string[] {
    const names: string[] = [];
    if (ud.role?.role_name) names.push(ud.role.role_name.toUpperCase().replace(/\s+/g, '_'));
    if (ud.user?.roles) {
      for (const ur of ud.user.roles) {
        if (ur.role?.role_name) names.push(ur.role.role_name.toUpperCase().replace(/\s+/g, '_'));
      }
    }
    return names;
  }

  // Check if any role name matches a given pattern
  function hasRole(roleNames: string[], ...patterns: string[]): boolean {
    return patterns.some(p => roleNames.includes(p));
  }

  let updated = 0;
  for (const ud of userDetails) {
    let systemKey = 'EMPLOYEE';

    const roles = getRoleNames(ud);
    const email = ud.user?.email?.toLowerCase() || '';

    // 1. Email-based override (most accurate for demo accounts)
    if (email.includes('hrhead')) systemKey = 'HR_HEAD';
    else if (email.includes('hrmanager')) systemKey = 'HR_MANAGER';
    else if (email.includes('hrexecutive')) systemKey = 'HR_EXECUTIVE';
    else if (email.includes('financemanager')) systemKey = 'FINANCE_MANAGER';
    else if (email.includes('financeexecutive')) systemKey = 'FINANCE_EXECUTIVE';
    // 2. Role-based fallback
    else if (hasRole(roles, 'SUPER_ADMIN')) systemKey = 'SUPER_ADMIN';
    else if (hasRole(roles, 'ADMIN')) systemKey = 'ADMIN';
    else if (hasRole(roles, 'MANAGER')) systemKey = 'MANAGER';

    const userTypeId = createdUserTypes[systemKey];
    if (userTypeId && ud.user_type_id !== userTypeId) {
      await prisma.userDetail.update({
        where: { id: ud.id },
        data: { user_type_id: userTypeId },
      });
      updated++;
    }
  }

  console.log(`\nUpdated ${updated} user details with user type assignments`);
  console.log('User types seeding complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
