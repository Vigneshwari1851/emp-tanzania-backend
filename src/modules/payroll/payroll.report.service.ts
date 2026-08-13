import prisma from '../../config/prisma';
import ExcelJS from 'exceljs';

const PAYMENT_STATUSES = ['Paid', 'PAID', 'paid'] as const;

async function getSetting(key: string, fallback: number): Promise<number> {
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key } });
        if (setting && setting.value) {
            const val = parseFloat(setting.value);
            if (!isNaN(val)) return val;
        }
    } catch { /* use fallback */ }
    return fallback;
}

export class PayrollReportService {
  /**
   * Apply an active loan deduction for a user detail (within a transaction).
   * Returns the amount deducted for this payroll run.
   */
  private async applyLoanRecovery(tx: any, userDetailId: number, netAmount: number): Promise<number> {
    const loan = await tx.loan.findFirst({
      where: { userDetailId, isActive: true },
    });
    if (!loan) return 0;
    const deduction = Math.min(
      Number(loan.monthlyRecovery),
      Number(loan.outstandingBalance),
      netAmount,
    );
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        outstandingBalance: { decrement: deduction },
        isActive: Number(loan.outstandingBalance) - deduction > 0,
        status: Number(loan.outstandingBalance) - deduction <= 0 ? 'SETTLED' : loan.status,
      },
    });
    return deduction;
  }

  /**
   * Apply an active advance deduction for a user detail (within a transaction).
   * Returns the amount deducted for this payroll run.
   */
  private async applyAdvanceRecovery(tx: any, userDetailId: number, netAmount: number): Promise<number> {
    const adv = await tx.advance.findFirst({
      where: { userDetailId, isActive: true },
    });
    if (!adv) return 0;
    const deduction = Math.min(
      Number(adv.monthlyRecovery),
      Number(adv.outstandingBalance),
      netAmount,
    );
    await tx.advance.update({
      where: { id: adv.id },
      data: {
        outstandingBalance: { decrement: deduction },
        isActive: Number(adv.outstandingBalance) - deduction > 0,
        status: Number(adv.outstandingBalance) - deduction <= 0 ? 'SETTLED' : adv.status,
      },
    });
    return deduction;
  }

    /**
     * Generate Bank Disbursement File (NEFT/RTGS format)
     */
    async generateBankDisbursementFile(month: string, orgId?: number) {
        const payslips = await prisma.payslip.findMany({
            where: {
                month,
                status: { in: [...PAYMENT_STATUSES] },
                ...(orgId ? { organization_id: orgId } : {})
            },
            include: {
                user: {
                    include: {
                        details: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Deduplicate: keep only the LATEST payslip per employee
        const latestPerEmployee = new Map<number, typeof payslips[0]>();
        payslips.forEach(slip => {
            if (!latestPerEmployee.has(slip.user_id)) {
                latestPerEmployee.set(slip.user_id, slip);
            }
        });

        // Generate CSV content
        let csvContent = 'Account Name,Account Number,IFSC Code,Bank Name,Amount,Narration\n';

        for (const slip of latestPerEmployee.values()) {
            const user = slip.user;
            const details = user?.details;
            if (!details) continue;

            const accountName = details.account_holder_name || `${details.first_name || ''} ${details.last_name || ''}`.trim();
            const accountNumber = details.account_number || `MISSING-AC-${user.id}`;
            const ifscCode = details.ifsc_code || 'MISSING-IFSC';
            const bankName = details.bank_name || '';
            const netAmount = Number(slip.net_amount);
            const narration = `Salary for ${month}`;

            csvContent += `${accountName},${accountNumber},${ifscCode},${bankName},${netAmount},${narration}\n`;
        }

        return csvContent;
    }

    /**
     * Generate PF ECR (Electronic Challan Return) File
     */
    async generatePFECRFile(month: string, orgId?: number) {
        const payslips = await prisma.payslip.findMany({
            where: {
                month,
                status: { in: [...PAYMENT_STATUSES] },
                ...(orgId ? { organization_id: orgId } : {})
            },
            include: {
                user: {
                    include: { details: true }
                }
            }
        });

        // ECR 2.0 Header
        const header = `#~#RETURN VERSION:1.0\n#~#WAGE MONTH:${month}\n#~#TOTAL MEMBERS:${payslips.length}\n`;

        let ecr = header;
        let totalEPF = 0;
        let totalEPS = 0;

        const epfWageCeiling = await getSetting('EPF_WAGE_CEILING', 15000);
        const epfEmployeeRate = await getSetting('EPF_EMPLOYEE_RATE', 0.12);
        const epsEmployerRate = await getSetting('EPF_EMPLOYER_EPS_RATE', 0.0833);
        const epfEmployerBalanceRate = await getSetting('EPF_EMPLOYER_EPF_RATE', 0.0367);

        for (let index = 0; index < payslips.length; index++) {
            const slip = payslips[index];
            const details = slip.user?.details as any;
            const memberName = `${details?.first_name || ''} ${details?.last_name || ''}`.trim() || 'N/A';
            const uan = details?.uan_number || `UAN${String(slip.user_id).padStart(10, '0')}`;
            
            const grossWages = Number(slip.gross_amount);
            const epfWages = Math.min(grossWages, epfWageCeiling);

            const employeeEPF = Math.round(epfWages * epfEmployeeRate);
            const employerEPS = Math.round(epfWages * epsEmployerRate);
            const employerEPF = Math.round(epfWages * epfEmployerBalanceRate);

            totalEPF += employeeEPF + employerEPF;
            totalEPS += employerEPS;

            ecr += `${index + 1}~${uan}~${memberName}~${grossWages}~${epfWages}~${epfWages}~${employeeEPF + employerEPF}~${employerEPS}~0~0\n`;
        }

        ecr += `#~#TOTAL EPF CONTRIBUTION:${totalEPF}\n`;
        ecr += `#~#TOTAL EPS CONTRIBUTION:${totalEPS}\n`;

        return ecr;
    }

    /**
     * Generate Master Payroll Register (Excel Export)
     */
    async generatePayrollRegister(month: string, orgId?: number): Promise<Buffer> {
        const payslips = await prisma.payslip.findMany({
            where: {
                month,
                ...(orgId ? { organization_id: orgId } : {})
            },
            include: {
                user: {
                    include: { details: { include: { department: true } } }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Deduplicate
        const latestPerEmployee = new Map<number, typeof payslips[0]>();
        payslips.forEach(slip => {
            if (!latestPerEmployee.has(slip.user_id)) {
                latestPerEmployee.set(slip.user_id, slip);
            }
        });

        // Collect all dynamic component names to build Excel headers
        const earningHeaders = new Set<string>();
        const deductionHeaders = new Set<string>();

        latestPerEmployee.forEach(slip => {
            const breakdown = slip.breakdown as any || {};
            if (breakdown.earnings) Object.keys(breakdown.earnings).forEach(k => earningHeaders.add(k));
            if (breakdown.deductions) Object.keys(breakdown.deductions).forEach(k => deductionHeaders.add(k));
        });

        const earnArr = Array.from(earningHeaders);
        const dedArr = Array.from(deductionHeaders);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`Payroll Register ${month}`);

        const columns = [
            { header: 'Emp ID', key: 'empId', width: 15 },
            { header: 'Employee Name', key: 'empName', width: 25 },
            { header: 'Department', key: 'dept', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Gross Pay', key: 'gross', width: 15 }
        ];

        earnArr.forEach(h => columns.push({ header: h, key: `earn_${h}`, width: 15 }));
        columns.push({ header: 'Total Deductions', key: 'totalDeductions', width: 18 });
        dedArr.forEach(h => columns.push({ header: h, key: `ded_${h}`, width: 15 }));
        columns.push({ header: 'Net Pay', key: 'net', width: 15 });

        sheet.columns = columns;

        // Add Header styling
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

        for (const slip of latestPerEmployee.values()) {
            const user = slip.user;
            const details = user?.details;
            
            const empId = details?.employee_id || `EMP-${user.id}`;
            const empName = `${details?.first_name || ''} ${details?.last_name || ''}`.trim();
            const dept = details?.department?.department_name || 'N/A';
            const status = slip.status;
            
            const breakdown = slip.breakdown as any || {};
            const earnings = breakdown.earnings || {};
            const deductions = breakdown.deductions || {};
            
            const rowData: any = {
                empId,
                empName,
                dept,
                status,
                gross: Number(slip.gross_amount)
            };

            earnArr.forEach(h => {
                rowData[`earn_${h}`] = Number(earnings[h] || 0);
            });

            let totalDeductions = 0;
            dedArr.forEach(h => {
                const val = Number(deductions[h] || 0);
                totalDeductions += val;
                rowData[`ded_${h}`] = val;
            });
            rowData.totalDeductions = totalDeductions;
            rowData.net = Number(slip.net_amount);

            sheet.addRow(rowData);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as unknown as Buffer;
    }

    /**
     * Prepare Form 16 / Form 24Q JSON Data
     */
    async generateForm16Data(userId: number, financialYear: string, orgId?: number) {
        // Parse the FY string (e.g. "2025-26") to determine month range
        const fyMatch = financialYear.match(/(\d{4})-(\d{2})/);
        let startYear = 2025;
        if (fyMatch) {
            startYear = parseInt(fyMatch[1]);
        }
        const startDate = new Date(startYear, 3, 1); // April of start year
        const endDate = new Date(startYear + 1, 2, 31); // March of end year

        const payslips = await prisma.payslip.findMany({
            where: {
                user_id: userId,
                created_at: { gte: startDate, lte: endDate },
                ...(orgId ? { organization_id: orgId } : {})
            }
        });

        const declarations = await prisma.taxDeclaration.findMany({
            where: {
                user_id: userId,
                status: 'approved',
                financial_year: financialYear
            }
        });

        const priorIncome = await prisma.priorEmploymentIncome.findMany({
            where: {
                user_id: userId,
                financial_year: financialYear
            }
        });

        // Load standard deduction from system settings (fallback: 50000 for old regime)
        const standardDeduction = await getSetting('STANDARD_DEDUCTION_OLD', 50000);

        let totalGross = 0;
        let totalTds = 0;
        let totalPf = 0;
        let totalPt = 0;

        payslips.forEach(slip => {
            totalGross += Number(slip.gross_amount);
            
            const breakdown: any = slip.breakdown || {};
            const deductions = breakdown.deductions || {};
            totalTds += Number(deductions['Income Tax (TDS)'] || 0);
            totalPf += Number(deductions['Employee EPF (12%)'] || deductions['EPF'] || 0);
            totalPt += Number(deductions['Professional Tax'] || deductions['PT'] || 0);
        });

        priorIncome.forEach(prior => {
            totalGross += Number(prior.gross_income);
            totalTds += Number(prior.tds_deducted);
            totalPf += Number(prior.pf_deducted);
            totalPt += Number(prior.pt_deducted);
        });

        let chapterVIA = 0;
        declarations.forEach(dec => {
            chapterVIA += Number(dec.amount);
        });

        const netTaxableIncome = Math.max(0, totalGross - standardDeduction - totalPt - chapterVIA);

        return {
            financialYear,
            employeeId: userId,
            ytdTotals: {
                grossSalary: totalGross,
                standardDeduction,
                professionalTax: totalPt,
                providentFund: totalPf,
                chapterVIADeductions: chapterVIA,
                netTaxableIncome,
                taxDeductedAtSource: totalTds
            },
            declarations: declarations.map(d => ({
                section: d.section,
                amount: Number(d.amount)
            }))
        };
    }
}

export const payrollReportService = new PayrollReportService();
