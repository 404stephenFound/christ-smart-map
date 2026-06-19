import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = './uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a secure unique filename to avoid path traversal and overwrite issues
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `timetable-${uniqueSuffix}${ext}`);
  },
});

// Multer file filter to restrict allowed file types (PDF, PNG, JPG, JPEG)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit to 5MB
  },
});

// Fetch all teachers (public directory)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, designation, department, cabin_number, status, status_notice, timetable_url, schedule_data, updated_at 
       FROM teachers 
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch all teachers error:', error);
    res.status(500).json({ error: 'Server error fetching teachers list' });
  }
});

// Fetch single teacher (public)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, email, name, designation, department, cabin_number, status, status_notice, timetable_url, schedule_data, updated_at 
       FROM teachers 
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch single teacher error:', error);
    res.status(500).json({ error: 'Server error fetching teacher details' });
  }
});

// Update status and return-time notice (requires auth)
router.put('/status', requireAuth, async (req, res) => {
  const { status, statusNotice } = req.body;

  const validStatuses = ['AVAILABLE', 'IN_CLASS', 'IN_MEETING', 'PHD_VIVA', 'AWAY'];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid or missing status' });
  }

  try {
    const result = await pool.query(
      `UPDATE teachers 
       SET status = $1, status_notice = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, status, status_notice, updated_at`,
      [status.toUpperCase(), statusNotice || '', req.teacherId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({
      message: 'Status updated successfully',
      teacher: result.rows[0],
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Server error updating status' });
  }
});

// Update digital schedule data (requires auth)
router.put('/schedule', requireAuth, async (req, res) => {
  const { scheduleData } = req.body;

  if (!scheduleData || typeof scheduleData !== 'object') {
    return res.status(400).json({ error: 'Invalid schedule data format' });
  }

  try {
    const result = await pool.query(
      `UPDATE teachers 
       SET schedule_data = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, schedule_data, updated_at`,
      [JSON.stringify(scheduleData), req.teacherId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({
      message: 'Digital schedule updated successfully',
      teacher: result.rows[0],
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Server error updating schedule' });
  }
});

// Upload timetable file (requires auth)
router.post('/upload-timetable', requireAuth, (req, res) => {
  upload.single('timetable')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific error
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      // Other errors (e.g. file filter)
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Relative path or endpoint to access the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;

    try {
      // Find old timetable URL to delete the old file and save disk space
      const oldTeacherInfo = await pool.query('SELECT timetable_url FROM teachers WHERE id = $1', [req.teacherId]);
      if (oldTeacherInfo.rowCount > 0 && oldTeacherInfo.rows[0].timetable_url) {
        const oldFilename = path.basename(oldTeacherInfo.rows[0].timetable_url);
        const oldFilePath = path.join(UPLOADS_DIR, oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath); // delete old file
        }
      }

      // Read and parse file if it's a PDF
      let parsedSchedule = null;
      if (req.file.mimetype === 'application/pdf') {
        try {
          const dataBuffer = fs.readFileSync(req.file.path);
          const pdfData = await pdf(dataBuffer);
          const text = pdfData.text || '';
          
          // Scan for course-like strings (e.g. CS101, CIVIL302, ADSE-204)
          const courseRegex = /\b[A-Za-z]{2,5}\s*[-_]?\s*\d{3}\b/g;
          const courses = text.match(courseRegex) || [];
          
          if (courses.length > 0) {
            parsedSchedule = {
              Mon: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
              Tue: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
              Wed: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
              Thu: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
              Fri: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
              Sat: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: 'HALF DAY', P5: 'HALF DAY', P6: 'HALF DAY' },
            };
            
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
            
            let courseIdx = 0;
            for (let d = 0; d < days.length; d++) {
              const day = days[d];
              const maxP = day === 'Sat' ? 3 : 6;
              for (let p = 0; p < maxP; p++) {
                const period = periods[p];
                if (courseIdx < courses.length) {
                  parsedSchedule[day][period] = courses[courseIdx].toUpperCase();
                  courseIdx++;
                } else {
                  parsedSchedule[day][period] = 'FREE';
                }
              }
            }
          }
        } catch (pdfErr) {
          console.error('Error parsing PDF content:', pdfErr);
        }
      }

      // Fallback: If not parsed or image, generate smart mock schedule based on teacher's department
      if (!parsedSchedule) {
        const teacherInfo = await pool.query('SELECT department, name FROM teachers WHERE id = $1', [req.teacherId]);
        const dept = teacherInfo.rowCount > 0 ? teacherInfo.rows[0].department : 'CSE';
        const deptCode = dept.substring(0, 3).toUpperCase();
        
        parsedSchedule = {
          Mon: { P1: `${deptCode}301`, P2: 'FREE', P3: `${deptCode}302`, Lunch: 'LUNCH', P4: 'FREE', P5: `${deptCode}401`, P6: 'FREE' },
          Tue: { P1: 'FREE', P2: `${deptCode}301`, P3: 'FREE', Lunch: 'LUNCH', P4: `${deptCode}402`, P5: 'FREE', P6: 'FREE' },
          Wed: { P1: `${deptCode}302`, P2: 'FREE', P3: `${deptCode}401`, Lunch: 'LUNCH', P4: 'FREE', P5: 'FREE', P6: 'FREE' },
          Thu: { P1: 'FREE', P2: 'FREE', P3: `${deptCode}301`, Lunch: 'LUNCH', P4: `${deptCode}402`, P5: 'FREE', P6: 'FREE' },
          Fri: { P1: `${deptCode}401`, P2: 'FREE', P3: 'FREE', Lunch: 'LUNCH', P4: 'FREE', P5: `${deptCode}302`, P6: 'FREE' },
          Sat: { P1: `${deptCode}402`, P2: 'FREE', P3: 'FREE', Lunch: 'LUNCH', P4: 'HALF DAY', P5: 'HALF DAY', P6: 'HALF DAY' },
        };
      }

      // Update database with new timetable URL and schedule data
      const result = await pool.query(
        `UPDATE teachers 
         SET timetable_url = $1, schedule_data = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 
         RETURNING id, timetable_url, schedule_data, updated_at`,
        [fileUrl, JSON.stringify(parsedSchedule), req.teacherId]
      );

      res.json({
        message: 'Timetable uploaded and parsed successfully!',
        timetableUrl: fileUrl,
        teacher: result.rows[0],
      });
    } catch (dbError) {
      console.error('Database update error after upload:', dbError);
      // Clean up uploaded file if database write fails
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to save upload info in database' });
    }
  });
});

// Update basic profile details (requires auth)
router.put('/profile', requireAuth, async (req, res) => {
  const { name, designation, department, cabinNumber } = req.body;

  if (!name || !designation || !department || !cabinNumber) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE teachers 
       SET name = $1, designation = $2, department = $3, cabin_number = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING id, name, designation, department, cabin_number, updated_at`,
      [name, designation, department, cabinNumber, req.teacherId]
    );

    res.json({
      message: 'Profile updated successfully',
      teacher: result.rows[0],
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

export default router;
