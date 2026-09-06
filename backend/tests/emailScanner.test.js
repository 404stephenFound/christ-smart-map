import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findAttachments } from '../services/emailScanner.js';
import { extractTextFromPDF } from '../services/posterOCR.js';

describe('Email Scanner & Attachment Discovery Suite', () => {

  test('recursively discovers image and PDF attachments from MIME payload', () => {
    const mockMimePayload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'text/plain',
          body: { data: Buffer.from('Email body').toString('base64') }
        },
        {
          filename: 'poster_ai_symposium.png',
          mimeType: 'image/png',
          body: { attachmentId: 'att_img_123' }
        },
        {
          mimeType: 'multipart/related',
          parts: [
            {
              filename: 'event_circular.pdf',
              mimeType: 'application/pdf',
              body: { attachmentId: 'att_pdf_456' }
            },
            {
              filename: 'banner_flyer.jpg',
              mimeType: 'image/jpeg',
              body: { attachmentId: 'att_img_789' }
            }
          ]
        }
      ]
    };

    const attachments = findAttachments(mockMimePayload);

    assert.equal(attachments.length, 3);
    assert.equal(attachments[0].filename, 'poster_ai_symposium.png');
    assert.equal(attachments[0].type, 'image');
    assert.equal(attachments[1].filename, 'event_circular.pdf');
    assert.equal(attachments[1].type, 'pdf');
    assert.equal(attachments[2].filename, 'banner_flyer.jpg');
    assert.equal(attachments[2].type, 'image');
  });

  test('extractTextFromPDF returns empty string safely on null or invalid buffer', async () => {
    const emptyResult = await extractTextFromPDF(null);
    assert.equal(emptyResult, '');

    const invalidResult = await extractTextFromPDF('not_a_buffer');
    assert.equal(invalidResult, '');
  });
});
