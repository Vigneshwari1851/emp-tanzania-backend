import prisma from '../../config/prisma';
import { StatutoryEngine } from './statutory.engine';
import { TaxEngine } from './tax.engine';

export interface PayrollInput {
    employeeId: number;
    baseSalary: number;
    actualGross: number;
    lopDays: number;
    workingDays: number;
    lopDeductionAmount: number;
    earnings: Record<string, number>;
    deductions: Record<string, number>;
    apiDetails: any;
    month?: number;
    year?: number;
}

export interface PayrollEngineResult {
    deductions: Record<string, number>;
    employerContributions: Record<string, number>;
    taxInfo: {
        annualIncome: number;
        totalExemptions: number;
        netTaxableIncome: number;
        annualTds: number;
        monthlyTds: number;
        taxPolicySnapshot?: any;
    };
}

export interface IPayrollEngine {
    calculate(input: PayrollInput): Promise<PayrollEngineResult>;
}

/**
 * Helper to dynamically load settings with fallbacks
 */
async function getSetting(key: string, fallback: number): Promise<number> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key }
        });
        if (setting && setting.value) {
            const val = parseFloat(setting.value);
            if (!isNaN(val)) return val;
        }
    } catch (error) {
        console.error(`Error loading system setting for ${key}:`, error);
    }
    return fallback;
}

/**
 * 1. INDIA PAYROLL ENGINE
 */
export class INPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { employeeId, actualGross, earnings, deductions, apiDetails } = input;
        
        const localDeductions = { ...deductions };
        const employerContributions: Record<string, number> = {};

        // A. Professional Tax
        const state = apiDetails?.state || 'Maharashtra';
        const ptAmount = await StatutoryEngine.calculatePT(actualGross, state);
        if ('Professional Tax' in localDeductions) {
            localDeductions['Professional Tax'] = ptAmount;
        } else if ('PT' in localDeductions) {
            localDeductions['PT'] = ptAmount;
        } else {
            if (ptAmount > 0) {
                localDeductions['Professional Tax'] = ptAmount;
            }
        }

        // B. Employee EPF (12%)
        const basic = earnings['Basic'] || earnings['Basic Salary'] || (actualGross * 0.5);
        if (!localDeductions['EPF'] && !localDeductions['Provident Fund'] && !localDeductions['PF - Employee'] && !localDeductions['Employee EPF (12%)']) {
            const pfCalculation = await StatutoryEngine.calculateEPF(basic);
            localDeductions['Employee EPF (12%)'] = pfCalculation.employeeEPF;
            employerContributions['Employer EPF (3.67%)'] = pfCalculation.employerEPF;
            employerContributions['Employer EPS (8.33%)'] = pfCalculation.employerEPS;
        }

        // C. Employee ESI (0.75%)
        if (!localDeductions['ESI']) {
            const esiCalculation = await StatutoryEngine.calculateESI(actualGross);
            if (esiCalculation.employeeESI > 0) {
                localDeductions['Employee ESI (0.75%)'] = esiCalculation.employeeESI;
                employerContributions['Employer ESI (3.25%)'] = esiCalculation.employerESI;
            }
        }

        // C.2. Labour Welfare Fund (LWF)
        const lwfCalculation = await StatutoryEngine.calculateLWF(actualGross, state);
        if (lwfCalculation.employeeLWF > 0) {
            localDeductions['Labour Welfare Fund (LWF)'] = lwfCalculation.employeeLWF;
            employerContributions['Employer LWF Contribution'] = lwfCalculation.employerLWF;
        }

        // D. Income Tax (TDS)
        const annualGross = actualGross * 12;
        const taxRegime = ((apiDetails?.tax_regime as string)?.toLowerCase() === 'new' ? 'New' : 'Old') as 'Old' | 'New';
        const annualBasic = (earnings['Basic'] || earnings['Basic Salary'] || 0) * 12;
        const annualHRA = (earnings['HRA'] || earnings['House Rent Allowance'] || 0) * 12;
        const isMetro = ['mumbai', 'delhi', 'kolkata', 'chennai'].includes(
            (apiDetails?.city || '').toLowerCase()
        );

        const taxInfo = await TaxEngine.calculateTaxableIncome(
            employeeId,
            annualGross,
            taxRegime,
            annualBasic,
            annualHRA,
            isMetro
        );

        const annualTds = await TaxEngine.calculateTaxLiability(taxInfo.netTaxableIncome, taxRegime);

        // Dynamic remaining months for the current financial year (April - March)
        const currentMonthIndex = new Date().getMonth(); // 0 = Jan, 11 = Dec
        let monthsRemaining = 1;
        if (currentMonthIndex >= 3) {
            monthsRemaining = 12 - (currentMonthIndex - 3);
        } else {
            monthsRemaining = 3 - currentMonthIndex;
        }

        const monthlyTds = TaxEngine.calculateMonthlyTDS(annualTds, taxInfo.priorTdsPaid, monthsRemaining);

        if (monthlyTds > 0) {
            localDeductions['Income Tax (TDS)'] = monthlyTds;
        }

        return {
            deductions: localDeductions,
            employerContributions,
            taxInfo: {
                annualIncome: annualGross,
                totalExemptions: taxInfo.totalExemptions + taxInfo.totalChapterVIDeductions,
                netTaxableIncome: taxInfo.netTaxableIncome,
                annualTds,
                monthlyTds
            }
        };
    }
}

