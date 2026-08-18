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
 * 5. TANZANIA PAYROLL ENGINE
 *    PAYE (progressive 5-band), NSSF (10%+10%), SDL (3.5% employer),
 *    WCF (0.6% employer), HESLB (15% of basic), Non-resident 15% flat.
 */
export class TZPayrollEngine implements IPayrollEngine {
    async calculate(input: PayrollInput): Promise<PayrollEngineResult> {
        const { employeeId, actualGross, earnings, deductions, apiDetails } = input;

        const localDeductions = { ...deductions };
        const employerContributions: Record<string, number> = {};

        // ── Basic salary (for NSSF/HESLB base) ──────────────────────────
        const basic = earnings['Basic'] || earnings['Basic Salary'] || (actualGross * 0.5);

        // ================================================================
        // A. NSSF — 10% employee + 10% employer, NO ceiling
        // ================================================================
        const nssfEmpRate  = await getSetting('TZ_NSSF_EMPLOYEE_RATE', 0.10);
        const nssfErRate   = await getSetting('TZ_NSSF_EMPLOYER_RATE', 0.10);

        const nssfEmployee = Math.round(actualGross * nssfEmpRate);
        const nssfEmployer = Math.round(actualGross * nssfErRate);

        localDeductions['NSSF Employee (10%)'] = nssfEmployee;
        employerContributions['NSSF Employer (10%)'] = nssfEmployer;

        // ================================================================
        // B. SDL — 3.5% of gross, employer-only, requires ≥10 employees
        // ================================================================
        const sdlRate        = await getSetting('TZ_SDL_RATE', 0.035);
        const sdlMinEmployees = await getSetting('TZ_SDL_MIN_EMPLOYEES', 10);

        // Count active employees in the same org (best-effort, falls back to 0)
        let activeEmployeeCount = 0;
        try {
            // apiDetails should carry orgId from payroll service
            const orgId = apiDetails?.organization_id;
            if (orgId) {
                activeEmployeeCount = await prisma.userDetail.count({
                    where: {
                        organization_id: orgId,
                        exit_date: null,
                        user: { status: true, is_deleted: false },
                    },
                });
            }
        } catch { /* swallow — default to 0 means SDL skipped */ }

        if (activeEmployeeCount >= sdlMinEmployees) {
            const sdlAmount = Math.round(actualGross * sdlRate);
            employerContributions['SDL (3.5%)'] = sdlAmount;
        }

        // ================================================================
        // C. WCF — 0.6% employer contribution on gross labour costs
        // ================================================================
        const wcfRate = await getSetting('TZ_WCF_RATE', 0.006);
        const wcfAmount = Math.round(actualGross * wcfRate);
        employerContributions['WCF (0.6%)'] = wcfAmount;

        // ================================================================
        // D. HESLB — 15% of basic salary (if employee has outstanding loan)
        // ================================================================
        const heslbRate = await getSetting('TZ_HESLB_RATE', 0.15);
        const hasHeslbLoan = apiDetails?.heslb_status === true;
        if (hasHeslbLoan) {
            const heslbDeduction = Math.round(basic * heslbRate);
            localDeductions['HESLB (15%)'] = heslbDeduction;
        }

        // ================================================================
        // E. PAYE — Monthly progressive tax (5 bands)
        // ================================================================
        const residencyStatus = (apiDetails?.residency_status || 'RESIDENT').toUpperCase();
        const personalRelief    = await getSetting('TZ_PERSONAL_RELIEF', 16250);
        const insuranceRelief   = await getSetting('TZ_INSURANCE_RELIEF', 1250);
        const mortgageReliefMax = await getSetting('TZ_MORTGAGE_RELIEF_MAX', 40000);
        const nonResidentRate   = await getSetting('TZ_NON_RESIDENT_RATE', 0.15);

        // Gross annual for PAYE
        const annualGross = actualGross * 12;

        let annualTax = 0;
        let netTaxableIncome = annualGross;

        if (residencyStatus === 'NON_RESIDENT') {
            // Non-resident: flat 15% on gross (no reliefs)
            annualTax = Math.round(annualGross * nonResidentRate);
        } else {
            // ── Resident: progressive tax on taxable income ──────────
            // Statutory exclusions from gross income
            const nssfAnnual = nssfEmployee * 12; // employee NSSF is exempt

            // ── Declaration-based reliefs (annual) ───────────────────
            let insuranceReliefAnnual = insuranceRelief * 12; // default from settings
            let mortgageReliefAnnual = (apiDetails?.mortgage_interest || 0) * 12;
            let disabledReliefAnnual = 0;
            let dependantReliefAnnual = 0;
            let voluntaryPensionAnnual = 0;

            try {
                const orgId = apiDetails?.organization_id;
                if (orgId) {
                    const currentYear = new Date().getFullYear();
                    const currentMonth = new Date().getMonth();
                    const fyStart = currentMonth < 3 ? currentYear - 1 : currentYear;
                    const fyEnd = fyStart + 1;
                    const financialYear = `${fyStart}-${String(fyEnd).slice(-2)}`;

                    const declarations = await prisma.taxDeclaration.findMany({
                        where: {
                            user_id: employeeId,
                            status: 'Approved',
                            financial_year: financialYear,
                            organization_id: orgId,
                        },
                    });

                    if (declarations.length > 0) {
                        // Insurance relief: 10% of actual premium, capped at TSh 300,000/yr (25,000/mo)
                        const insuranceTotal = declarations
                            .filter(d => d.section === 'INSURANCE')
                            .reduce((sum, d) => sum + Number(d.amount), 0);
                        const insuranceReliefCap = await getSetting('TZ_INSURANCE_RELIEF', 1250) * 12;
                        insuranceReliefAnnual = Math.min(insuranceTotal * 0.10, insuranceReliefCap);

                        // Mortgage interest relief: actual interest, capped at TSh 480,000/yr (40,000/mo)
                        const mortgageDeclarations = declarations.filter(d => d.section === 'MORTGAGE');
                        if (mortgageDeclarations.length > 0) {
                            const mortgageTotal = mortgageDeclarations.reduce((sum, d) => sum + Number(d.amount), 0);
                            const mortgageReliefCap = await getSetting('TZ_MORTGAGE_RELIEF_MAX', 40000) * 12;
                            mortgageReliefAnnual = Math.min(mortgageTotal, mortgageReliefCap);
                        }

                        // Disabled person relief: TSh 195,000/yr (16,250/mo) — binary (has cert or not)
                        const hasDisability = declarations.some(d => d.section === 'DISABLED');
                        if (hasDisability) {
                            disabledReliefAnnual = await getSetting('TZ_DISABLED_PERSON_RELIEF', 16250) * 12;
                        }

                        // Dependant relief: TSh 195,000 per dependant, max 4
                        const dependantDeclarations = declarations.filter(d => d.section === 'DEPENDANTS');
                        const maxDependants = 4;
                        const dependantCount = Math.min(dependantDeclarations.length, maxDependants);
                        const dependantReliefPerDep = await getSetting('TZ_PERSONAL_RELIEF', 16250) * 12;
                        dependantReliefAnnual = dependantCount * dependantReliefPerDep;

                        // Voluntary pension: deducted from gross (not capped by relief)
                        const pensionDeclarations = declarations.filter(d => d.section === 'VOLUNTARY_PENSION');
                        voluntaryPensionAnnual = pensionDeclarations.reduce((sum, d) => sum + Number(d.amount), 0);
                    }
                }
            } catch { /* fall back to default reliefs */ }

            // Total reliefs (annual)
            const totalReliefs = (personalRelief * 12) + insuranceReliefAnnual + disabledReliefAnnual + dependantReliefAnnual;

            // Mortgage relief (capped)
            const cappedMortgageRelief = Math.min(mortgageReliefAnnual, mortgageReliefMax * 12);

            // Taxable income = gross - NSSF employee - total reliefs - mortgage relief - voluntary pension
            netTaxableIncome = Math.max(0, annualGross - nssfAnnual - totalReliefs - cappedMortgageRelief - voluntaryPensionAnnual);

            // Load PAYE bands: StatutoryConfig (org-scoped) → system_settings → hardcoded defaults
            const defaultBands: [number | null, number][] = [
                [270000, 0],
                [520000, 0.08],
                [760000, 0.20],
                [1000000, 0.25],
                [null, 0.30],
            ];
            let payeBands: [number | null, number][] = defaultBands;
            let bandsLoaded = false;
            try {
                const orgId = apiDetails?.organization_id;
                if (orgId) {
                    const record = await prisma.statutoryConfig.findFirst({
                        where: {
                            organization_id: orgId,
                            config_type: 'PAYE',
                            key: 'TZ_PAYE_BANDS',
                            is_active: true,
                        },
                        orderBy: { effective_from: 'desc' },
                    });
                    if (record && record.value) {
                        const parsed = JSON.parse(record.value);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            payeBands = parsed;
                            bandsLoaded = true;
                        }
                    }
                }
                if (!bandsLoaded) {
                    const setting = await prisma.systemSetting.findUnique({ where: { key: 'TZ_PAYE_BANDS' } });
                    if (setting && setting.value) {
                        const parsed = JSON.parse(setting.value);
                        if (Array.isArray(parsed) && parsed.length > 0) payeBands = parsed;
                    }
                }
            } catch { /* use defaults */ }

            // Calculate tax using monthly bands applied to monthly taxable income
            const monthlyTaxable = netTaxableIncome / 12;
            let monthlyTax = 0;
            let prevUpper = 0;

            for (const [upper, rate] of payeBands) {
                const upperBound = upper ?? Infinity;
                if (monthlyTaxable <= upperBound) {
                    monthlyTax = (monthlyTaxable - prevUpper) * rate;
                    break;
                }
                prevUpper = upperBound;
            }

            // The cumulative tax for the band that was fully exceeded
            // Need to sum all fully-exceeded bands
            annualTax = 0;
            prevUpper = 0;
            for (const [upper, rate] of payeBands) {
                const upperBound = upper ?? Infinity;
                if (monthlyTaxable > upperBound) {
                    annualTax += (upperBound - prevUpper) * rate;
                    prevUpper = upperBound;
                } else {
                    annualTax += (monthlyTaxable - prevUpper) * rate;
                    break;
                }
            }
            annualTax = Math.round(annualTax * 12); // annualize
        }

        const monthlyTax = Math.round(annualTax / 12);
        if (monthlyTax > 0) {
            localDeductions['PAYE'] = monthlyTax;
        }

        return {
            deductions: localDeductions,
            employerContributions,
            taxInfo: {
                annualIncome: annualGross,
                totalExemptions: residencyStatus === 'NON_RESIDENT' ? 0 : (nssfEmployee * 12 + (personalRelief + insuranceRelief) * 12),
                netTaxableIncome,
                annualTds: annualTax,
                monthlyTds: monthlyTax,
            },
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
