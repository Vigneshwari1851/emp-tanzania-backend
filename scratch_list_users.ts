import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    include: {
      roles: { include: { role: true } },
      details: { include: { role: true } }
    }
  });
  for (const u of users) {
    const roleNames = u.roles.map(ur => ur.role?.role_name || "").join(", ");
    const detailRole = u.details?.role?.role_name || "";
    const managerId = u.details?.reporting_manager_id;
    console.log(`User ID: ${u.id} | Email: ${u.email} | Name: ${u.details?.first_name} ${u.details?.last_name} | Roles: [${roleNames}] | DetailRole: [${detailRole}] | ManagerID: ${managerId}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