/**
 * 2. USA PAYROLL ENGINE (US Federal Taxes & FICA)
 */
export class USPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { employeeId, actualGross, deductions, apiDetails } = input;
        
        const localDeductions = { ...deductions };
        const employerContributions: Record<string, number> = {};

        // A. FICA Social Security (6.2%)
        const ssRate = await getSetting('US_FICA_SS_RATE', 0.062);
        const ssCeiling = await getSetting('US_FICA_SS_CEILING', 168600); // 2024 threshold
        const monthlySSCeiling = ssCeiling / 12;
        
        const ssDeduction = Math.round(Math.min(actualGross, monthlySSCeiling) * ssRate);
        localDeductions['FICA Social Security (6.2%)'] = ssDeduction;
        employerContributions['Employer Social Security (6.2%)'] = ssDeduction;

        // B. FICA Medicare (1.45% + 0.9% Additional Medicare for gross > $200,000)
        const medRate = await getSetting('US_FICA_MED_RATE', 0.0145);
        const projectedAnnualGross = actualGross * 12;
        let medicareTax = actualGross * medRate;
        
        if (projectedAnnualGross > 200000) {
            const addMedRate = await getSetting('US_FICA_ADD_MED_RATE', 0.009);
            const monthlyThreshold = 200000 / 12;
            const excess = Math.max(0, actualGross - monthlyThreshold);
            medicareTax += excess * addMedRate;
        }
        
        const medDeduction = Math.round(medicareTax);
        localDeductions['FICA Medicare (1.45%)'] = medDeduction;
        employerContributions['Employer Medicare (1.45%)'] = Math.round(actualGross * medRate);

        // C. US Federal Income Tax (FIT)
        const stdDeduction = await getSetting('US_STD_DEDUCTION', 15000);
        const taxableIncome = Math.max(0, projectedAnnualGross - stdDeduction);
        
        // Progressive Tax Brackets — stored as JSON in system_settings, fallback to 2024 Single Filer
        const defaultBrackets = '[[0,11600,0.10],[11600,47150,0.12],[47150,100525,0.22],[100525,191950,0.24],[191950,243725,0.32],[243725,609350,0.35],[609350,null,0.37]]';
        let brackets: [number, number | null, number][] = JSON.parse(defaultBrackets);
        try {
            const setting = await prisma.systemSetting.findUnique({ where: { key: 'US_FIT_BRACKETS' } });
            if (setting && setting.value) {
                const parsed = JSON.parse(setting.value);
                if (Array.isArray(parsed) && parsed.length > 0) brackets = parsed;
            }
        } catch { /* use default */ }

        let annualFIT = 0;
        for (const [lower, upper, rate] of brackets) {
            if (taxableIncome <= lower) break;
            const upperBound = upper ?? Infinity;
            const taxableInSlab = Math.min(taxableIncome, upperBound) - lower;
            if (taxableInSlab > 0) annualFIT += taxableInSlab * rate;
        }

        const monthlyFIT = Math.round(annualFIT / 12);
        if (monthlyFIT > 0) {
            localDeductions['Federal Income Tax (FIT)'] = monthlyFIT;
        }

        // D. State Income Tax (SIT)
        const state = (apiDetails?.state || '').toUpperCase();
        let sitAmount = 0;
        const defaultNoTaxStates = ['TX','FL','WA','NV','AK','WY','SD','TN'];
        let noTaxStates = defaultNoTaxStates;
        try {
            const setting = await prisma.systemSetting.findUnique({ where: { key: 'US_NO_TAX_STATES' } });
            if (setting && setting.value) {
                const parsed = JSON.parse(setting.value);
                if (Array.isArray(parsed)) noTaxStates = parsed.map((s: string) => s.toUpperCase());
            }
        } catch { /* use default */ }

        if (!noTaxStates.includes(state)) {
            const sitRate = ['CA', 'NY'].includes(state)
                ? await getSetting('US_SIT_HIGH_TAX_RATE', 0.08)
                : await getSetting('US_SIT_DEFAULT_RATE', 0.04);
            sitAmount = Math.round(actualGross * sitRate);
            localDeductions[`State Income Tax (${state})`] = sitAmount;
        }

        // E. Employer Unemployment Taxes (FUTA / SUTA)
        // Fetch cumulative YTD gross salary prior to this pay cycle for the current calendar year
        const currentYear = new Date().getFullYear().toString();
        let ytdGrossPrior = 0;
        try {
            const previousPayslips = await prisma.payslip.findMany({
                where: {
                    user_id: employeeId,
                    month: {
                        endsWith: currentYear
                    },
                    status: 'Paid'
                },
                select: {
                    gross_amount: true
                }
            });
            ytdGrossPrior = previousPayslips.reduce((sum, p) => sum + (parseFloat(p.gross_amount.toString()) || 0), 0);
        } catch (error) {
            console.error("Error retrieving prior YTD gross for US unemployment tax calculations:", error);
        }

        // Calculate FUTA (Federal Unemployment Tax - effective rate is 0.6% on first $7,000 after SUTA credit)
        const futaRate = await getSetting('US_FUTA_RATE', 0.006);
        const futaLimit = await getSetting('US_FUTA_LIMIT', 7000);
        if (ytdGrossPrior < futaLimit) {
            const remainingLimit = futaLimit - ytdGrossPrior;
            const applicableGross = Math.min(actualGross, remainingLimit);
            const futaDeduction = Math.round(applicableGross * futaRate);
            if (futaDeduction > 0) {
                employerContributions['Employer FUTA (0.6%)'] = futaDeduction;
            }
        }

        // Calculate SUTA (State Unemployment Tax - fallback to 2.7% on first $10,000)
        const stateKey = state.replace(/\s+/g, '_');
        const sutaRate = await getSetting(`US_SUTA_RATE_${stateKey}`, 0.027);
        const sutaLimit = await getSetting(`US_SUTA_LIMIT_${stateKey}`, 10000);
        if (ytdGrossPrior < sutaLimit) {
            const remainingLimit = sutaLimit - ytdGrossPrior;
            const applicableGross = Math.min(actualGross, remainingLimit);
            const sutaDeduction = Math.round(applicableGross * sutaRate);
            if (sutaDeduction > 0) {
                employerContributions[`Employer SUTA (${state})`] = sutaDeduction;
            }
        }

        return {
            deductions: localDeductions,
            employerContributions,
            taxInfo: {
                annualIncome: projectedAnnualGross,
                totalExemptions: stdDeduction,
                netTaxableIncome: taxableIncome,
                annualTds: annualFIT + (sitAmount * 12),
                monthlyTds: monthlyFIT + sitAmount
            }
        };
    }
}

