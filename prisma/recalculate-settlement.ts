import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vigneshExit = await prisma.exitRequest.findFirst({
    where: {
      user: {
        details: {
          first_name: { contains: 'Vignesh' }
        }
      }
    },
    include: {
      settlement_data: true,
      user: {
        include: {
          details: true
        }
      }
    }
  });

  if (vigneshExit) {
    console.log(`Found Vigneshwari's Exit Request [ID: ${vigneshExit.id}]`);
    console.log('Current Settlement Status:', vigneshExit.settlement_data);

    // Let's delete the settlement_data or update it directly with the new auto-populate values!
    const userDetail = vigneshExit.user.details;
    let autoLoanRecovery = 0;
    let autoAdvanceRecovery = 0;
    if (userDetail?.compensation_breakdown) {
      const cb = typeof userDetail.compensation_breakdown === 'string'
        ? JSON.parse(userDetail.compensation_breakdown)
        : (userDetail.compensation_breakdown as any);
      autoLoanRecovery = Number(cb.outstanding_loan || cb.loan_balance || 0);
      autoAdvanceRecovery = Number(cb.outstanding_advance || cb.advance_balance || 0);
    }

    console.log('Seeded recovery values:', { autoAdvanceRecovery, autoLoanRecovery });

    if (vigneshExit.settlement_data) {
      const totalEarnings = Number(vigneshExit.settlement_data.total_earnings || 0);
      const noticePay = Number(vigneshExit.settlement_data.notice_pay || 0);
      const totalDeductions = (noticePay < 0 ? Math.abs(noticePay) : 0) + autoAdvanceRecovery + autoLoanRecovery;
      const netPayable = totalEarnings - totalDeductions;

      const existingData = (vigneshExit.settlement_data.data as any) || {};

      await prisma.exitSettlement.update({
        where: { exit_request_id: vigneshExit.id },
        data: {
          total_deductions: totalDeductions,
          net_payable: netPayable,
          data: {
            ...existingData,
            salaryAdvanceRecovery: autoAdvanceRecovery,
            loanRecovery: autoLoanRecovery,
            additionalDeductions: 0
          }
        }
      });
      console.log('Successfully recalculated and saved Vigneshwari\'s settlement in DB!');
    }
  } else {
    console.log('Vigneshwari exit request not found.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
