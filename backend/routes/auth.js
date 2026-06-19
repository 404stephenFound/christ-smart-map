import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Register a new teacher
router.post('/register', async (req, res) => {
  const { email, password, name, designation, department, cabinNumber, signupKey } = req.body;

  if (!email || !password || !name || !designation || !department || !cabinNumber || !signupKey) {
    return res.status(400).json({ error: 'All fields are required, including the Faculty Signup Key' });
  }

  // 1. Verify signup passcode
  const requiredPasscode = process.env.REGISTRATION_SECRET;
  if (requiredPasscode && signupKey !== requiredPasscode) {
    return res.status(403).json({ error: 'Unauthorized: Invalid Faculty Signup Passcode' });
  }

  // 2. Verify allowed email domain and reject student patterns
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (allowedDomain && !email.toLowerCase().endsWith(allowedDomain.toLowerCase())) {
    return res.status(400).json({ error: `Registration restricted to official faculty emails ending in ${allowedDomain}` });
  }

  const emailUsername = email.split('@')[0];
  const isStudentPattern = /^\d+/.test(emailUsername); // matches roll numbers (e.g. 2410234)
  if (isStudentPattern) {
    return res.status(400).json({ error: 'Student registration is blocked. Faculty registration must use official name-based email prefixes.' });
  }

  try {
    // 3. Optional Allowlist check (strict whitelist if allowed_teachers table is populated)
    const allowlistCheck = await pool.query('SELECT 1 FROM allowed_teachers LIMIT 1');
    if (allowlistCheck.rowCount > 0) {
      const isAllowed = await pool.query('SELECT 1 FROM allowed_teachers WHERE LOWER(email) = LOWER($1)', [email]);
      if (isAllowed.rowCount === 0) {
        return res.status(403).json({ error: 'Your email is not in the pre-approved Faculty Whitelist. Please contact the college administrator.' });
      }
    }

    // Check if teacher already exists
    const existingTeacher = await pool.query('SELECT id FROM teachers WHERE email = $1', [email]);
    if (existingTeacher.rowCount > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new teacher
    const result = await pool.query(
      `INSERT INTO teachers (email, password_hash, name, designation, department, cabin_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, designation, department, cabin_number`,
      [email, passwordHash, name, designation, department, cabinNumber]
    );

    const newTeacher = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { id: newTeacher.id, email: newTeacher.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(201).json({
      message: 'Teacher registered successfully',
      teacher: newTeacher,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM teachers WHERE email = $1',
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const teacher = result.rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, teacher.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: teacher.id, email: teacher.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    const { password_hash, ...teacherData } = teacher;

    res.json({
      message: 'Login successful',
      teacher: teacherData,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Get current teacher session
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers WHERE id = $1', [req.teacherId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const teacher = result.rows[0];
    const { password_hash, ...teacherData } = teacher;

    res.json(teacherData);
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

export default router;