/**
 * 3. SINGAPORE PAYROLL ENGINE (CPF & SDL & progressive IRAS tax)
 */
export class SGPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { actualGross, earnings, deductions } = input;
        
        const localDeductions = { ...deductions };
        const employerContributions: Record<string, number> = {};

        // A. Central Provident Fund (CPF)
        // Standard rate for employee aged <= 55: Employee 20%, Employer 17%
        // Capped at Ordinary Wage ceiling of $6,800/month (Budget 2024-2026 update)
        const basic = earnings['Basic'] || earnings['Basic Salary'] || actualGross;
        const owCeiling = await getSetting('SG_CPF_OW_CEILING', 6800);
        const cpfEmpRate = await getSetting('SG_CPF_EMPLOYEE_RATE', 0.20);
        const cpfEmployerRate = await getSetting('SG_CPF_EMPLOYER_RATE', 0.17);

        const cpfWages = Math.min(basic, owCeiling);
        const employeeCPF = Math.round(cpfWages * cpfEmpRate);
        const employerCPF = Math.round(cpfWages * cpfEmployerRate);

        localDeductions['Employee CPF (20%)'] = employeeCPF;
        employerContributions['Employer CPF (17%)'] = employerCPF;

        // B. Skills Development Levy (SDL) - Paid by employer only
        // 0.25% of gross wages, min $2, max $11.25
        const sdlRate = await getSetting('SG_SDL_RATE', 0.0025);
        const sdlMin = await getSetting('SG_SDL_MIN', 2);
        const sdlMax = await getSetting('SG_SDL_MAX', 11.25);
        const sdlAmount = Math.max(sdlMin, Math.min(sdlMax, actualGross * sdlRate));
        employerContributions['Skills Development Levy (SDL)'] = parseFloat(sdlAmount.toFixed(2));

        // C. Self-Help Group (SHG) Fund - CDAC/SINDA/ECF/MBMF default
        let shgAmount = 1.00;
        if (actualGross <= 800) shgAmount = 0.50;
        else if (actualGross <= 2000) shgAmount = 1.00;
        else if (actualGross <= 4000) shgAmount = 1.50;
        else shgAmount = 3.00;
        localDeductions['Self-Help Group (SHG) Contribution'] = shgAmount;

        // D. Income Tax (IRAS progressive slabs)
        const projectedAnnualGross = actualGross * 12;
        
        // SG IRAS 2024 slabs — stored as JSON [upper, rate, cumulativeTax] in system_settings
        const defaultSlabs = '[[20000,0,0],[30000,0.02,0],[40000,0.035,200],[80000,0.07,550],[120000,0.115,3350],[160000,0.15,7950],[200000,0.18,13950],[240000,0.19,21150],[280000,0.195,28750],[320000,0.20,36550],[500000,0.22,44550],[1000000,0.23,84150],[null,0.24,199150]]';
        let sgSlabs: [number | null, number, number][] = JSON.parse(defaultSlabs);
        try {
            const setting = await prisma.systemSetting.findUnique({ where: { key: 'SG_IRAS_BRACKETS' } });
            if (setting && setting.value) {
                const parsed = JSON.parse(setting.value);
                if (Array.isArray(parsed) && parsed.length > 0) sgSlabs = parsed;
            }
        } catch { /* use default */ }

        const taxable = projectedAnnualGross;
        let annualTax = 0;
        let prevUpper = 0;
        for (const [upper, rate, cumulative] of sgSlabs) {
            const upperBound = upper ?? Infinity;
            if (taxable <= upperBound) {
                annualTax = cumulative + (taxable - prevUpper) * rate;
                break;
            }
            prevUpper = upperBound;
        }

        const monthlyTax = Math.round(annualTax / 12);
        if (monthlyTax > 0) {
            localDeductions['Singapore Income Tax (IRAS)'] = monthlyTax;
        }

        return {
            deductions: localDeductions,
            employerContributions,
            taxInfo: {
                annualIncome: projectedAnnualGross,
                totalExemptions: 0,
                netTaxableIncome: taxable,
                annualTds: annualTax,
                monthlyTds: monthlyTax
            }
        };
    }
}

