import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generateExitDocument = async (type: 'RELIEVING' | 'EXPERIENCE', data: any) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `${type}_${data.employeeId}_${Date.now()}.pdf`;
    const dir = path.join(__dirname, '../../public/documents/exit');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Letterhead
    doc.fontSize(20).text('LATTIUM TECH PVT LTD', { align: 'center' });
    doc.fontSize(10).text('Corporate Office: HSR Layout, Bangalore, Karnataka', { align: 'center' });
    doc.moveDown(2);

    // Date
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(1);

    // Subject
    const subject = type === 'RELIEVING' ? 'SUBJECT: RELIEVING LETTER' : 'SUBJECT: EXPERIENCE CERTIFICATE';
    doc.fontSize(14).font('Helvetica-Bold').text(subject, { align: 'center', underline: true });
    doc.moveDown(2);

    // Content
    doc.font('Helvetica').fontSize(12).text(`To Whom It May Concern,`, { align: 'left' });
    doc.moveDown(1);

    if (type === 'RELIEVING') {
      doc.text(`This is to certify that Mr./Ms. ${data.name}, Employee ID: ${data.employeeId}, who was working with us as ${data.designation} in the ${data.department} department, has been relieved from the services of the company with effect from the close of business hours on ${data.lwd}.`);
      doc.moveDown(1);
      doc.text(`We further confirm that all his/her dues have been settled in full. We wish him/her all the best for future endeavors.`);
    } else {
      doc.text(`This is to certify that Mr./Ms. ${data.name} was employed with Lattium Tech Pvt Ltd from ${data.joinDate} to ${data.lwd}.`);
      doc.moveDown(1);
      doc.text(`During his/her tenure as ${data.designation}, we found him/her to be hardworking, dedicated and a valuable member of the team. His/her conduct during the period of employment was exemplary.`);
      doc.moveDown(1);
      doc.text(`We wish him/her success in all future professional pursuits.`);
    }

    doc.moveDown(4);
    doc.text('For Lattium Tech Pvt Ltd,');
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text('Authorized Signatory');
    doc.font('Helvetica').text('Human Resources Department');

    doc.end();

    stream.on('finish', () => {
      resolve(`/public/documents/exit/${fileName}`);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
};
