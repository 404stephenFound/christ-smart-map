// Keyword-based event notice classifier (local, no external API cost)

const ROLE_KEYWORDS = [
  /\bin[- ]charge\s+of\b/i,
  /\bcoordinating\b/i,
  /\bcoordinator\s+for\b/i,
  /\bpoint\s+of\s+contact\b/i,
  /\bpoc\s+for\b/i,
  /\borganizing\s+committee\b/i,
  /\bconvener\b/i,
  /\bfaculty\s+in[- ]charge\b/i,
  /\bcoordinator\b/i,
  /\borganizer\b/i
];

const EVENT_CONTEXT_KEYWORDS = [
  /\bfest\b/i,
  /\bseminar\b/i,
  /\bworkshop\b/i,
  /\bviva\b/i,
  /\btalk\b/i,
  /\bconference\b/i,
  /\bsymposium\b/i,
  /\bhackathon\b/i,
  /\bconclave\b/i,
  /\bexhibition\b/i,
  /\binauguration\b/i,
  /\bguest\s+lecture\b/i,
  /\bwebinar\b/i,
  /\bmeeting\b/i
];

const DATE_KEYWORDS = [
  /\btoday\b/i,
  /\btomorrow\b/i,
  /\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i
];

const PREPS = [
  /coordinating/i,
  /coordinator\s+for/i,
  /poc\s+for/i,
  /convener\s+for/i,
  /in[- ]charge\s+of/i,
  /in[- ]charge\s+for/i
];

/**
 * Extracts a candidate event name from the text around matched keywords.
 * @param {string} text - The input text.
 * @returns {string|null} The extracted event name or null.
 */
function extractEventName(text) {
  // 1. Look for quoted strings first, as they often contain precise titles
  const quoteMatch = text.match(/['"“]([^'"“”]{3,50})['"”]/);
  if (quoteMatch) {
    return quoteMatch[1].trim();
  }

  // 2. Look for capitalized words immediately following coordinating prepositions (allowing optional lowercase articles)
  for (const prep of PREPS) {
    const match = text.match(prep);
    if (match) {
      const startIndex = match.index + match[0].length;
      const followingText = text.substring(startIndex).trim();
      
      const fillerMatch = followingText.match(/^(?:the|a|an|our|their|for|of)\s+/i);
      const searchStart = fillerMatch ? fillerMatch[0].length : 0;
      const remainingText = followingText.substring(searchStart).trim();
      
      const capMatch = remainingText.match(/^([A-Z][a-zA-Z0-9]*(?:\s+[A-Z0-9][a-zA-Z0-9]*)*)/);
      if (capMatch) {
        const phrase = capMatch[1].trim();
        if (phrase.length >= 3) {
          return phrase;
        }
      }
    }
  }

  // 3. Fallback: Look for capitalized words ending in an event context keyword (casing-sensitive, no /i flag)
  const capitalizedEventRegex = /\b([A-Z][a-zA-Z0-9]*(?:\s+[A-Z0-9][a-zA-Z0-9]*)*\s+(?:Fest|Seminar|Workshop|Viva|Talk|Conference|Symposium|Hackathon|Conclave|Exhibition|Inauguration|Webinar|Meeting))\b/;
  const capMatch = text.match(capitalizedEventRegex);
  if (capMatch) {
    return capMatch[1].trim();
  }

  return null;
}

/**
 * Clean up text by removing extra spaces and standardizing quotes.
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

/**
 * Classifies a subject and body to see if the teacher is in-charge of an event.
 * @param {string} subject - Email subject.
 * @param {string} body - Email body.
 * @returns {object} { matchFound: boolean, suggestedNotice: string|null, sourceType: string }
 */
export const classifyEmail = (subject, body) => {
  const cleanSubject = cleanText(subject);
  const cleanBody = cleanText(body);
  const fullText = `${cleanSubject} | ${cleanBody}`;

  let hasRole = false;
  let hasEventContext = false;
  let hasDate = false;

  // Check role keywords
  for (const regex of ROLE_KEYWORDS) {
    if (regex.test(fullText)) {
      hasRole = true;
      break;
    }
  }

  // Check event context keywords
  for (const regex of EVENT_CONTEXT_KEYWORDS) {
    if (regex.test(fullText)) {
      hasEventContext = true;
      break;
    }
  }

  // Check date keywords
  for (const regex of DATE_KEYWORDS) {
    if (regex.test(fullText)) {
      hasDate = true;
      break;
    }
  }

  // Gating rule: We require a role match AND an event context match.
  if (hasRole && hasEventContext) {
    // Try to extract an event name
    let eventName = extractEventName(fullText);
    
    // Capitalize properly if found
    if (eventName) {
      // Capitalize first letter of each word
      eventName = eventName.replace(/\b[a-z]/g, (char) => char.toUpperCase());
    } else {
      // Generic fallback based on matching keyword
      eventName = 'Campus Event';
      for (const rx of EVENT_CONTEXT_KEYWORDS) {
        const match = fullText.match(rx);
        if (match) {
          eventName = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
          break;
        }
      }
    }

    // Format the suggested notice (no emojis!)
    const suggestedNotice = `Away - Coordinating ${eventName}`;

    return {
      matchFound: true,
      suggestedNotice,
      sourceType: 'text',
    };
  }

  return {
    matchFound: false,
    suggestedNotice: null,
    sourceType: 'text',
  };
};
