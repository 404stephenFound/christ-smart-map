import { google } from 'googleapis';
import { extractTextFromImage, extractTextFromPDF, extractWithGeminiVision } from './posterOCR.js';
import { classifyEmail } from './eventClassifier.js';

// Helper to get OAuth2 client
export const getOAuth2Client = (redirectUri) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

// Recursive helper to extract plain text body from email message parts
function getMessageBody(part) {
  let body = '';
  if (part.body && part.body.data) {
    const decoded = Buffer.from(part.body.data, 'base64').toString('utf8');
    if (part.mimeType === 'text/plain') {
      body += decoded + '\n';
    } else if (part.mimeType === 'text/html') {
      // Strip HTML tags to extract clean text
      const plain = decoded.replace(/<[^>]*>/g, ' ');
      body += plain + '\n';
    }
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      body += getMessageBody(subPart);
    }
  }
  return body;
}

// Recursive helper to locate image & PDF attachment metadata
export function findAttachments(part, list = []) {
  if (part.body && part.body.attachmentId) {
    const mime = (part.mimeType || '').toLowerCase();
    const filename = part.filename || 'attachment';

    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(filename)) {
      list.push({
        id: part.body.attachmentId,
        mimeType: mime || 'image/jpeg',
        filename,
        type: 'image'
      });
    } else if (mime === 'application/pdf' || /\.pdf$/i.test(filename)) {
      list.push({
        id: part.body.attachmentId,
        mimeType: 'application/pdf',
        filename,
        type: 'pdf'
      });
    }
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      findAttachments(subPart, list);
    }
  }
  return list;
}

/**
 * Scans the teacher's Gmail inbox for recent event notifications, posters, and circulars.
 * @param {string} refreshToken - The decrypted OAuth2 refresh token.
 * @param {string} redirectUri - The Google OAuth Redirect URL.
 * @param {object} teacherInfo - Logged-in teacher profile { name, department, email }.
 * @returns {Promise<object>} Structured result matching { matchFound, suggestedNotice, role, eventName, venue, date, sourceType, sourceFileName }
 */
export const scanRecentEmails = async (refreshToken, redirectUri, teacherInfo = {}) => {
  const oauth2Client = getOAuth2Client(redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Calculate timestamp for 48 hours ago
  const afterTimestampSeconds = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000);
  const query = `after:${afterTimestampSeconds}`;
  
  try {
    // List messages
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 15 // Process up to 15 recent messages
    });
    
    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      return { matchFound: false, suggestedNotice: null, sourceType: 'none' };
    }
    
    for (const msgInfo of messages) {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: msgInfo.id
      });
      
      const payload = msgRes.data.payload;
      if (!payload) continue;
      
      // Extract Subject from headers
      const headers = payload.headers || [];
      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
      const subject = subjectHeader ? subjectHeader.value : '';
      
      // 1. Check Attachments First (since university posters often carry the actual faculty roles)
      const attachments = findAttachments(payload);

      for (const att of attachments) {
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msgInfo.id,
            id: att.id
          });
          
          if (attRes.data && attRes.data.data) {
            const buffer = Buffer.from(attRes.data.data, 'base64');
            
            if (att.type === 'image') {
              // A. Try Gemini Vision if configured
              const visionResult = await extractWithGeminiVision(buffer, att.mimeType, teacherInfo);
              if (visionResult && visionResult.matchFound && visionResult.suggestedNotice) {
                return {
                  ...visionResult,
                  sourceType: 'poster',
                  sourceFileName: att.filename
                };
              }

              // B. Fallback to Local Tesseract OCR
              const ocrText = await extractTextFromImage(buffer);
              if (ocrText && ocrText.trim().length > 0) {
                const ocrResult = classifyEmail(subject, ocrText, teacherInfo, 'poster');
                if (ocrResult.matchFound) {
                  return {
                    ...ocrResult,
                    sourceFileName: att.filename
                  };
                }
              }
            } else if (att.type === 'pdf') {
              // PDF Document Extraction
              const pdfText = await extractTextFromPDF(buffer);
              if (pdfText && pdfText.trim().length > 0) {
                const pdfResult = classifyEmail(subject, pdfText, teacherInfo, 'pdf');
                if (pdfResult.matchFound) {
                  return {
                    ...pdfResult,
                    sourceFileName: att.filename
                  };
                }
              }
            }
          }
        } catch (attErr) {
          console.error(`Failed to process attachment ${att.filename}:`, attErr.message);
        }
      }

      // 2. Check Text Body if no attachments matched
      const bodyText = getMessageBody(payload);
      if (bodyText && bodyText.trim().length > 0) {
        const textResult = classifyEmail(subject, bodyText, teacherInfo, 'text');
        if (textResult.matchFound) {
          return {
            ...textResult,
            sourceFileName: null
          };
        }
      }
    }
    
    // Checked all messages, no coordinator matches found
    return { matchFound: false, suggestedNotice: null, sourceType: 'none' };
  } catch (error) {
    console.error('Error during Gmail inbox scanning:', error);
    throw error;
  }
};
