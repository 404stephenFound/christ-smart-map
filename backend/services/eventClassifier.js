// Intelligent Event & Poster Notice Classifier with Named-Entity & Proximity Matching

export const ROLE_DEFINITIONS = [
  { pattern: /\bfaculty\s+co[- ]?ordinator(s)?\b/i, role: 'Faculty Coordinator' },
  { pattern: /\bco[- ]?ordinator(s)?\b/i, role: 'Coordinator' },
  { pattern: /\bconven[oe]r(s)?\b/i, role: 'Convener' },
  { pattern: /\bco[- ]?conven[oe]r(s)?\b/i, role: 'Co-Convener' },
  { pattern: /\b(faculty|staff)?\s*in[- ]?charge\b/i, role: 'Faculty In-Charge' },
  { pattern: /\bresource\s+person(s)?\b/i, role: 'Resource Person' },
  { pattern: /\bkeynote\s+speaker(s)?\b/i, role: 'Keynote Speaker' },
  { pattern: /\bguest\s+speaker(s)?\b/i, role: 'Guest Speaker' },
  { pattern: /\bspeaker(s)?\b/i, role: 'Speaker' },
  { pattern: /\bsession\s+chair(s)?\b/i, role: 'Session Chair' },
  { pattern: /\b(judge|jury\s+member)(s)?\b/i, role: 'Judge' },
  { pattern: /\bpoint\s+of\s+contact\b|\bpoc\b/i, role: 'Point of Contact' },
  { pattern: /\borganizing\s+(?:committee|chair|secretary|team)\b/i, role: 'Organizing Committee' }
];

export const EVENT_CONTEXT_KEYWORDS = [
  /\bconference\b/i,
  /\bsymposium\b/i,
  /\bworkshop\b/i,
  /\bseminar\b/i,
  /\bhackathon\b/i,
  /\bconclave\b/i,
  /\bfest\b/i,
  /\bviva\b/i,
  /\btalk\b/i,
  /\bexhibition\b/i,
  /\binauguration\b/i,
  /\bguest\s+lecture\b/i,
  /\bwebinar\b/i,
  /\bpanel\s+discussion\b/i,
  /\bmeeting\b/i
];

/**
 * Builds all plausible name variations and aliases for a teacher.
 * E.g., "Dr. Stephen Akash J" -> ["Stephen Akash J", "Dr. Stephen Akash J", "Prof. Stephen Akash", "Dr. S. Akash", "Stephen Akash", "Stephen"]
 * @param {string} rawName - The teacher's name.
 * @param {string} email - Optional email for username alias matching.
 * @returns {string[]} Unique array of name permutations.
 */
export const buildTeacherNamePermutations = (rawName, email = '') => {
  if (!rawName || typeof rawName !== 'string') return [];

  const variations = new Set();
  
  // Clean raw input
  const clean = rawName.replace(/^(?:Dr|Prof|Mr|Ms|Mrs|Doctor|Professor)\.?\s+/i, '').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  
  if (tokens.length === 0) return [];

  // Add baseline name
  variations.add(clean.toLowerCase());
  variations.add(rawName.trim().toLowerCase());

  // Salutation variations
  variations.add(`dr. ${clean.toLowerCase()}`);
  variations.add(`dr ${clean.toLowerCase()}`);
  variations.add(`prof. ${clean.toLowerCase()}`);
  variations.add(`prof ${clean.toLowerCase()}`);

  const firstName = tokens[0];
  const lastName = tokens[tokens.length - 1];

  if (tokens.length >= 2) {
    // First + Last
    const firstLast = `${firstName} ${lastName}`.toLowerCase();
    variations.add(firstLast);
    variations.add(`dr. ${firstLast}`);
    variations.add(`prof. ${firstLast}`);

    // Initial variants (e.g. S. Akash or Stephen A.)
    const initialFirst = `${firstName.charAt(0)}. ${lastName}`.toLowerCase();
    const initialLast = `${firstName} ${lastName.charAt(0)}.`.toLowerCase();
    variations.add(initialFirst);
    variations.add(`dr. ${initialFirst}`);
    variations.add(`prof. ${initialFirst}`);
    variations.add(initialLast);
  }

  // Add individual distinct names if long enough (>= 4 letters)
  if (firstName.length >= 4) variations.add(firstName.toLowerCase());
  if (lastName.length >= 4 && lastName !== firstName) variations.add(lastName.toLowerCase());

  // Email alias prefix if available (e.g. stephen.akash@christuniversity.in -> "stephen akash")
  if (email && email.includes('@')) {
    const alias = email.split('@')[0].replace(/[._-]/g, ' ').toLowerCase().trim();
    if (alias.length >= 4) {
      variations.add(alias);
    }
  }

  return Array.from(variations);
};

