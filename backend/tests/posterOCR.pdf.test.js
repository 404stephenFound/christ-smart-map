import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromPDF } from '../services/posterOCR.js';

/**
 * Builds a minimal, valid, uncompressed PDF containing a single line of text,
 * so the PDF path can be exercised without committing a binary fixture.
 */
const makePdf = (text) => {
  const content = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
};

// Regression: pdf-parse v2 exports a PDFParse class rather than a callable, so the
// previous `await pdfParse(buffer)` threw and every circular yielded empty text.
test('extractTextFromPDF returns real text from a PDF circular', async () => {
  const buffer = makePdf('Faculty Coordinator: Dr. Stephen Akash - AI Workshop');
  const text = await extractTextFromPDF(buffer);

  assert.ok(text.length > 0, 'expected non-empty text from the PDF');
  assert.match(text, /Faculty Coordinator/);
  assert.match(text, /Stephen Akash/);
});

test('extractTextFromPDF handles invalid input without throwing', async () => {
  assert.equal(await extractTextFromPDF(null), '');
  assert.equal(await extractTextFromPDF('not a buffer'), '');
  assert.equal(await extractTextFromPDF(Buffer.from('this is not a pdf')), '');
});
