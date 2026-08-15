const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    console.log('--- SIMULATING SUBMIT CLAIM AND NOTIFICATION GENERATION ---');
    try {
        const managerId = 2; // manager2@gmail.com
        const orgId = 1;

        // Simulate role check
        const userRoles = await prisma.userRole.findMany({
            where: { user_id: managerId },
            include: { role: true }
        });
        const roleNames = userRoles.map(r => r.role?.role_name?.toLowerCase() || "");
        
        const userDetailObj = await prisma.userDetail.findUnique({
            where: { user_id: managerId },
            include: { role: true }
        });
        if (userDetailObj?.role?.role_name) {
            roleNames.push(userDetailObj.role.role_name.toLowerCase());
        }

        const isOnlyEmployee = roleNames.length > 0 && roleNames.every(r => r === 'employee');
        console.log('Is submitting user only employee?', isOnlyEmployee);

        let mappedSequence = ['MANAGER', 'HR', 'FINANCE'];
        if (!isOnlyEmployee) {
            mappedSequence = ['ADMIN'];
        }
        console.log('Workflow sequence:', mappedSequence);

        // Submitting
        const claim = await prisma.expenseClaim.create({
            data: {
                user_id: managerId,
                organization_id: orgId,
                type: 'Executive Travel Reimbursement',
                amount: 500,
                description: 'Test manager claim',
                expense_date: new Date(),
                status: 'PENDING_APPROVAL',
                approval_sequence: JSON.stringify(mappedSequence),
                workflow_sequence: JSON.stringify(mappedSequence),
                current_step_index: 0,
                current_assigned_role: mappedSequence[0],
                approval_logs: JSON.stringify([])
            }
        });
        console.log('Created Claim in DB:', claim.id);

        // Notification generation
        const userDetail2 = await prisma.userDetail.findUnique({
            where: { user_id: managerId },
            select: { first_name: true, last_name: true, reporting_manager_id: true }
        });
        const empName = userDetail2 ? `${userDetail2.first_name || ''} ${userDetail2.last_name || ''}`.trim() : 'An employee';

        const recipientIds = new Set();
        if (userDetail2?.reporting_manager_id) {
            recipientIds.add(userDetail2.reporting_manager_id);
        }

        const adminUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { roles: { some: { role: { role_name: { in: ['tenant admin', 'tenant_admin', 'CEO', 'ceo', 'admin', 'ADMIN', 'super admin', 'SUPER ADMIN'] } } } } },
                    { details: { role: { role_name: { in: ['tenant admin', 'tenant_admin', 'CEO', 'ceo', 'admin', 'ADMIN', 'super admin', 'SUPER ADMIN'] } } } }
                ]
            },
            select: { id: true }
        });
        for (const u of adminUsers) recipientIds.add(u.id);

        recipientIds.delete(managerId);
        console.log('Recipient IDs to notify:', Array.from(recipientIds));

        for (const targetUserId of recipientIds) {
            const notif = await prisma.notification.create({
                data: {
                    user_id: targetUserId,
                    title: 'New Expense Claim Submitted',
                    message: `${empName} submitted a reimbursement claim for Executive Travel Reimbursement (TShs 500). Please review and approve.`,
                    type: 'REIMBURSEMENT',
                    related_module: 'reimbursement',
                    related_id: claim.id,
                    metadata: { claimId: claim.id, amount: 500, type: 'Executive Travel Reimbursement' },
                    is_read: false
                }
            });
            console.log('Generated notification ID:', notif.id, 'for user:', targetUserId);
        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
