import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/cryptoVault.js';
import { getOAuth2Client, scanRecentEmails } from '../services/emailScanner.js';

const router = express.Router();

// Generate Google OAuth consent URL
router.post('/connect', requireAuth, async (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/teachers/email/callback`;
    const oauth2Client = getOAuth2Client(redirectUri);
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent' // Forces consent screen to always yield a refresh token
    });
    
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: 'Server error generating OAuth link' });
  }
});

// OAuth Callback redirect handler
router.get('/callback', requireAuth, async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('OAuth callback code missing.');
  }
  
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/teachers/email/callback`;
    const oauth2Client = getOAuth2Client(redirectUri);
    
    // Exchange authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      console.warn('Google did not return a refresh token. Re-authorization may be needed.');
    }
    
    // Encrypt refresh token before storing it
    const encryptedToken = encrypt(tokens.refresh_token);
    
    // Save to teacher profile database record
    await pool.query(
      `UPDATE teachers 
       SET email_oauth_refresh_token_enc = $1, email_scan_enabled = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [encryptedToken, req.teacherId]
    );
    
    // Redirect back to frontend dashboard
    res.redirect('http://localhost:5173/?connected=true');
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    res.status(500).send('OAuth Callback Error: failed to connect email integration.');
  }
});

// Scan inbox for notices (suggestion only - does not auto-save to status_notice)
router.post('/scan', requireAuth, async (req, res) => {
  try {
    // Retrieve encrypted refresh token
    const result = await pool.query(
      'SELECT email_oauth_refresh_token_enc, email_scan_enabled FROM teachers WHERE id = $1',
      [req.teacherId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }
    
    const { email_oauth_refresh_token_enc, email_scan_enabled } = result.rows[0];

    // Check for mock testing parameter
    if (req.query.mock === 'true') {
      const mockResult = {
        matchFound: true,
        suggestedNotice: 'Away - Coordinating National Science Exhibition',
        sourceType: 'text'
      };
      
      await pool.query(
        `INSERT INTO notice_scan_logs (teacher_id, source_type, match_found, suggested_notice)
         VALUES ($1, $2, $3, $4)`,
        [req.teacherId, mockResult.sourceType, mockResult.matchFound, mockResult.suggestedNotice]
      );
      
      await pool.query(
        'UPDATE teachers SET last_email_scan_at = CURRENT_TIMESTAMP WHERE id = $1',
        [req.teacherId]
      );
      
      return res.json(mockResult);
    }
    
    if (!email_scan_enabled || !email_oauth_refresh_token_enc) {
      return res.status(400).json({ error: 'Email integration is not connected.' });
    }
    
    // Decrypt refresh token
    const refreshToken = decrypt(email_oauth_refresh_token_enc);
    
    // Perform scan
    const redirectUri = `${req.protocol}://${req.get('host')}/api/teachers/email/callback`;
    const scanResult = await scanRecentEmails(refreshToken, redirectUri);
    
    // Log scan event (no raw email text is saved)
    await pool.query(
      `INSERT INTO notice_scan_logs (teacher_id, source_type, match_found, suggested_notice)
       VALUES ($1, $2, $3, $4)`,
      [req.teacherId, scanResult.sourceType, scanResult.matchFound, scanResult.suggestedNotice]
    );
    
    // Update last scan timestamp
    await pool.query(
      'UPDATE teachers SET last_email_scan_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.teacherId]
    );
    
    res.json(scanResult);
  } catch (error) {
    console.error('Error scanning emails:', error);
    res.status(500).json({ error: 'Server error scanning emails' });
  }
});

// Disconnect email integration (revoke and purge refresh token)
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT email_oauth_refresh_token_enc FROM teachers WHERE id = $1',
      [req.teacherId]
    );
    
    if (result.rowCount > 0 && result.rows[0].email_oauth_refresh_token_enc) {
      const refreshToken = decrypt(result.rows[0].email_oauth_refresh_token_enc);
      const redirectUri = `${req.protocol}://${req.get('host')}/api/teachers/email/callback`;
      const oauth2Client = getOAuth2Client(redirectUri);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      
      try {
        await oauth2Client.revokeToken(refreshToken);
      } catch (revokeErr) {
        console.warn('Could not revoke Google OAuth token online:', revokeErr.message);
      }
    }
    
    // Remove token entries from DB
    await pool.query(
      `UPDATE teachers 
       SET email_oauth_refresh_token_enc = NULL, email_scan_enabled = FALSE, last_email_scan_at = NULL 
       WHERE id = $1`,
      [req.teacherId]
    );
    
    res.json({ message: 'Disconnected email integration successfully.' });
  } catch (error) {
    console.error('Error disconnecting email:', error);
    res.status(500).json({ error: 'Server error disconnecting email' });
  }
});

export default router;
