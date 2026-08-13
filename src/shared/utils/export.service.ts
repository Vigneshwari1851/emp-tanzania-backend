import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export class ExportService {
  async generateCSV(data: Record<string, unknown>[]): Promise<Buffer> {
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    return Buffer.from(csv);
  }

  // async generateExcel(data: Record<string, unknown>[]): Promise<Buffer> {
  //   const workbook = new ExcelJS.Workbook();
  //   const worksheet = workbook.addWorksheet('Employees');

  //   if (data.length > 0) {
  //     // 1. Add Custom Title Header
  //     const titleRow = worksheet.addRow(['EMPLOYEE LIST']);
  //     titleRow.font = { name: 'Arial', size: 16, bold: true };

  //     worksheet.addRow([]); // Empty spacing row

  //     // 2. Extract Columns dynamically from data so we never alter the values
  //     const availableKeys = Object.keys(data[0]);

  //     // 3. Setup Columns
  //     worksheet.columns = availableKeys.map(key => ({
  //       header: key,
  //       key: key,
  //       width: 20 // Standard width
  //     }));

  //     // Make Title span exactly the mapped columns count
  //     const lastColIndex = String.fromCharCode(64 + availableKeys.length); // e.g. 'J' or 'N' depending on cols
  //     try { worksheet.unMergeCells('A1:J1'); } catch (e) { }
  //     try { worksheet.mergeCells(`A1:${lastColIndex}1`); } catch (e) { }

  //     // 4. Style Header Row (which is now row 3)
  //     const headerRow = worksheet.getRow(3);
  //     headerRow.eachCell((cell) => {
  //       cell.fill = {
  //         type: 'pattern',
  //         pattern: 'solid',
  //         fgColor: { argb: 'FF1C4E80' } // Dark blue from image
  //       };
  //       cell.font = {
  //         color: { argb: 'FFFFFFFF' },
  //         bold: true
  //       };
  //       cell.alignment = { vertical: 'middle', horizontal: 'center' };
  //       cell.border = {
  //         top: { style: 'thin' },
  //         left: { style: 'thin' },
  //         bottom: { style: 'thin' },
  //         right: { style: 'thin' }
  //       };
  //     });

  //     // 5. Add Data & Style Data Cells
  //     data.forEach(item => {
  //       const row = worksheet.addRow(item);
  //       row.eachCell((cell) => {
  //         cell.border = {
  //           top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  //           left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  //           bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  //           right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
  //         };
  //         cell.alignment = { vertical: 'middle', horizontal: 'left' };
  //       });
  //     });

  //     // Thick border below title manually handling borders for row 1
  //     worksheet.getRow(1).eachCell((cell) => {
  //       cell.border = { bottom: { style: 'thick', color: { argb: 'FF000000' } } };
  //     });
  //   }

  //   const buffer = await workbook.xlsx.writeBuffer();
  //   return Buffer.from(buffer);
  // }

  async generateExcel(data: Record<string, unknown>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employee Directory');

    if (data.length > 0) {
      const keys = Object.keys(data[0]);

      const getColumnLetter = (colIndex: number) => {
        let temp, letter = '';
        while (colIndex > 0) {
          temp = (colIndex - 1) % 26;
          letter = String.fromCharCode(temp + 65) + letter;
          colIndex = (colIndex - temp - 1) / 26;
        }
        return letter;
      };
      const lastColLetter = getColumnLetter(keys.length);

      const titleRow = worksheet.addRow(['Employee List']);
      titleRow.height = 30;
      worksheet.mergeCells(`A1:${lastColLetter}1`);

      const titleCell = worksheet.getCell('A1');
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF203764' }
      };

      const dateString = new Date().toLocaleString();
      const subTitleRow = worksheet.addRow([`Generated on: ${dateString}`]);
      worksheet.mergeCells(`A2:${lastColLetter}2`);

      const dateCell = worksheet.getCell('A2');
      dateCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF595959' } };
      dateCell.alignment = { vertical: 'middle', horizontal: 'right' };

      worksheet.addRow([]);

      worksheet.columns = keys.map(key => ({
        key: key,
        width: 25
      }));

      const headerRow = worksheet.getRow(4);

      keys.forEach((key, index) => {
        headerRow.getCell(index + 1).value = key.toUpperCase().replace(/_/g, ' ');
      });

      headerRow.height = 25;
      headerRow.eachCell(cell => {
        cell.font = {
          name: 'Arial',
          color: { argb: 'FF000000' },
          bold: true,
          size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          top: { style: 'thin', color: { argb: 'FFE2E2E2' } }
        };
      });

      data.forEach((item, index) => {
        const row = worksheet.addRow(item);
        row.height = 20;

        row.eachCell(cell => {
          cell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E2E2' } }
          };

          // Alternating row color
          if (index % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9F9F9' }
            };
          }
        });
      });

      worksheet.views = [{ state: 'frozen', ySplit: 4 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePDF(data: Record<string, unknown>[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Title & Meta
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#1F4E78').text('Employee Data Report', 40, 40);

      const dateString = new Date().toLocaleString();
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#595959').text(`Generated on: ${dateString}`, 40, 65);

      if (data.length === 0) {
        doc.moveDown(3);
        doc.fontSize(12).font('Helvetica').fillColor('#000000').text('No data available', { align: 'center' });
        doc.end();
        return;
      }

      const keys = Object.keys(data[0]);
      const availableWidth = 761;
      const colWidth = availableWidth / keys.length;

      let yPos = 100;
      const startX = 40;
      const rowHeight = 24;
      const headerRowHeight = 32;

      const drawHeader = (y: number) => {
        doc.rect(startX, y, availableWidth, headerRowHeight).fill('#203764');
        let xPos = startX;
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#FFFFFF');
        keys.forEach(key => {
          const formattedKey = key.toUpperCase().replace(/_/g, ' ');
          doc.text(formattedKey, xPos + 2, y + 6, {
            width: colWidth - 4,
            align: 'center',
            lineBreak: true
          });
          xPos += colWidth;
        });
      };

      drawHeader(yPos);
      yPos += headerRowHeight;

      doc.lineWidth(0.5);

      data.forEach((row, index) => {
        let maxLines = 1;
        doc.font('Helvetica').fontSize(8);
        keys.forEach(key => {
          const text = String(row[key] || '');
          const height = doc.heightOfString(text, { width: colWidth - 8 });
          const lines = Math.ceil(height / 9.5); // approx height per line
          if (lines > maxLines) maxLines = lines;
        });

        const dynamicRowHeight = Math.max(rowHeight, maxLines * 12 + 8);

        // Page break logic
        if (yPos + dynamicRowHeight > 550) {
          doc.addPage();
          yPos = 40;
          drawHeader(yPos);
          yPos += headerRowHeight;
        }

        // Row Background
        const bgColor = index % 2 === 0 ? '#F9F9F9' : '#FFFFFF';
        doc.rect(startX, yPos, availableWidth, dynamicRowHeight).fill(bgColor);

        // Row Bottom Border
        doc.moveTo(startX, yPos + dynamicRowHeight).lineTo(startX + availableWidth, yPos + dynamicRowHeight).strokeColor('#E2E2E2').stroke();

        let xPos = startX;
        doc.fontSize(7).font('Helvetica').fillColor('#333333');
        keys.forEach(key => {
          const text = String(row[key] || '');
          doc.text(text, xPos + 4, yPos + 6, {
            width: colWidth - 8,
            align: 'left',
            lineBreak: true
          });
          xPos += colWidth;
        });

        yPos += dynamicRowHeight;
      });

      doc.end();
    });
  }
}

export const exportService = new ExportService();