/**
 * 4. UAE PAYROLL ENGINE (GPSSA Pension & Zero Personal Tax)
 */
export class UAEPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { actualGross, deductions, apiDetails } = input;
        
        const localDeductions = { ...deductions };
        const employerContributions: Record<string, number> = {};

        // A. GPSSA Pension
        // Applies ONLY to UAE Nationals (apiDetails.nationality === 'UAE' or similar)
        const nationality = (apiDetails?.nationality || '').toUpperCase();
        if (nationality === 'UAE' || nationality === 'EMIRATI' || nationality === 'UNITED ARAB EMIRATES') {
            const gpssaEmpRate = await getSetting('AE_GPSSA_EMPLOYEE_RATE', 0.05);
            const gpssaEmployerRate = await getSetting('AE_GPSSA_EMPLOYER_RATE', 0.125);
            const gpssaCeiling = await getSetting('AE_GPSSA_CEILING', 50000); // 50,000 AED ceiling
            
            const pensionWages = Math.min(actualGross, gpssaCeiling);
            const employeePension = Math.round(pensionWages * gpssaEmpRate);
            const employerPension = Math.round(pensionWages * gpssaEmployerRate);

            localDeductions['GPSSA Pension (5%)'] = employeePension;
            employerContributions['Employer GPSSA Pension (12.5%)'] = employerPension;
        }

        // B. Personal Income Tax in UAE is 0%
        return {
            deductions: localDeductions,
            employerContributions,
            taxInfo: {
                annualIncome: actualGross * 12,
                totalExemptions: actualGross * 12,
                netTaxableIncome: 0,
                annualTds: 0,
                monthlyTds: 0
            }
        };
    }
}