/**
 * Normalizes and cleans OCR or email text lines.
 */
export const normalizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
};

/**
 * Converts a string to Title Case while preserving technical acronyms and minor prepositions.
 */
export const toTitleCase = (str) => {
  if (!str) return '';
  const minorWords = /^(a|an|and|as|at|but|by|for|in|nor|of|on|or|so|the|to|up|yet|with)$/i;
  const techAcronyms = {
    'ai': 'AI',
    'devops': 'DevOps',
    'ml': 'ML',
    'nlp': 'NLP',
    'iot': 'IoT',
    'api': 'API',
    'it': 'IT',
    'cse': 'CSE',
    'ieee': 'IEEE',
    'acm': 'ACM',
    'phd': 'PhD'
  };

  return str
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (techAcronyms[lower]) {
        return techAcronyms[lower];
      }
      if (index > 0 && minorWords.test(word)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Searches for teacher name in proximity (+/- 3 lines) of role keywords.
 * Selects the closest role match.
 * @param {string} text - The input OCR or email body text.
 * @param {object} teacherInfo - { name, department, email }
 * @returns {object|null} { matchedRole: string, matchedNameVariant: string, confidence: string } or null
 */
export const matchTeacherRoleProximity = (text, teacherInfo = {}) => {
  if (!text || !teacherInfo.name) return null;

  const normalized = normalizeText(text);
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const nameVariants = buildTeacherNamePermutations(teacherInfo.name, teacherInfo.email);

  if (nameVariants.length === 0) return null;

  const candidateMatches = [];

  // 1. Line-by-line sliding window check (+/- 3 lines)
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();

    for (const { pattern, role } of ROLE_DEFINITIONS) {
      if (pattern.test(lineLower)) {
        const minLine = Math.max(0, i - 3);
        const maxLine = Math.min(lines.length - 1, i + 3);

        for (let j = minLine; j <= maxLine; j++) {
          const windowLine = lines[j].toLowerCase();
          for (const variant of nameVariants) {
            const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedVariant}\\b`, 'i');
            if (regex.test(windowLine)) {
              const distance = Math.abs(i - j);
              candidateMatches.push({
                matchedRole: role,
                matchedNameVariant: variant,
                distance,
                confidence: 'high'
              });
            }
          }
        }
      }
    }
  }

  if (candidateMatches.length > 0) {
    // Sort by smallest distance between role line and name line
    candidateMatches.sort((a, b) => a.distance - b.distance);
    return candidateMatches[0];
  }

  return null;
};

/**
 * Extracts Event Title, Venue, Dates, and Timings from poster or email text.
 * @param {string} text - Cleaned text.
 * @returns {object} { eventName, venue, date }
 */
export const extractEventMetadata = (text) => {
  const normalized = normalizeText(text);
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  let eventName = null;
  let venue = null;
  let date = null;

  // --- Extract Event Name ---
  // 1. Look for quoted phrases on a single line
  const quoteMatch = normalized.match(/['"“]([^'"“”\n]{4,60})['"”]/);
  if (quoteMatch) {
    eventName = toTitleCase(quoteMatch[1].trim());
  }

  // 2. Look for academic event pattern on a single line: "National Conference on AI", "Workshop on Cloud Computing"
  if (!eventName) {
    for (const line of lines) {
      const titleRegex = /\b((?:National|International|State-Level|Inter-Collegiate|Annual)?\s*(?:Conference|Symposium|Workshop|Seminar|Hackathon|Conclave|Summit|Fest|Exhibition|Inauguration|Webinar|Guest Lecture)\s+(?:on|about|titled)?\s*[A-Za-z0-9\s&:,-]{3,50})\b/i;
      const titleMatch = line.match(titleRegex);
      if (titleMatch) {
        // Strip trailing punctuation or field labels
        let rawTitle = titleMatch[1].trim();
        rawTitle = rawTitle.replace(/\s+(Date|Venue|Time|Location)[:\-]?.*$/i, '').trim();
        eventName = toTitleCase(rawTitle);
        break;
      }
    }
  }

  // 3. Fallback: Upper-case banner line in top 6 lines of poster
  if (!eventName && lines.length > 0) {
    const topLines = lines.slice(0, 6);
    for (const l of topLines) {
      if (/christ\s*\(/i.test(l) || /department\s+of/i.test(l) || /deemed\s+to\s+be/i.test(l)) {
        continue;
      }
      if (l.length >= 6 && l.length <= 60 && l === l.toUpperCase() && /[A-Z]/.test(l)) {
        eventName = toTitleCase(l);
        break;
      }
    }
  }

  // --- Extract Venue ---
  for (const line of lines) {
    const venueRegex = /\b(?:Venue|Location|Hall|Audi|Place)\s*[:\-]?\s*([A-Za-z0-9\s\-,]{3,40})/i;
    const venueMatch = line.match(venueRegex);
    if (venueMatch) {
      let rawVenue = venueMatch[1].trim().replace(/^(is|at)\s+/i, '');
      rawVenue = rawVenue.replace(/\s+(Date|Time|When)[:\-]?.*$/i, '').trim();
      venue = rawVenue;
      break;
    }
  }

  if (!venue) {
    // Search for common university landmarks
    for (const line of lines) {
      const landmarkRegex = /\b((?:Central|Sky View|Main|KE|Block\s+[A-Z0-9]+|Audi(?:torium)?|Seminar Hall|Room\s+[0-9]+|Lab\s+[0-9]+)[A-Za-z0-9\s\-]{0,25})\b/i;
      const landmarkMatch = line.match(landmarkRegex);
      if (landmarkMatch) {
        venue = landmarkMatch[1].trim();
        break;
      }
    }
  }

  // --- Extract Date ---
  for (const line of lines) {
    const dateRegex = /\b(?:Date|Dates|When)\s*[:\-]?\s*([A-Za-z0-9\s,\-\/]{3,35})|\b(?:On)\s*[:\-]\s*([A-Za-z0-9\s,\-\/]{3,35})/i;
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      let rawDate = (dateMatch[1] || dateMatch[2] || '').trim();
      rawDate = rawDate.replace(/\s+(Venue|Location|Time|Place)[:\-]?.*$/i, '').trim();
      if (rawDate) {
        date = rawDate;
        break;
      }
    }
  }

  if (!date) {
    const specificDateRegex = /\b(\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–to]\s*\d{1,2}(?:st|nd|rd|th)?)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|Today|Tomorrow)\b/i;
    const sDateMatch = normalized.match(specificDateRegex);
    if (sDateMatch) {
      date = sDateMatch[1].trim();
    }
  }

  return { eventName, venue, date };
};

/**
 * Synthesizes a clean, standard status notice string without emojis.
 */
export const buildSuggestedNotice = (role, eventName, venue, date) => {
  const cleanEvent = eventName ? eventName.trim() : 'Campus Event';
  let action = 'Coordinating';

  if (role) {
    if (/speaker|resource\s+person/i.test(role)) action = 'Speaker at';
    else if (/chair|judge/i.test(role)) action = 'Chairing';
    else if (/convener/i.test(role)) action = 'Convening';
    else if (/organizing/i.test(role)) action = 'Organizing';
  }

  let notice = `Away - ${action} ${cleanEvent}`;

  if (venue) {
    notice += ` at ${venue.trim()}`;
  }

  if (date) {
    notice += ` (${date.trim()})`;
  }

  return notice.replace(/\s+/g, ' ').trim();
};

/**
 * Primary classification entry point for an email/poster document.
 * @param {string} subject - Email subject or filename.
 * @param {string} body - Email body or OCR/PDF extracted text.
 * @param {object} teacherInfo - { name, department, email }
 * @param {string} sourceType - 'poster' | 'pdf' | 'text'
 * @returns {object} Structured classification result.
 */
export const classifyEmail = (subject = '', body = '', teacherInfo = {}, sourceType = 'text') => {
  const fullText = `${subject || ''}\n${body || ''}`;
  const normalized = normalizeText(fullText);

  // 1. Proximity matching against teacher's name
  let proximityMatch = null;
  if (teacherInfo && teacherInfo.name) {
    proximityMatch = matchTeacherRoleProximity(normalized, teacherInfo);
  }

  // 2. Generic Role & Context check (for emails directly written by or sent to the teacher)
  let hasRole = !!proximityMatch;
  let detectedRole = proximityMatch ? proximityMatch.matchedRole : null;

  if (!hasRole) {
    for (const { pattern, role } of ROLE_DEFINITIONS) {
      if (pattern.test(normalized)) {
        hasRole = true;
        detectedRole = role;
        break;
      }
    }
  }

  let hasEventContext = false;
  for (const regex of EVENT_CONTEXT_KEYWORDS) {
    if (regex.test(normalized)) {
      hasEventContext = true;
      break;
    }
  }

  if (hasRole && hasEventContext) {
    const { eventName, venue, date } = extractEventMetadata(normalized);
    const suggestedNotice = buildSuggestedNotice(detectedRole, eventName, venue, date);

    return {
      matchFound: true,
      role: detectedRole,
      eventName: eventName || 'Campus Event',
      venue: venue || null,
      date: date || null,
      suggestedNotice,
      sourceType,
      confidence: proximityMatch ? 'high' : 'medium'
    };
  }

  return {
    matchFound: false,
    role: null,
    eventName: null,
    venue: null,
    date: null,
    suggestedNotice: null,
    sourceType,
    confidence: 'none'
  };
};
