import { createWorker } from 'tesseract.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Performs local OCR on an image file path or buffer using tesseract.js.
 * @param {string|Buffer} imageInput - The local file path or image Buffer.
 * @returns {Promise<string>} The extracted text content.
 */
export const extractTextFromImage = async (imageInput) => {
  if (!imageInput) return '';

  let worker = null;
  try {
    worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageInput);
    return text || '';
  } catch (error) {
    console.error('Error during local OCR extraction:', error);
    return '';
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (termErr) {
        console.error('Error terminating OCR worker:', termErr);
      }
    }
  }
};

/**
 * Extracts plain text from a PDF Buffer (e.g. university circulars, brochures).
 * @param {Buffer} pdfBuffer - The PDF file buffer.
 * @returns {Promise<string>} The extracted text.
 */
export const extractTextFromPDF = async (pdfBuffer) => {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) return '';

  try {
    const data = await pdfParse(pdfBuffer);
    return data && data.text ? data.text : '';
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
};

/**
 * Optional: Uses Gemini Vision to directly parse high-complexity graphical posters.
 * Uses native fetch without extra external packages.
 * @param {Buffer} imageBuffer - The image file buffer.
 * @param {string} mimeType - The image mime type (e.g., image/png, image/jpeg).
 * @param {object} teacherInfo - The logged in teacher's profile info.
 * @returns {Promise<object|null>} Extracted structured event notice, or null if API key not set or failed.
 */
export const extractWithGeminiVision = async (imageBuffer, mimeType, teacherInfo = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !imageBuffer) return null;

  try {
    const base64Data = imageBuffer.toString('base64');
    const teacherName = teacherInfo.name || 'Faculty';

    const prompt = `You are an intelligent university event notice classifier for Christ University.
Analyze this event poster / flyer image.
Check if the faculty member "${teacherName}" (or variations like Dr. / Prof. / initials) is mentioned in any role such as Faculty Coordinator, Convener, Organizing Committee, Resource Person, Speaker, Session Chair, or In-Charge.

Respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{
  "matchFound": true or false,
  "role": "Detected role or null",
  "eventName": "Event Title or null",
  "date": "Extracted dates or null",
  "venue": "Extracted venue/hall or null",
  "suggestedNotice": "Away - Coordinating [Event] at [Venue] ([Date])" or null
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini Vision API returned status:', response.status);
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText.trim());
    return parsed;
  } catch (error) {
    console.error('Gemini Vision extraction error:', error.message);
    return null;
  }
};
