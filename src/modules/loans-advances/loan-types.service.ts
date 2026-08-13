import prisma from '../../config/prisma';

const policyInclude = {
    department: true,
    designation: true,
    branch: true,
    role: true,
    organization: { select: { id: true, entity_name: true } },
};

export class LoanTypesService {

    async getAll() {
        return await prisma.loanType.findMany({
            include: {
                ...policyInclude,
                eligibilityRules: { where: { isActive: true } },
                approvalWorkflow: { orderBy: { stepOrder: 'asc' } },
                _count: { select: { applications: true } }
            },
            orderBy: { sortOrder: 'asc' }
        });
    }

    async getById(id: number) {
        const loanType = await prisma.loanType.findUnique({
            where: { id },
            include: {
                ...policyInclude,
                eligibilityRules: { orderBy: { ruleType: 'asc' } },
                approvalWorkflow: { orderBy: { stepOrder: 'asc' } },
                _count: { select: { applications: true } }
            }
        });
        if (!loanType) throw new Error('Loan type not found');
        return loanType;
    }

    async create(data: any) {
        const existing = await prisma.loanType.findUnique({ where: { code: data.code } });
        if (existing) throw new Error(`Loan type with code "${data.code}" already exists`);

        return await prisma.loanType.create({
            data: {
                name: data.name,
                code: data.code.toUpperCase(),
                category: data.category || 'LOAN',
                description: data.description || null,
                minAmount: Number(data.minAmount) || 0,
                maxAmount: Number(data.maxAmount) || 0,
                interestRate: Number(data.interestRate) || 0,
                repaymentMethod: data.repaymentMethod || 'EMI',
                maxTenure: Number(data.maxTenure) || 12,
                installments: Number(data.installments) || 1,
                requiresDocuments: data.requiresDocuments || false,
                isActive: data.isActive !== false,
                sortOrder: Number(data.sortOrder) || 0,
                effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                maxApplicationsPerPeriod: data.maxApplicationsPerPeriod ? Number(data.maxApplicationsPerPeriod) : null,
                period: data.period || 'Lifetime',
                department_id: data.department_id ? Number(data.department_id) : null,
                designation_id: data.designation_id ? Number(data.designation_id) : null,
                branch_id: data.branch_id ? Number(data.branch_id) : null,
                role_id: data.role_id ? Number(data.role_id) : null,
                organization_id: data.organization_id ? Number(data.organization_id) : null,
            },
            include: policyInclude
        });
    }

    async update(id: number, data: any) {
        const existing = await prisma.loanType.findUnique({ where: { id } });
        if (!existing) throw new Error('Loan type not found');

        if (data.code && data.code.toUpperCase() !== existing.code) {
            const codeExists = await prisma.loanType.findUnique({ where: { code: data.code.toUpperCase() } });
            if (codeExists) throw new Error(`Loan type with code "${data.code}" already exists`);
        }

        return await prisma.loanType.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.code && { code: data.code.toUpperCase() }),
                ...(data.category && { category: data.category }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.minAmount !== undefined && { minAmount: Number(data.minAmount) }),
                ...(data.maxAmount !== undefined && { maxAmount: Number(data.maxAmount) }),
                ...(data.interestRate !== undefined && { interestRate: Number(data.interestRate) }),
                ...(data.repaymentMethod && { repaymentMethod: data.repaymentMethod }),
                ...(data.maxTenure !== undefined && { maxTenure: Number(data.maxTenure) }),
                ...(data.installments !== undefined && { installments: Number(data.installments) }),
                ...(data.requiresDocuments !== undefined && { requiresDocuments: data.requiresDocuments }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
                ...(data.effectiveDate !== undefined && { effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null }),
                ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }),
                ...(data.maxApplicationsPerPeriod !== undefined && { maxApplicationsPerPeriod: data.maxApplicationsPerPeriod ? Number(data.maxApplicationsPerPeriod) : null }),
                ...(data.period !== undefined && { period: data.period }),
                ...(data.department_id !== undefined && { department_id: data.department_id ? Number(data.department_id) : null }),
                ...(data.designation_id !== undefined && { designation_id: data.designation_id ? Number(data.designation_id) : null }),
                ...(data.branch_id !== undefined && { branch_id: data.branch_id ? Number(data.branch_id) : null }),
                ...(data.role_id !== undefined && { role_id: data.role_id ? Number(data.role_id) : null }),
                ...(data.organization_id !== undefined && { organization_id: data.organization_id ? Number(data.organization_id) : null }),
            },
            include: policyInclude
        });
    }

    async toggleActive(id: number) {
        const existing = await prisma.loanType.findUnique({ where: { id } });
        if (!existing) throw new Error('Loan type not found');
        return await prisma.loanType.update({ where: { id }, data: { isActive: !existing.isActive } });
    }

    async getEligibilityRules(loanTypeId: number) {
        return await prisma.loanEligibilityRule.findMany({
            where: { loanTypeId },
            orderBy: { ruleType: 'asc' }
        });
    }

    async updateEligibilityRules(loanTypeId: number, rules: any[]) {
        const existing = await prisma.loanType.findUnique({ where: { id: loanTypeId } });
        if (!existing) throw new Error('Loan type not found');

        await prisma.loanEligibilityRule.deleteMany({ where: { loanTypeId } });

        if (!rules || rules.length === 0) return [];

        return await prisma.loanEligibilityRule.createMany({
            data: rules.map((r: any) => ({
                loanTypeId,
                ruleType: r.ruleType,
                ruleValue: typeof r.ruleValue === 'string' ? r.ruleValue : JSON.stringify(r.ruleValue),
                isActive: r.isActive !== false
            }))
        });
    }

    async getApprovalWorkflow(loanTypeId: number) {
        return await prisma.loanApprovalWorkflow.findMany({
            where: { loanTypeId },
            orderBy: { stepOrder: 'asc' }
        });
    }

    async updateApprovalWorkflow(loanTypeId: number, steps: any[]) {
        const existing = await prisma.loanType.findUnique({ where: { id: loanTypeId } });
        if (!existing) throw new Error('Loan type not found');

        await prisma.loanApprovalWorkflow.deleteMany({ where: { loanTypeId } });

        if (!steps || steps.length === 0) return [];

        return await prisma.loanApprovalWorkflow.createMany({
            data: steps.map((s: any, idx: number) => ({
                loanTypeId,
                stepOrder: s.stepOrder || idx + 1,
                roleName: s.roleName,
                isRequired: s.isRequired !== false
            }))
        });
    }

    async getStats() {
        const [totalTypes, activeTypes, loanCount, advanceCount, totalApps, activeApps] = await Promise.all([
            prisma.loanType.count(),
            prisma.loanType.count({ where: { isActive: true } }),
            prisma.loanType.count({ where: { category: 'LOAN' } }),
            prisma.loanType.count({ where: { category: 'ADVANCE' } }),
            prisma.loanApplication.count(),
            prisma.loanApplication.count({ where: { status: { in: ['APPROVED', 'DISBURSED'] } } })
        ]);

        return { totalTypes, activeTypes, loanCount, advanceCount, totalApps, activeApps };
    }
}
