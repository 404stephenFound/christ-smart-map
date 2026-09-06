import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeacherNamePermutations,
  matchTeacherRoleProximity,
  extractEventMetadata,
  buildSuggestedNotice,
  classifyEmail
} from '../services/eventClassifier.js';

describe('Event & Poster Classifier Intelligence Suite', () => {

  describe('Teacher Name Permutations Builder', () => {
    test('generates salutations, initials, and token variants', () => {
      const variants = buildTeacherNamePermutations('Dr. Stephen Akash J', 'stephen.akash@christuniversity.in');
      
      assert.ok(variants.includes('stephen akash j'));
      assert.ok(variants.includes('dr. stephen akash j'));
      assert.ok(variants.includes('prof. stephen akash j'));
      assert.ok(variants.includes('s. j'));
      assert.ok(variants.includes('stephen'));
      assert.ok(variants.includes('stephen akash'));
    });

    test('handles single name or simple strings gracefully', () => {
      const variants = buildTeacherNamePermutations('Stephen');
      assert.ok(variants.includes('stephen'));
      assert.ok(variants.includes('dr. stephen'));
    });

    test('returns empty array for invalid input', () => {
      assert.deepEqual(buildTeacherNamePermutations(''), []);
      assert.deepEqual(buildTeacherNamePermutations(null), []);
    });
  });

  describe('Proximity-Based Role & Name Matcher', () => {
    const teacherInfo = {
      name: 'Stephen Akash',
      email: 'stephen.akash@christuniversity.in',
      department: 'Computer Science'
    };

    test('matches role when teacher is listed 1-2 lines below Faculty Coordinators', () => {
      const posterOCRText = `
        CHRIST (Deemed to be University)
        Department of Computer Science
        NATIONAL SYMPOSIUM ON ARTIFICIAL INTELLIGENCE
        Date: 15th October 2026 | Venue: Central Block Auditorium
        Chief Guest: Dr. A. P. Sharma
        Faculty Coordinators:
        Dr. Stephen Akash, Assistant Professor
        Dr. Kavita Menon, Associate Professor
        Student Coordinators: John Doe, Jane Doe
      `;

      const result = matchTeacherRoleProximity(posterOCRText, teacherInfo);
      assert.ok(result, 'Should match teacher within role window');
      assert.equal(result.matchedRole, 'Faculty Coordinator');
      assert.equal(result.confidence, 'high');
    });

    test('matches role when teacher is on the same line as Convener', () => {
      const circularText = `
        Event: Faculty Development Programme
        Convener: Dr. Stephen Akash (Dept of CS)
        Co-Convener: Prof. Ramesh
      `;

      const result = matchTeacherRoleProximity(circularText, teacherInfo);
      assert.ok(result);
      assert.equal(result.matchedRole, 'Convener');
    });

    test('does NOT match if a different teacher is coordinator', () => {
      const unrelatedPoster = `
        NATIONAL CONFERENCE ON DATA SCIENCE
        Venue: Sky View Audi
        Faculty Coordinators:
        Dr. Anand Verma
        Dr. Priya Sharma
      `;

      const result = matchTeacherRoleProximity(unrelatedPoster, teacherInfo);
      assert.equal(result, null, 'Should not match unrelated faculty names');
    });

    test('does NOT match if role is outside proximity window (> 4 lines apart)', () => {
      const disconnectedText = `
        Faculty Coordinators:
        Line 1
        Line 2
        Line 3
        Line 4
        Line 5
        Line 6
        Stephen Akash
      `;

      const result = matchTeacherRoleProximity(disconnectedText, teacherInfo);
      assert.equal(result, null);
    });
  });

  describe('Event Metadata Extractor', () => {
    test('extracts title, venue, and dates from poster text', () => {
      const text = `
        CHRIST (Deemed to be University)
        National Workshop on Cloud Computing and DevOps
        Date: 25th - 26th October 2026
        Venue: Sky View Auditorium, Central Block
        Faculty Coordinator: Dr. Stephen Akash
      `;

      const meta = extractEventMetadata(text);
      assert.equal(meta.eventName, 'National Workshop on Cloud Computing and DevOps');
      assert.equal(meta.venue, 'Sky View Auditorium, Central Block');
      assert.equal(meta.date, '25th - 26th October 2026');
    });

    test('extracts quoted event titles', () => {
      const text = `
        You are invited to the "Annual Tech Conclave 2026" organized by CSE.
        Venue: Main Auditorium
        Date: Tomorrow
      `;

      const meta = extractEventMetadata(text);
      assert.equal(meta.eventName, 'Annual Tech Conclave 2026');
      assert.equal(meta.venue, 'Main Auditorium');
      assert.equal(meta.date, 'Tomorrow');
    });
  });

  describe('Full Document Classifier Integration', () => {
    const teacherInfo = {
      name: 'Stephen Akash',
      email: 'stephen.akash@christuniversity.in',
      department: 'Computer Science'
    };

    test('classifies attached poster with high confidence', () => {
      const posterText = `
        CHRIST (Deemed to be University)
        Department of Computer Science
        INTERNATIONAL CONFERENCE ON GENERATIVE AI
        Venue: Central Block Auditorium
        Date: 12th - 14th November 2026
        Faculty Coordinators:
        Dr. Stephen Akash
        Dr. Jane Doe
      `;

      const result = classifyEmail('Call for papers', posterText, teacherInfo, 'poster');

      assert.equal(result.matchFound, true);
      assert.equal(result.role, 'Faculty Coordinator');
      assert.equal(result.sourceType, 'poster');
      assert.ok(result.suggestedNotice.includes('Away - Coordinating'));
      assert.ok(result.suggestedNotice.includes('International Conference on Generative AI'));
      assert.ok(result.suggestedNotice.includes('Central Block Auditorium'));
    });

    test('classifies circular PDF with Convener role', () => {
      const pdfText = `
        OFFICE CIRCULAR
        Sub: Annual Research Symposium 2026
        Venue: KE Auditorium
        Date: 18th December 2026
        Organizing Team:
        Convener: Dr. Stephen Akash
      `;

      const result = classifyEmail('Symposium Circular', pdfText, teacherInfo, 'pdf');

      assert.equal(result.matchFound, true);
      assert.equal(result.role, 'Convener');
      assert.equal(result.sourceType, 'pdf');
      assert.ok(result.suggestedNotice.includes('Away - Convening'));
    });

    test('returns matchFound: false for non-event promotional emails', () => {
      const spamEmail = `
        Dear Faculty,
        The cafeteria menu for this week has been updated.
        Please check the student portal for details.
      `;

      const result = classifyEmail('Cafeteria Notice', spamEmail, teacherInfo, 'text');
      assert.equal(result.matchFound, false);
      assert.equal(result.suggestedNotice, null);
    });
  });
});
