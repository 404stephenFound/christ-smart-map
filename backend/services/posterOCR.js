import { createWorker } from 'tesseract.js';

/**
 * Performs local OCR on an image file path or buffer using tesseract.js.
 * @param {string|Buffer} imageInput - The local file path or image Buffer.
 * @returns {Promise<string>} The extracted text content.
 */
export const extractTextFromImage = async (imageInput) => {
  if (!imageInput) return '';

  let worker = null;
  try {
    // Initialize tesseract worker for English
    worker = await createWorker('eng');
    
    // Recognize text
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
