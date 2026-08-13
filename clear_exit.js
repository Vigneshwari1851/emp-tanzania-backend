const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const managerId = 240; // manager of Vignesh (243)

  // Check manager's role
  const mgr = await prisma.user.findUnique({
    where: { id: managerId },
    include: {
      roles: { include: { role: true } },
      details: { include: { role: true } }
    }
  });
  const roleNames = [
    mgr.details?.role?.role_name || '',
    ...(mgr.roles || []).map(r => r.role?.role_name || '')
  ].join(', ');
  console.log('Manager ' + managerId + ' roles:', roleNames);

  // Check direct reports
  const directReports = await prisma.userDetail.findMany({
    where: { reporting_manager_id: managerId },
    select: { user_id: true, first_name: true }
  });
  console.log('Direct reports of manager:', JSON.stringify(directReports));

  // Check notifications for manager
  const notifs = await prisma.notification.findMany({
    where: { user_id: managerId, type: 'REIMBURSEMENT' },
    orderBy: { created_at: 'desc' },
    take: 10
  });
  console.log('Manager REIMBURSEMENT notifications:', notifs.length, JSON.stringify(notifs.map(n => ({ id: n.id, title: n.title, is_read: n.is_read, created_at: n.created_at }))));

  // Check total notifications count for manager
  const totalCount = await prisma.notification.count({ where: { user_id: managerId } });
  console.log('Total notifications for manager ' + managerId + ':', totalCount);
  // Accept employeeUserId from command line argument
  const employeeUserId = parseInt(process.argv[2], 10);
  if (isNaN(employeeUserId)) {
    console.error('Please provide a valid employeeUserId as the first argument');
    process.exit(1);
  }
  console.log(`Cleaning up exit requests for User ID: ${employeeUserId}`);

  // Fetch the exit request first to get its database ID
  const request = await prisma.exitRequest.findFirst({
    where: { user_id: employeeUserId },
  });

  if (!request) {
    console.log('No exit request found for this user.');
    return;
  }

  const exitId = request.id;

  // Delete all dependent child database rows to avoid foreign-key constraint violations
  await prisma.exitAsset.deleteMany({ where: { exit_request_id: exitId } });
  await prisma.exitClearanceTask.deleteMany({ where: { exit_request_id: exitId } });
  await prisma.exitWorkflowHistory.deleteMany({ where: { exit_request_id: exitId } });
  await prisma.exitInterviewResponse.deleteMany({ where: { exit_request_id: exitId } });
  await prisma.exitSettlement.deleteMany({ where: { exit_request_id: exitId } });

  // Delete the main exit request row
  await prisma.exitRequest.delete({ where: { id: exitId } });

  console.log(`Successfully cleared all exit request data for User ID ${employeeUserId}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
