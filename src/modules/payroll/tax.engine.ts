import prisma from '../../config/prisma';

export class TaxEngine {
    static async getSetting(key: string, fallback: number): Promise<number> {
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
     * Calculates Net Taxable Income by applying exemptions and deductions.
     * Takes into account PriorEmploymentIncome if present.
     */
    static async calculateTaxableIncome(
        employeeId: number, 
        annualGross: number, 
        taxRegime: 'Old' | 'New' = 'Old',
        annualBasic: number = 0,
        annualHRA: number = 0,
        isMetro: boolean = false,
        orgId?: number
    ) {
        // Standard Deduction loaded from system settings
        const standardDeductionKey = taxRegime === 'New' ? 'STANDARD_DEDUCTION_NEW' : 'STANDARD_DEDUCTION_OLD';
        const standardDeductionFallback = taxRegime === 'New' ? 75000 : 50000;
        const standardDeduction = await this.getSetting(standardDeductionKey, standardDeductionFallback);
        
        let totalExemptions = 0;
        let totalChapterVIDeductions = 0;

        if (taxRegime === 'Old') {
            // Determine active financial year
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth(); // 0-indexed
            let startYear = currentYear;
            if (currentMonth < 3) {
                startYear = currentYear - 1;
            }
            const endYearShort = (startYear + 1) % 100;
            const currentFinancialYear = `${startYear}-${endYearShort.toString().padStart(2, '0')}`;

            // Fetch approved tax declarations for the employee in the current financial year
            const declarations = await prisma.taxDeclaration.findMany({
                where: { 
                    user_id: employeeId, 
                    status: 'approved',
                    financial_year: currentFinancialYear
                }
            });

            const sections = await prisma.taxSection.findMany({
                where: { status: true, ...(orgId ? { organization_id: orgId } : {}) }
            });
            const sectionLimits: Record<string, number> = {};
            sections.forEach(s => sectionLimits[s.section] = Number(s.limit));

            const sectionTotals: Record<string, number> = {};
            declarations.forEach(decl => {
                const secKey = decl.section;
                if (!sectionTotals[secKey]) sectionTotals[secKey] = 0;
                sectionTotals[secKey] += Number(decl.amount);
            });

            // Process global 80C + 80CCC + 80CCD(1) limit (1.5 Lakh standard, loaded from settings)
            const section80CSum = (sectionTotals['80C'] || 0) + (sectionTotals['80CCC'] || 0) + (sectionTotals['80CCD(1)'] || 0);
            const global80CLimit = await this.getSetting('GLOBAL_80C_LIMIT', 150000);
            const capped80C = Math.min(section80CSum, global80CLimit);

            // Cap declarations by section limits (skipping 80C sections and Rent sections)
            Object.keys(sectionTotals).forEach(secKey => {
                if (['80C', '80CCC', '80CCD(1)', 'RENT', 'HRA_RENT'].includes(secKey)) return;
                const declared = sectionTotals[secKey];
                const limit = sectionLimits[secKey] || 0;
                if (limit > 0) {
                    totalChapterVIDeductions += Math.min(declared, limit);
                } else {
                    totalChapterVIDeductions += declared;
                }
            });

            totalChapterVIDeductions += capped80C;

            // Extract Rent Paid for HRA Exemption (Assuming 'RENT' or 'HRA_RENT' as the section code)
            const rentPaid = sectionTotals['RENT'] || sectionTotals['HRA_RENT'] || 0;
            if (rentPaid > 0 && annualHRA > 0) {
                const hraExemption = await this.calculateHRAExemption(annualBasic, annualHRA, rentPaid, isMetro);
                totalExemptions += hraExemption;
            }
        }

        // Fetch Prior Employment Income
        const priorIncomeRecords = await prisma.priorEmploymentIncome.findMany({
            where: { user_id: employeeId }
        });
        
        const priorGross = priorIncomeRecords.reduce((acc, rec) => acc + Number(rec.gross_income), 0);
        // Note: TDS already paid would be factored in the final tax liability calculation
        const priorTdsPaid = priorIncomeRecords.reduce((acc, rec) => acc + Number(rec.tds_deducted), 0);

        const totalAnnualIncome = annualGross + priorGross;
        const netTaxableIncome = Math.max(0, totalAnnualIncome - standardDeduction - totalExemptions - totalChapterVIDeductions);

        return {
            netTaxableIncome,
            totalExemptions,
            totalChapterVIDeductions,
            priorTdsPaid
        };
    }

    /**
     * Calculates the Tax Liability based on the Tax Regime Slabs
     */
    static async calculateTaxLiability(netTaxableIncome: number, taxRegime: 'Old' | 'New' = 'Old') {
        let annualTds = 0;

        // Load dynamic slabs from settings
        const settingKey = taxRegime === 'New' ? 'TAX_SLABS_NEW' : 'TAX_SLABS_OLD';
        const fallbackSlabs = taxRegime === 'New' 
            ? [[0,300000,0],[300000,600000,0.05],[600000,900000,0.10],[900000,1200000,0.15],[1200000,1500000,0.20],[1500000,null,0.30]]
            : [[0,250000,0],[250000,500000,0.05],[500000,1000000,0.20],[1000000,null,0.30]];

        let slabs: [number, number | null, number][] = [];
        try {
            const setting = await prisma.systemSetting.findUnique({
                where: { key: settingKey }
            });
            if (setting && setting.value) {
                slabs = JSON.parse(setting.value);
            } else {
                slabs = fallbackSlabs as any;
            }
        } catch (error) {
            console.error(`Error loading tax slabs for ${settingKey}, using fallback:`, error);
            slabs = fallbackSlabs as any;
        }

        // Calculate tax based on progressive slabs
        for (const slab of slabs) {
            const min = slab[0];
            const max = slab[1] === null ? Infinity : slab[1];
            const rate = slab[2];

            if (netTaxableIncome > min) {
                const taxableAmountInSlab = Math.min(netTaxableIncome - min, max - min);
                annualTds += taxableAmountInSlab * rate;
            }
        }

        // Section 87A rebate calculation
        if (taxRegime === 'Old') {
            const rebateLimit = await this.getSetting('REBATE_87A_LIMIT_OLD', 500000);
            const rebateAmount = await this.getSetting('REBATE_87A_AMOUNT_OLD', 12500);
            if (netTaxableIncome <= rebateLimit) {
                annualTds = Math.max(0, annualTds - rebateAmount);
            }
        } else {
            const rebateLimit = await this.getSetting('REBATE_87A_LIMIT_NEW', 700000);
            const rebateAmount = await this.getSetting('REBATE_87A_AMOUNT_NEW', 25000);
            if (netTaxableIncome <= rebateLimit) {
                annualTds = Math.max(0, annualTds - rebateAmount);
            }
        }

        // Calculate Surcharge on tax (applicable for income > 50 Lakhs)
        let surchargeRate = 0;
        const surchargeThreshold5Cr = await this.getSetting('SURCHARGE_THRESHOLD_5CR', 50000000);
        const surchargeThreshold2Cr = await this.getSetting('SURCHARGE_THRESHOLD_2CR', 20000000);
        const surchargeThreshold1Cr = await this.getSetting('SURCHARGE_THRESHOLD_1CR', 10000000);
        const surchargeThreshold50L = await this.getSetting('SURCHARGE_THRESHOLD_50L', 5000000);
        const surchargeRate5CrNew = await this.getSetting('SURCHARGE_RATE_5CR_NEW', 0.15);
        const surchargeRate5CrOld = await this.getSetting('SURCHARGE_RATE_5CR_OLD', 0.37);
        const surchargeRate2Cr = await this.getSetting('SURCHARGE_RATE_2CR', 0.25);
        const surchargeRate1Cr = await this.getSetting('SURCHARGE_RATE_1CR', 0.15);
        const surchargeRate50L = await this.getSetting('SURCHARGE_RATE_50L', 0.10);

        if (netTaxableIncome > surchargeThreshold5Cr) {
            surchargeRate = taxRegime === 'New' ? surchargeRate5CrNew : surchargeRate5CrOld;
        } else if (netTaxableIncome > surchargeThreshold2Cr) {
            surchargeRate = surchargeRate2Cr;
        } else if (netTaxableIncome > surchargeThreshold1Cr) {
            surchargeRate = surchargeRate1Cr;
        } else if (netTaxableIncome > surchargeThreshold50L) {
            surchargeRate = surchargeRate50L;
        }

        if (surchargeRate > 0 && annualTds > 0) {
            annualTds += annualTds * surchargeRate;
        }

        // Add Health and Education Cess (4% of Tax + Surcharge)
        const cessRate = await this.getSetting('CESS_RATE', 0.04);
        if (annualTds > 0) {
            annualTds += annualTds * cessRate;
        }

        return annualTds;
    }

    /**
     * Calculates monthly TDS taking into account prior TDS paid
     */
    static calculateMonthlyTDS(annualTds: number, priorTdsPaid: number, monthsRemaining: number = 12) {
        const remainingTdsLiability = Math.max(0, annualTds - priorTdsPaid);
        if (monthsRemaining <= 0) return 0;
        return Math.round(remainingTdsLiability / monthsRemaining);
    }

    /**
     * Calculates HRA Exemption under Section 10(13A).
     * Exemption is minimum of:
     * 1. Actual HRA received
     * 2. 50% of Basic (Metro) or 40% of Basic (Non-Metro)
     * 3. Rent paid minus 10% of Basic
     */
    static async calculateHRAExemption(annualBasic: number, annualHRA: number, annualRentPaid: number, isMetro: boolean = false) {
        if (annualRentPaid <= 0 || annualHRA <= 0 || annualBasic <= 0) return 0;
        
        const metroPercent = await this.getSetting('HRA_METRO_PERCENT', 0.50);
        const nonMetroPercent = await this.getSetting('HRA_NON_METRO_PERCENT', 0.40);
        const rentBasicPercent = await this.getSetting('HRA_RENT_BASIC_PERCENT', 0.10);
        
        const limit1 = annualHRA;
        const limit2 = isMetro ? (annualBasic * metroPercent) : (annualBasic * nonMetroPercent);
        const limit3 = Math.max(0, annualRentPaid - (annualBasic * rentBasicPercent));
        
        return Math.min(limit1, limit2, limit3);
    }
}