/**
 * 5. DEFAULT ENGINE (Standard gross-to-net, no statutory/tax overrides)
 */
export class DefaultPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { actualGross, deductions } = input;
        return {
            deductions,
            employerContributions: {},
            taxInfo: {
                annualIncome: actualGross * 12,
                totalExemptions: 0,
                netTaxableIncome: actualGross * 12,
                annualTds: 0,
                monthlyTds: 0
            }
        };
    }
}

/**
 * 6. TANZANIA PAYROLL ENGINE
 */
export class TZPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { baseSalary, actualGross, deductions, apiDetails, month, year } = input;
        const localDeductions = { ...deductions };
        const employerContributions: Record<string, number> = {};

        const orgId = apiDetails?.organization_id || 1;
        
        // 1. Determine effective date for policy match (first day of payroll month)
        const calcMonth = month || (new Date().getMonth() + 1);
        const calcYear = year || new Date().getFullYear();
        const targetDate = new Date(Date.UTC(calcYear, calcMonth - 1, 1));

        // 2. Fetch the correct TzTaxPolicy version from db
        const policy = await prisma.tzTaxPolicy.findFirst({
            where: {
                organization_id: orgId,
                status: 'active',
                effective_date: { lte: targetDate }
            },
            orderBy: [
                { effective_date: 'desc' },
                { version: 'desc' }
            ]
        });

        if (!policy) {
            throw new Error(`No active Tanzania tax policy found for organization ID ${orgId} effective on or before ${targetDate.toISOString().split('T')[0]}.`);
        }

        // 3. NSSF Contribution Calculation
        const empNssfRate = parseFloat(policy.employee_nssf_rate.toString()) || 0.10;
        const empyrNssfRate = parseFloat(policy.employer_nssf_rate.toString()) || 0.10;

        const employeeNSSF = Math.round(actualGross * empNssfRate);
        const employerNSSF = Math.round(actualGross * empyrNssfRate);

        localDeductions['NSSF Pension'] = employeeNSSF;
        employerContributions['Employer NSSF'] = employerNSSF;

        // 4. PAYE Calculation
        // Gross income subject to PAYE is calculated AFTER NSSF deduction (NSSF is tax-deductible in TZ)
        const taxableIncome = Math.max(0, actualGross - employeeNSSF);

        // Compute PAYE progressively based on configured slabs
        const slabs = policy.paye_slabs as any[];
        let payeAmount = 0;

        // Find the slab where the taxable income falls
        const matchedSlab = slabs.find(s => {
            const min = parseFloat(s.lowerLimit);
            const max = s.upperLimit === null || s.upperLimit === undefined ? Infinity : parseFloat(s.upperLimit);
            return taxableIncome >= min && taxableIncome <= max;
        });

        if (matchedSlab) {
            const min = parseFloat(matchedSlab.lowerLimit);
            const rate = parseFloat(matchedSlab.rate);
            const fixed = parseFloat(matchedSlab.fixedAmount);
            
            const excessBase = min > 0 ? min - 1 : 0;
            payeAmount = Math.round(fixed + (taxableIncome - excessBase) * (rate / 100));
        }

        // 4b. Apply Tax Reliefs (Personal Relief + Disability Relief)
        const personalReliefAnnual = parseFloat(policy.personal_relief_annual?.toString() || '270000');
        const disabilityReliefAnnual = parseFloat(policy.disability_relief_annual?.toString() || '270000');
        const personalReliefMonthly = Math.round(personalReliefAnnual / 12);
        const disabilityReliefMonthly = apiDetails?.is_disabled ? Math.round(disabilityReliefAnnual / 12) : 0;
        const totalRelief = personalReliefMonthly + disabilityReliefMonthly;
        payeAmount = Math.max(0, payeAmount - totalRelief);

        if (payeAmount > 0) {
            localDeductions['PAYE Tax'] = payeAmount;
        } else {
            localDeductions['PAYE Tax'] = 0;
        }

        // 5. HESLB Repayment Deduction (Dynamic rate from policy)
        const heslbRate = parseFloat(policy.heslb_rate?.toString() || '0.15');
        let heslbAmount = 0;
        const isHeslbBeneficiary = apiDetails?.is_heslb_beneficiary === true;
        if (isHeslbBeneficiary) {
            heslbAmount = Math.round(baseSalary * heslbRate);
            localDeductions['HESLB Loan Deduction'] = heslbAmount;
        } else {
            localDeductions['HESLB Loan Deduction'] = 0;
        }

        // 6. SDL Contribution (Employer Cost)
        const sdlThreshold = policy.sdl_threshold ?? 10;
        const sdlRate = parseFloat(policy.sdl_rate.toString()) ?? 0.035;
        
        // Count active employees in organization
        const activeEmployeeCount = await prisma.user.count({
            where: {
                status: true,
                roles: {
                    some: {
                        role: {
                            organization_id: orgId
                        }
                    }
                }
            }
        });

        let sdlAmount = 0;
        if (activeEmployeeCount >= sdlThreshold) {
            sdlAmount = Math.round(actualGross * sdlRate);
            employerContributions['Employer SDL'] = sdlAmount;
        } else {
            employerContributions['Employer SDL'] = 0;
        }

        // 7. WCF Contribution (Employer Cost)
        const wcfRate = parseFloat(policy.wcf_rate.toString()) ?? 0.005;
        const wcfAmount = Math.round(actualGross * wcfRate);
        employerContributions['Employer WCF'] = wcfAmount;

        return {
            deductions: localDeductions,
            employerContributions,
            taxInfo: {
                annualIncome: actualGross * 12,
                totalExemptions: employeeNSSF * 12,
                netTaxableIncome: taxableIncome,
                annualTds: payeAmount * 12,
                monthlyTds: payeAmount,
                taxPolicySnapshot: {
                    taxPolicyId: policy.id,
                    taxPolicyVersion: policy.version,
                    effectiveDate: policy.effective_date,
                    payeSlabs: policy.paye_slabs,
                    employeeNssfRate: empNssfRate,
                    employerNssfRate: empyrNssfRate,
                    employeeNssfCalculated: employeeNSSF,
                    employerNssfCalculated: employerNSSF,
                    payeCalculated: payeAmount,
                    // New expanded policy fields
                    sdlRate: sdlRate,
                    sdlThreshold: sdlThreshold,
                    wcfRate: wcfRate,
                    heslbRate: heslbRate,
                    heslbApplicable: isHeslbBeneficiary,
                    heslbIndexNumber: apiDetails?.heslb_index_number || null,
                    basicSalaryUsedForHeslb: isHeslbBeneficiary ? baseSalary : 0,
                    calculatedHeslb: heslbAmount,
                    calculatedSdl: sdlAmount,
                    calculatedWcf: wcfAmount,
                    personalReliefMonthly,
                    disabilityReliefMonthly,
                    totalReliefApplied: totalRelief
                }
            }
        };
    }
}

/**
 * PAYROLL ENGINE FACTORY
 */
export class PayrollEngineFactory {
    static getEngine(country: string): IPayrollEngine {
        const normCountry = (country || '').trim().toUpperCase();
        
        switch (normCountry) {
            case 'IN':
            case 'INDIA':
                return new INPayrollEngine();
            case 'US':
            case 'USA':
            case 'UNITED STATES':
                return new USPayrollEngine();
            case 'SG':
            case 'SINGAPORE':
                return new SGPayrollEngine();
            case 'AE':
            case 'UAE':
            case 'UNITED ARAB EMIRATES':
                return new UAEPayrollEngine();
            case 'TZ':
            case 'TANZANIA':
                return new TZPayrollEngine();
            default:
                return new DefaultPayrollEngine();
        }
    }
}
