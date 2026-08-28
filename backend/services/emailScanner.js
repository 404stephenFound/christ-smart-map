import { google } from 'googleapis';
import { extractTextFromImage } from './posterOCR.js';
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
      body += decoded + ' ';
    } else if (part.mimeType === 'text/html') {
      // Strip simple HTML tags to avoid HTML pollution in classification
      const plain = decoded.replace(/<[^>]*>/g, ' ');
      body += plain + ' ';
    }
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      body += getMessageBody(subPart);
    }
  }
  return body;
}

// Recursive helper to locate image attachment metadata (PNG, JPG, JPEG)
function findImageAttachments(part, list = []) {
  if (part.body && part.body.attachmentId) {
    const mime = part.mimeType || '';
    if (mime.startsWith('image/')) {
      list.push({
        id: part.body.attachmentId,
        mimeType: mime,
        filename: part.filename || 'attachment'
      });
    }
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      findImageAttachments(subPart, list);
    }
  }
  return list;
}

/**
 * Scans the teacher's Gmail inbox for recent event/coordinator notifications.
 * Processes both text body and image attachments using OCR.
 * @param {string} refreshToken - The decrypted OAuth2 refresh token.
 * @param {string} redirectUri - The Google OAuth Redirect URL.
 * @returns {Promise<object>} Result matching `{ matchFound: boolean, suggestedNotice: string|null, sourceType: string }`
 */
export const scanRecentEmails = async (refreshToken, redirectUri) => {
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
      maxResults: 10 // process last 10 messages max to keep latency bounded
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
      
      // Extract Text Body
      const bodyText = getMessageBody(payload);
      
      // First pass: Run classifier directly on Subject + Text Body
      const textResult = classifyEmail(subject, bodyText);
      if (textResult.matchFound) {
        return {
          matchFound: true,
          suggestedNotice: textResult.suggestedNotice,
          sourceType: 'text'
        };
      }
      
      // Second pass: OCR on image attachments (if text body had no matches)
      const imageAttachments = findImageAttachments(payload);
      for (const att of imageAttachments) {
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msgInfo.id,
            id: att.id
          });
          
          if (attRes.data && attRes.data.data) {
            // Convert base64url data to image buffer
            const imageBuffer = Buffer.from(attRes.data.data, 'base64');
            
            // Extract text from the attachment via local OCR
            const ocrText = await extractTextFromImage(imageBuffer);
            
            if (ocrText && ocrText.trim().length > 0) {
              const ocrResult = classifyEmail(subject, ocrText);
              if (ocrResult.matchFound) {
                return {
                  matchFound: true,
                  suggestedNotice: ocrResult.suggestedNotice,
                  sourceType: 'poster'
                };
              }
            }
          }
        } catch (ocrErr) {
          console.error(`Failed to process attachment ${att.filename} via OCR:`, ocrErr);
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
