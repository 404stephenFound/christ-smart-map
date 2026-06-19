import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Simple Levenshtein distance for fuzzy name matching
function getEditDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Compute fuzzy similarity score (0 to 1)
function getSimilarity(a, b) {
  const distance = getEditDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

// Tokenize and find names in query
function matchTeacherByName(query, teachers) {
  const normalizedQuery = query.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ');
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

  let bestMatch = null;
  let highestScore = 0;
  const matches = [];

  for (const teacher of teachers) {
    const teacherNameLower = teacher.name.toLowerCase();
    const cleanName = teacherNameLower.replace(/(dr\.|prof\.|mr\.|ms\.|mrs\.)/g, '').trim();
    const nameParts = cleanName.split(/\s+/).filter(w => w.length > 2);

    let teacherScore = 0;

    // Direct substring check
    if (queryWords.some(word => cleanName.includes(word))) {
      teacherScore += 0.5;
    }

    // Fuzzy matching on name parts
    for (const part of nameParts) {
      for (const word of queryWords) {
        // High similarity match
        const sim = getSimilarity(part, word);
        if (sim > 0.75) {
          teacherScore += sim;
        }
      }
    }

    if (teacherScore > 0.4) {
      matches.push({ teacher, score: teacherScore });
      if (teacherScore > highestScore) {
        highestScore = teacherScore;
        bestMatch = teacher;
      }
    }
  }

  // Sort matches by highest score
  matches.sort((a, b) => b.score - a.score);

  return {
    bestMatch: highestScore > 0.5 ? bestMatch : null,
    allMatches: matches.map(m => m.teacher).slice(0, 3),
  };
}

// Main chatbot logic endpoint
router.post('/', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'Query is required' });
  }

  const sanitizeBotResponse = (text) => {
    if (!text) return text;
    // Remove double asterisks
    let cleaned = text.replace(/\*\*/g, '');
    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1D100}-\u{1D1FF}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F900}-\u{1F9FF}]/gu, '');
    return cleaned;
  };

  const sendCleanResponse = (data) => {
    if (data && typeof data.reply === 'string') {
      data.reply = sanitizeBotResponse(data.reply);
    }
    return res.json(data);
  };

  try {
    // 1. Fetch all teachers for search index
    const result = await pool.query(
      `SELECT id, name, email, designation, department, cabin_number, status, status_notice, timetable_url, schedule_data 
       FROM teachers`
    );
    const teachers = result.rows;

    const normalizedQuery = query.toLowerCase();

    // Intent check: Simple greeting
    const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'yo'];
    const cleanQuery = normalizedQuery.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").trim();
    if (greetings.includes(cleanQuery) || cleanQuery === 'hello bot' || cleanQuery === 'hi bot') {
      return sendCleanResponse({
        reply: `Hello student! What would you like to know?`,
        type: 'text'
      });
    }

    // 2. Identify Intent
    let intent = 'general';
    if (
      normalizedQuery.includes('status') ||
      normalizedQuery.includes('available') ||
      normalizedQuery.includes('present') ||
      normalizedQuery.includes('in cabin') ||
      normalizedQuery.includes('in office') ||
      normalizedQuery.includes('where') ||
      normalizedQuery.includes('is in') ||
      normalizedQuery.includes('find')
    ) {
      intent = 'status_or_cabin';
    } else if (
      normalizedQuery.includes('timetable') ||
      normalizedQuery.includes('schedule') ||
      normalizedQuery.includes('time table') ||
      normalizedQuery.includes('class')
    ) {
      intent = 'timetable';
    }

    // 3. Check for specific targets in the query

    // Intent check A0: Specific Block search (e.g., "block 1", "architecture block", "devdan block")
    const blocksList = [
      'block 1', 'block 2', 'block 3', 'block 4', 'block 5', 'block 6',
      'architecture block', 'devdan block'
    ];
    let matchedBlock = null;
    for (const b of blocksList) {
      if (normalizedQuery.includes(b)) {
        matchedBlock = b;
        break;
      }
    }

    if (matchedBlock) {
      const matchedBlockTeachers = teachers.filter(t => 
        t.cabin_number.toLowerCase().includes(matchedBlock.toLowerCase())
      );

      await pool.query(
        'INSERT INTO chat_logs (query, intent) VALUES ($1, $2)',
        [query, 'block_lookup']
      );

      if (matchedBlockTeachers.length > 0) {
        return sendCleanResponse({
          reply: `Here are the teachers located in ${matchedBlock.toUpperCase()}:`,
          teachers: matchedBlockTeachers,
          type: 'teacher_list',
        });
      } else {
        return sendCleanResponse({
          reply: `No teachers are currently registered in ${matchedBlock.toUpperCase()}.`,
          type: 'text',
        });
      }
    }

    // Intent check A: Cabin search (e.g., "who is in room 402" or "who is in cabin 402")
    const cabinMatch = normalizedQuery.match(/(?:room|cabin|block|office)\s*([a-zA-Z0-9\-]+)/i) || 
                       normalizedQuery.match(/\b\d{3,4}[a-zA-Z]?\b/);
    if (cabinMatch) {
      const cabinQuery = cabinMatch[1] || cabinMatch[0];
      const matchedCabinTeachers = teachers.filter(t => 
        t.cabin_number.toLowerCase().includes(cabinQuery.toLowerCase())
      );

      if (matchedCabinTeachers.length > 0) {
        // Log query
        await pool.query(
          'INSERT INTO chat_logs (query, matched_teacher_id, intent) VALUES ($1, $2, $3)',
          [query, matchedCabinTeachers[0].id, 'cabin_lookup']
        );

        return sendCleanResponse({
          reply: `Here are the teachers located in cabin/room ${cabinQuery}:`,
          teachers: matchedCabinTeachers,
          type: 'teacher_list',
        });
      }
    }

    // Intent check B: Department search
    const deptMappings = {
      'cse': 'CSE',
      'cs': 'CSE',
      'computer science': 'CSE',
      'adse': 'ADSE',
      'electronics': 'Electronics',
      'electrical': 'Electrical',
      'eletcrical': 'Electrical',
      'mechanical': 'Mechanical',
      'mech': 'Mechanical',
      'robotics & mechatronics': 'Robotics & Mechatronics',
      'robotics and megatronics': 'Robotics & Mechatronics',
      'robotics': 'Robotics & Mechatronics',
      'megatronics': 'Robotics & Mechatronics',
      'mechatronics': 'Robotics & Mechatronics',
      'psychology': 'Psychology',
      'pycollogigy': 'Psychology',
      'bba': 'BBA',
      'sciences & humanities': 'Sciences & Humanities',
      'sciences and humanity': 'Sciences & Humanities',
      'sciences': 'Sciences & Humanities',
      'humanities': 'Sciences & Humanities',
      'humanity': 'Sciences & Humanities',
      'civil': 'Civil',
    };

    let matchedDept = null;
    const sortedMappingKeys = Object.keys(deptMappings).sort((a, b) => b.length - a.length);
    for (const key of sortedMappingKeys) {
      if (normalizedQuery.includes(key)) {
        matchedDept = deptMappings[key];
        break;
      }
    }

    if (matchedDept) {
      const matchedDeptTeachers = teachers.filter(t => 
        t.department.toLowerCase() === matchedDept.toLowerCase()
      );

      if (matchedDeptTeachers.length > 0) {
        await pool.query(
          'INSERT INTO chat_logs (query, intent) VALUES ($1, $2)',
          [query, 'dept_lookup']
        );

        return sendCleanResponse({
          reply: `Here are the teachers in the ${matchedDept.toUpperCase()} department:`,
          teachers: matchedDeptTeachers,
          type: 'teacher_list',
        });
      }
    }

    // Intent check C: General list of available teachers
    if (normalizedQuery.includes('available') && (normalizedQuery.includes('list') || normalizedQuery.includes('who is') || normalizedQuery.includes('any'))) {
      const availableTeachers = teachers.filter(t => t.status === 'AVAILABLE');
      if (availableTeachers.length > 0) {
        return sendCleanResponse({
          reply: `Here are the teachers currently available in their cabins right now:`,
          teachers: availableTeachers,
          type: 'teacher_list',
        });
      } else {
        return sendCleanResponse({
          reply: `There are currently no teachers marked as Available in their cabins. Try searching for a specific teacher's return time.`,
          type: 'text',
        });
      }
    }

    // Intent check D: Match specific teacher
    const { bestMatch, allMatches } = matchTeacherByName(query, teachers);

    if (bestMatch) {
      // Log the search
      await pool.query(
        'INSERT INTO chat_logs (query, matched_teacher_id, intent) VALUES ($1, $2, $3)',
        [query, bestMatch.id, intent]
      );

      let statusMsg = '';
      const statusLower = bestMatch.status.toLowerCase();

      switch (statusLower) {
        case 'available':
          statusMsg = `Available in cabin right now.`;
          break;
        case 'in_class':
          statusMsg = `Currently in a Class.`;
          break;
        case 'in_meeting':
          statusMsg = `Currently in a Meeting.`;
          break;
        case 'phd_viva':
          statusMsg = `Conducting a PhD Viva.`;
          break;
        case 'away':
          statusMsg = `Currently Away from the cabin.`;
          break;
        default:
          statusMsg = `Marked as ${bestMatch.status}.`;
      }

      if (bestMatch.status_notice) {
        statusMsg += `\n\nNotice from teacher: "${bestMatch.status_notice}"`;
      }

      let reply = `Here is the information for ${bestMatch.name} (${bestMatch.designation}, ${bestMatch.department}):\n\n`;
      reply += `Cabin Location: ${bestMatch.cabin_number}\n`;
      reply += `Current Status: ${statusMsg}\n\n`;

      if (intent === 'timetable') {
        if (bestMatch.timetable_url) {
          reply += `You can view the timetable below.`;
        } else {
          reply += `Timetable file is not uploaded yet for this teacher.`;
        }
      }

      return sendCleanResponse({
        reply,
        teachers: [bestMatch],
        intent_request: intent,
        type: 'teacher_details',
      });
    }

    // Match suggestion list (if there are close matches, but none are definitive)
    if (allMatches.length > 0) {
      return sendCleanResponse({
        reply: `Did you mean one of these teachers?`,
        teachers: allMatches,
        type: 'suggestions',
      });
    }

    // Fallback response for unhandled input
    return sendCleanResponse({
      reply: `I could not find a teacher or cabin matching your query. 

Try asking:
1. Where is Dr. Smith's cabin?
2. Who is in cabin 402?
3. Is anyone available in CSE?
4. Show me the timetable for Prof. Johnson`,
      type: 'fallback',
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Server error processing chatbot query' });
  }
});

export default router;
