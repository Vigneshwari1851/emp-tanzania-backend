import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface PdfComponent {
  type: string;
  amount: number;
  currency: string;
  frequency: string;
  description?: string;
}

export interface PdfOfferData {
  offerId: string;
  versionNumber: number;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  joiningDate: Date;
  expiryDate: Date;
  workLocation: string;
  workMode: string;
  probationPeriod: number;
  reportingManager: string;
  noticeClauses?: string;
  confidentiality?: string;
  employmentConds?: string;
  additionalTerms?: string;
  compensation: PdfComponent[];
  isDraft: boolean;
}

export class OfferPdfGenerator {
  static async generate(data: PdfOfferData): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const dir = path.join(__dirname, '../../public/documents/offers');
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileName = `offer_${data.offerId}_v${data.versionNumber}.pdf`;
      const filePath = path.join(dir, fileName);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Draw Header Accent Bar
      doc.rect(0, 0, doc.page.width, 25).fill('#3F51B5'); // Premium primary

      // Watermark for draft
      if (data.isDraft) {
        doc.save();
        doc.fontSize(80).fillColor('#E0E0E0').opacity(0.15);
        doc.translate(doc.page.width / 2, doc.page.height / 2);
        doc.rotate(-45);
        doc.text('DRAFT ONLY', -250, -40, { width: 500, align: 'center' });
        doc.restore();
      }

      doc.fillColor('#212121'); // Reset text color

      // Company Info (Top Left)
      doc.font('Helvetica-Bold').fontSize(22).text('LATTIUM TECH PVT LTD', 50, 50);
      doc.font('Helvetica').fontSize(9).fillColor('#666666')
         .text('Enterprise ATS Recruitment System\nCorporate Office: HSR Layout, Bangalore, KA, India', 50, 75);

      // Offer Letter Title (Top Right)
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#3F51B5')
         .text('OFFER OF EMPLOYMENT', 350, 50, { align: 'right', width: 212 });
      doc.font('Helvetica').fontSize(9).fillColor('#666666')
         .text(`Offer Ref: ${data.offerId.substring(0, 8).toUpperCase()}\nVersion: ${data.versionNumber}\nDate: ${new Date().toLocaleDateString()}`, 350, 68, { align: 'right', width: 212 });

      doc.moveDown(3);
      doc.strokeColor('#E0E0E0').lineWidth(1).moveTo(50, 110).lineTo(562, 110).stroke();

      // Salutation
      doc.fillColor('#212121').font('Helvetica-Bold').fontSize(11).text('Dear ' + data.candidateName + ',', 50, 130);
      doc.font('Helvetica').fontSize(10).fillColor('#424242')
         .text(`We are pleased to offer you the position of ${data.jobTitle} at Lattium Tech Pvt Ltd. We were impressed by your performance during the interview process, and we are excited about the prospect of you joining our team.`, 50, 150, { width: 512, align: 'justify', lineGap: 3 });

      // Offer Terms Section
      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#3F51B5').text('EMPLOYMENT DETAILS');
      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(562, doc.y + 2).stroke();
      doc.moveDown(0.8);

      const startY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666');
      doc.text('Proposed Start Date:', 50, startY);
      doc.text('Reporting Manager:', 50, startY + 16);
      doc.text('Work Location:', 50, startY + 32);
      doc.text('Work Mode:', 50, startY + 48);
      doc.text('Probation Period:', 50, startY + 64);

