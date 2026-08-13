import prisma from '../../config/prisma';

export class StatutoryEngine {
    static async getSetting(key: string, fallback: number): Promise<number> {
        try {
            const setting = await prisma.systemSetting.findUnique({
                where: { key }
            });
            if (setting && setting.value) {
                const val = parseFloat(setting.value);
                if (!isNaN(val)) {
                    // Auto-normalize percentage values: if fallback < 1 and value > 1, treat as percentage
                    if (fallback < 1 && val > 1) return val / 100;
                    return val;
                }
            }
        } catch (error) {
            console.error(`Error loading system setting for ${key}:`, error);
        }
        return fallback;
    }

    static async calculatePT(grossSalary: number, state: string = 'Maharashtra') {
        try {
            const ptRecords = await prisma.stateProfessionalTax.findMany();
            const ptRecord = ptRecords.find(r => r.state.toLowerCase() === state.toLowerCase());
            
            if (ptRecord && Array.isArray(ptRecord.slabs)) {
                const slabs = ptRecord.slabs as any[];
                for (const slab of slabs) {
                    const min = parseFloat(slab.min) || 0;
                    const max = slab.max === null || slab.max === undefined ? Infinity : (parseFloat(slab.max) || Infinity);
                    const amount = parseFloat(slab.amount) || 0;
                    
                    if (grossSalary >= min && grossSalary <= max) {
                        return amount;
                    }
                }
            } else {
                // If state is not found in the database, it means that state does not levy PT
                return 0;
            }
        } catch (error) {
            console.error("Error querying dynamic PT slabs, falling back to defaults:", error);
        }

        let ptAmount = 0;
        // Fallback standard PT calculation (Maharashtra logic as default)
        if (grossSalary > 12000) ptAmount = 200;
        else if (grossSalary > 9000) ptAmount = 150;
        else if (grossSalary > 7500) ptAmount = 100;

        return ptAmount;
    }

    /**
     * EPF Calculation (Employee 12%, Employer 3.67%, EPS 8.33%)
     */
    static async calculateEPF(basicSalary: number, isOptedForHigherPension: boolean = false) {
        // Fetch parameters dynamically from System Settings
        const wageCeiling = await this.getSetting('EPF_WAGE_CEILING', 15000);
        const employeeRate = await this.getSetting('EPF_EMPLOYEE_RATE', 0.12);
        const epsRate = await this.getSetting('EPF_EMPLOYER_EPS_RATE', 0.0833);
        
        // Calculate Employee contribution (12% of basic)
        const employeeContribution = Math.round(basicSalary * employeeRate);
        
        // Calculate Employer EPS (8.33% capped at wage ceiling)
        const epsApplicableSalary = Math.min(basicSalary, wageCeiling);
        const employerEPS = Math.round(epsApplicableSalary * epsRate);
        
        // Calculate Employer EPF (Balance of 12%)
        const employerEPF = employeeContribution - employerEPS;

        return {
            employeeEPF: employeeContribution,
            employerEPF,
            employerEPS,
            totalEmployerContribution: employerEPF + employerEPS
        };
    }

    /**
     * ESI Calculation (Employee 0.75%, Employer 3.25%)
     */
    static async calculateESI(grossSalary: number) {
        // Fetch parameters dynamically from System Settings
        const esiWageCeiling = await this.getSetting('ESI_WAGE_CEILING', 21000);
        const employeeRate = await this.getSetting('ESI_EMPLOYEE_RATE', 0.0075);
        const employerRate = await this.getSetting('ESI_EMPLOYER_RATE', 0.0325);
        
        if (grossSalary > esiWageCeiling) {
            return {
                employeeESI: 0,
                employerESI: 0
            };
        }

        const employeeESI = Math.round(grossSalary * employeeRate);
        const employerESI = Math.round(grossSalary * employerRate);

        return {
            employeeESI,
            employerESI
        };
    }

    /**
     * LWF Calculation (Labour Welfare Fund)
     * Varies state-wise, usually deducted in June (month 5) and December (month 11).
     */
    static async calculateLWF(grossSalary: number, state: string = 'Maharashtra', date: Date = new Date()) {
        const month = date.getMonth(); // 0 = Jan, 5 = June, 11 = Dec
        
        // Fetch LWF configuration dynamically from settings
        // By default, LWF Maharashtra: Employee Rs 25, Employer Rs 75 deducted in June & December
        const stateKey = state.toUpperCase().replace(/\s+/g, '_');
        const defaultDeductMonths = [5, 11]; // June & Dec
        
        // Load settings
        let deductMonths = defaultDeductMonths;
        try {
            const monthsSetting = await prisma.systemSetting.findUnique({
                where: { key: `LWF_DEDUCT_MONTHS_${stateKey}` }
            });
            if (monthsSetting && monthsSetting.value) {
                deductMonths = JSON.parse(monthsSetting.value);
            }
        } catch (e) {
            console.error(`Error loading LWF months for ${state}:`, e);
        }

        if (!deductMonths.includes(month)) {
            return { employeeLWF: 0, employerLWF: 0 };
        }

        const employeeShare = await this.getSetting(`LWF_EMPLOYEE_SHARE_${stateKey}`, state.toLowerCase() === 'karnataka' ? 20 : 25);
        const employerShare = await this.getSetting(`LWF_EMPLOYER_SHARE_${stateKey}`, state.toLowerCase() === 'karnataka' ? 40 : 75);

        // Standard LWF eligibility check (e.g. if grossSalary > 0)
        if (grossSalary > 0) {
            return {
                employeeLWF: employeeShare,
                employerLWF: employerShare
            };
        }

        return { employeeLWF: 0, employerLWF: 0 };
    }

    /**
     * UAE End of Service Benefit (EOSB) / Gratuity
     * - Under 1 year: 0
     * - 1 to 5 years: 21 days of basic salary per year
     * - More than 5 years: 30 days of basic salary per year after the first 5 years
     */
    static calculateUAE_EOSB(basicSalary: number, tenureDays: number): number {
        const years = tenureDays / 365.25;
        if (years < 1) return 0;
        
        const dailyRate = basicSalary / 30;
        let gratuity = 0;
        
        if (years <= 5) {
            gratuity = dailyRate * 21 * years;
        } else {
            gratuity = (dailyRate * 21 * 5) + (dailyRate * 30 * (years - 5));
        }
        
        return Math.round(gratuity);
    }

    /**
     * India Gratuity (Payment of Gratuity Act 1972)
     * - Eligible after 5 years (4 years and 240 days / 190 days in mines count as 5 years)
     * - Formula: (Last drawn Basic + DA) * 15 / 26 * Completed years of service
     */
    static calculateIndianGratuity(basicSalary: number, tenureDays: number): number {
        const years = tenureDays / 365.25;
        // In practice, 4.8 years (4 years and 240 days) is rounded to 5 years for eligibility
        if (years < 4.8) return 0;
        
        const completedYears = Math.round(years);
        const gratuity = (basicSalary * 15 / 26) * completedYears;
        
        return Math.round(gratuity);
    }
}