      doc.font('Helvetica').fillColor('#212121');
      doc.text(new Date(data.joiningDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 180, startY);
      doc.text(data.reportingManager, 180, startY + 16);
      doc.text(data.workLocation, 180, startY + 32);
      doc.text(data.workMode, 180, startY + 48);
      doc.text(data.probationPeriod > 0 ? `${data.probationPeriod} Months` : 'None', 180, startY + 64);

      doc.moveDown(2);

      // Compensation Section
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#3F51B5').text('COMPENSATION SUMMARY');
      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(562, doc.y + 2).stroke();
      doc.moveDown(0.8);

      // Render Compensation Table
      const tableTop = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666');
      doc.text('Component Type', 60, tableTop);
      doc.text('Description', 200, tableTop);
      doc.text('Frequency', 380, tableTop);
      doc.text('Amount', 480, tableTop, { align: 'right', width: 70 });

      doc.strokeColor('#BDBDBD').lineWidth(1).moveTo(50, tableTop + 14).lineTo(562, tableTop + 14).stroke();

      let currentY = tableTop + 20;
      doc.font('Helvetica').fontSize(9).fillColor('#212121');
      let totalAnnual = 0;

      data.compensation.forEach((comp) => {
        const amt = Number(comp.amount);
        const annualAmt = comp.frequency === 'MONTHLY' ? amt * 12 : amt;
        totalAnnual += annualAmt;

        doc.text(comp.type.replace('_', ' '), 60, currentY);
        doc.text(comp.description || 'Standard component', 200, currentY, { width: 170 });
        doc.text(comp.frequency, 380, currentY);
        doc.text(`${comp.currency} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 480, currentY, { align: 'right', width: 70 });

        currentY += 18;
      });

      doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(50, currentY).lineTo(562, currentY).stroke();
      currentY += 6;

      const offerCurrency = data.compensation?.[0]?.currency || 'USD';
      doc.font('Helvetica-Bold');
      doc.text('Total Annual CTC', 60, currentY);
      doc.text(`${offerCurrency} ${totalAnnual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 480, currentY, { align: 'right', width: 70 });

      // Terms page or bottom clauses
      doc.moveDown(4);

      if (data.noticeClauses || data.confidentiality || data.employmentConds || data.additionalTerms) {
        doc.addPage();
        // Second Page accent bar
        doc.rect(0, 0, doc.page.width, 15).fill('#3F51B5');
        
        doc.fillColor('#212121').font('Helvetica-Bold').fontSize(12).text('TERMS AND CONDITIONS', 50, 40);
        doc.strokeColor('#E0E0E0').lineWidth(0.5).moveTo(50, 54).lineTo(562, 54).stroke();
        doc.moveDown(1);

        doc.fontSize(9.5).fillColor('#424242');
        if (data.noticeClauses) {
          doc.font('Helvetica-Bold').text('Notice Period & Termination:').font('Helvetica')
             .text(data.noticeClauses, { align: 'justify', lineGap: 2 }).moveDown(1);
        }
        if (data.confidentiality) {
          doc.font('Helvetica-Bold').text('Confidentiality & Non-Disclosure:').font('Helvetica')
             .text(data.confidentiality, { align: 'justify', lineGap: 2 }).moveDown(1);
        }
        if (data.employmentConds) {
          doc.font('Helvetica-Bold').text('Conditions of Employment:').font('Helvetica')
             .text(data.employmentConds, { align: 'justify', lineGap: 2 }).moveDown(1);
        }
        if (data.additionalTerms) {
          doc.font('Helvetica-Bold').text('Additional Terms:').font('Helvetica')
             .text(data.additionalTerms, { align: 'justify', lineGap: 2 }).moveDown(1);
        }
      }

      // Acceptance / Signature Block
      doc.moveDown(3);
      doc.fillColor('#212121').font('Helvetica-Bold').fontSize(10).text('Acceptance of Offer', { underline: true });
      doc.font('Helvetica').fontSize(9).fillColor('#666666')
         .text(`This offer remains valid until ${new Date(data.expiryDate).toLocaleDateString()}. To accept, please sign and submit your acceptance via the candidate portal before the expiry date.`, { align: 'justify', lineGap: 2 });
      doc.moveDown(3.5);

      const signY = doc.y;
      doc.strokeColor('#9E9E9E').lineWidth(0.75).moveTo(50, signY).lineTo(200, signY).stroke();
      doc.strokeColor('#9E9E9E').lineWidth(0.75).moveTo(350, signY).lineTo(500, signY).stroke();

      doc.font('Helvetica-Bold').fillColor('#212121').fontSize(9);
      doc.text('Lattium Tech Pvt Ltd', 50, signY + 6);
      doc.text(data.candidateName, 350, signY + 6);

      doc.font('Helvetica').fillColor('#666666');
      doc.text('Authorized Signatory', 50, signY + 18);
      doc.text('Candidate Signature', 350, signY + 18);

      doc.end();

      stream.on('finish', () => {
        resolve(`/public/documents/offers/${fileName}`);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }
}
