import React, { useState, useEffect } from 'react';
import { 
  User, CheckCircle, Clock, FileText, UploadCloud, MapPin, 
  Save, AlertCircle, Compass, Grid, BookOpen, Briefcase,
  Mail, Sparkles, RefreshCw, LogOut
} from 'lucide-react';

const TeacherDashboard = ({ teacher, onUpdateTeacher, showToast, API_URL, onLogout }) => {
  const [status, setStatus] = useState(teacher.status || 'AVAILABLE');
  const [statusNotice, setStatusNotice] = useState(teacher.status_notice || '');
  const [timetableFile, setTimetableFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Cabin parsing helper
  const parseCabinNumber = (fullCabinString) => {
    if (!fullCabinString) return { block: 'Block 1', room: '' };
    const blocks = [
      'Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6',
      'Architecture Block', 'Devdan Block'
    ];
    for (const b of blocks) {
      if (fullCabinString.startsWith(b)) {
        const rest = fullCabinString.substring(b.length).replace(/^[\s\-,:]+/, '');
        return { block: b, room: rest };
      }
    }
    return { block: 'Block 1', room: fullCabinString };
  };

  const initialCabin = parseCabinNumber(teacher.cabin_number || '');

  // Profile settings state
  const [profile, setProfile] = useState({
    name: teacher.name || '',
    designation: teacher.designation || 'Assistant Professor',
    department: teacher.department || 'CSE',
    block: initialCabin.block,
    room: initialCabin.room,
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [detectedNotice, setDetectedNotice] = useState(null);
  const [showSourceEmail, setShowSourceEmail] = useState(false);
  const [section, setSection] = useState('availability');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected === 'true') {
      showToast('Google email connected successfully!', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (connected === 'false') {
      const reasons = {
        no_refresh_token: 'Google did not return a refresh token. Remove the app under your Google account permissions, then connect again.',
        oauth_failed: 'Google sign-in failed. Please try connecting again.',
        missing_code: 'Google sign-in was cancelled.'
      };
      showToast(reasons[params.get('reason')] || 'Could not connect Google email.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectEmail = async () => {
    setConnecting(true);
    try {
      const response = await fetch(`${API_URL}/teachers/email/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error || 'Failed to generate connection link', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error connecting email', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectEmail = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google email integration?')) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/teachers/email/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateTeacher({
          ...teacher,
          email_scan_enabled: false,
          last_email_scan_at: null
        });
        showToast('Email integration disconnected successfully', 'success');
      } else {
        showToast(data.error || 'Failed to disconnect email', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error disconnecting email', 'error');
    }
  };

  const handleScanEmail = async () => {
    setScanning(true);
    try {
      const response = await fetch(`${API_URL}/teachers/email/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        if (data.matchFound && data.suggestedNotice) {
          setDetectedNotice(data);
          setShowSourceEmail(false);
          setStatusNotice(data.suggestedNotice);
          showToast(`Event notice detected from ${data.sourceType || 'email'}! Review and apply.`, 'success');
        } else {
          showToast('No relevant coordinator notifications found in the last 48 hours.', 'info');
        }
      } else {
        showToast(data.error || 'Failed to scan emails', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error scanning emails', 'error');
    } finally {
      setScanning(false);
    }
  };

  // Sync state if teacher prop updates
  useEffect(() => {
    setStatus(teacher.status || 'AVAILABLE');
    setStatusNotice(teacher.status_notice || '');
    const parsed = parseCabinNumber(teacher.cabin_number || '');
    setProfile({
      name: teacher.name || '',
      designation: teacher.designation || 'Assistant Professor',
      department: teacher.department || 'CSE',
      block: parsed.block,
      room: parsed.room,
    });
    if (teacher.schedule_data && Object.keys(teacher.schedule_data).length > 0) {
      setSchedule(teacher.schedule_data);
    }
  }, [teacher]);

  // Digital Timetable grid state
  // Schedule shape: { Mon: { P1: 'CS101', P2: '' }, Tue: {} ... }
  const initialSchedule = teacher.schedule_data && Object.keys(teacher.schedule_data).length > 0
    ? teacher.schedule_data 
    : {
        Mon: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
        Tue: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
        Wed: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
        Thu: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
        Fri: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: '', P5: '', P6: '' },
        Sat: { P1: '', P2: '', P3: '', Lunch: 'LUNCH', P4: 'HALF DAY', P5: 'HALF DAY', P6: 'HALF DAY' },
      };

  const [schedule, setSchedule] = useState(initialSchedule);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      const response = await fetch(`${API_URL}/teachers/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, statusNotice }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateTeacher(data.teacher);
        showToast('Status updated successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating status', 'error');
    }
  };

  const handleNoticeSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/teachers/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, statusNotice }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateTeacher(data.teacher);
        showToast('Status notice updated!', 'success');
      } else {
        showToast(data.error || 'Failed to update notice', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating notice', 'error');
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      const response = await fetch(`${API_URL}/teachers/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          designation: profile.designation,
          department: profile.department,
          cabinNumber: `${profile.block} - ${profile.room}`,
        }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateTeacher(data.teacher);
        showToast('Profile updated successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating profile', 'error');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        showToast('Invalid file type. Only PDF and images are allowed.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('File is too large. Max size is 5MB.', 'error');
        return;
      }
      setTimetableFile(file);
    }
  };

  const handleUploadTimetable = async () => {
    if (!timetableFile) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('timetable', timetableFile);

    try {
      const response = await fetch(`${API_URL}/teachers/upload-timetable`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        onUpdateTeacher(data.teacher);
        showToast('Timetable uploaded successfully!', 'success');
        setTimetableFile(null);
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error uploading file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleScheduleCellChange = (day, period, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: value
      }
    }));
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const response = await fetch(`${API_URL}/teachers/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData: schedule }),
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateTeacher(data.teacher);
        showToast('Digital schedule saved successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to save schedule', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error saving schedule', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const statusOptions = [
    { id: 'AVAILABLE', title: 'Available in Cabin', color: 'available' },
    { id: 'IN_CLASS', title: 'In Class', color: 'class' },
    { id: 'IN_MEETING', title: 'In Meeting', color: 'meeting' },
    { id: 'PHD_VIVA', title: 'Conducting PhD Viva', color: 'phd_viva' },
    { id: 'AWAY', title: 'Away / Gone Out', color: 'away' },
  ];

  const SECTIONS = [
    { id: 'availability', label: 'Availability', icon: CheckCircle },
    { id: 'timetable', label: 'Timetable', icon: Grid },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="dashboard-layout">
      <nav className="dashboard-nav" aria-label="Dashboard sections">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`dashboard-nav-item${section === id ? ' active' : ''}`}
            onClick={() => setSection(id)}
            aria-current={section === id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span className="dashboard-nav-label">{label}</span>
          </button>
        ))}

        <div className="dashboard-nav-footer">
          <button type="button" className="dashboard-nav-item" onClick={onLogout}>
            <LogOut size={20} />
            <span className="dashboard-nav-label">Sign out</span>
          </button>

          <div className="dashboard-nav-divider" />

          <div className="dashboard-nav-user">
            <span className="dashboard-nav-avatar">
              {(teacher.name || 'T').replace(/(dr\.|prof\.|mr\.|ms\.|mrs\.)/gi, '').trim().charAt(0).toUpperCase()}
            </span>
            <span className="dashboard-nav-text">
              <span className="dashboard-nav-label">{teacher.name}</span>
              <span className="dashboard-nav-hint">{teacher.designation}</span>
            </span>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">

        {section === 'availability' && (
          <section className="dashboard-panel">
            <header className="section-head">
              <span className="section-eyebrow">Availability</span>
              <h2 className="section-title">Update Availability Status</h2>
              <p className="section-desc">Set your current status and the notice students see.</p>
            </header>
            
            <div className="status-grid">
              {statusOptions.map((opt) => (
                <div 
                  key={opt.id} 
                  className={`status-select-card ${opt.color} ${status === opt.id ? 'active' : ''}`}
                  onClick={() => handleStatusChange(opt.id)}
                >

                  <span className="status-title">{opt.title}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleNoticeSubmit} style={{ marginTop: '0.5rem' }}>
              <div className="form-group">
                <label>Custom Notice / Return Time</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ flex: 1 }}
                    placeholder="e.g. Back at 3:00 PM, Away for PhD Viva"
                    value={statusNotice}
                    onChange={(e) => setStatusNotice(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary" style={{ padding: '0.75rem' }}>
                    <Save size={16} />
                  </button>
                </div>

                {/* Detected Notice Card Preview */}
                {detectedNotice && (
                  <div className="inset-panel inset-panel-accent" style={{ marginTop: 'var(--space-3)' }}>
                    <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
                      <div className="row-gap-2">
                        <span className="badge badge-accent">
                          {detectedNotice.sourceType === 'poster' ? 'Poster Detected' : detectedNotice.sourceType === 'pdf' ? 'PDF Circular' : 'Email Notice'}
                        </span>
                        {detectedNotice.role && (
                          <span className="badge badge-success">
                            {detectedNotice.role}
                          </span>
                        )}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => { setDetectedNotice(null); setShowSourceEmail(false); }} 
                        className="link-button link-button-muted"
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                    {detectedNotice.sourceFileName && (
                      <div className="meta-line-muted" style={{ marginBottom: 'var(--space-1)' }}>
                        File: <strong>{detectedNotice.sourceFileName}</strong>
                      </div>
                    )}
                    {detectedNotice.venue && (
                      <div className="meta-line" style={{ marginBottom: 'var(--space-2)' }}>
                        Venue: <strong>{detectedNotice.venue}</strong> {detectedNotice.date ? `| ${detectedNotice.date}` : ''}
                      </div>
                    )}
                    {detectedNotice.sourceEmail && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <button
                          type="button"
                          onClick={() => setShowSourceEmail(v => !v)}
                          className="link-button"
                        >
                          {showSourceEmail ? '\u25be' : '\u25b8'} {showSourceEmail ? 'Hide source email' : 'View source email'}
                        </button>

                        {showSourceEmail && (
                          <div className="inset-panel" style={{ marginTop: 'var(--space-2)', background: 'var(--bg-surface)' }}>
                            {detectedNotice.sourceEmail.subject && (
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                                {detectedNotice.sourceEmail.subject}
                              </div>
                            )}
                            {detectedNotice.sourceEmail.from && (
                              <div className="meta-line-muted">
                                From: {detectedNotice.sourceEmail.from}
                              </div>
                            )}
                            {detectedNotice.sourceEmail.date && (
                              <div className="meta-line-muted" style={{ marginBottom: 'var(--space-2)' }}>
                                {detectedNotice.sourceEmail.date}
                              </div>
                            )}

                            {detectedNotice.sourceEmail.text ? (
                              <pre className="source-text">
                                {detectedNotice.sourceEmail.text}
                              </pre>
                            ) : (
                              <div className="meta-line-muted" style={{ fontStyle: 'italic' }}>
                                Text preview unavailable for this source.
                              </div>
                            )}

                            <div className="meta-line-muted" style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-color)' }}>
                              {detectedNotice.sourceType === 'poster'
                                ? 'Text read from the attached poster image.'
                                : detectedNotice.sourceType === 'pdf'
                                  ? 'Text extracted from the attached PDF circular.'
                                  : 'Text from the email body.'} Shown for review only \u2014 it is never saved.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="row-gap-2" style={{ marginTop: 'var(--space-3)' }}>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Apply & Update Notice
                      </button>
                    </div>
                  </div>
                )}

                {/* Google Email Scan Panel */}
                <div className="inset-panel row-between" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="row-gap-2">
                    <Mail size={16} color="var(--primary)" />
                    <span className="meta-line">
                      {teacher.email_scan_enabled ? 'Google Email Linked' : 'Auto-detect from email/posters'}
                    </span>
                  </div>
                  
                  {teacher.email_scan_enabled ? (
                    <div className="row-gap-2">
                      <button 
                        type="button" 
                        onClick={handleScanEmail} 
                        disabled={scanning} 
                        className="btn btn-secondary btn-sm" 
                        style={{ borderStyle: 'dashed', borderColor: 'var(--primary)', background: 'transparent', color: 'var(--primary)' }}
                      >
                        <Sparkles size={12} style={scanning ? { animation: 'spin 1.5s linear infinite' } : {}} />
                        {scanning ? 'Scanning...' : 'Scan Inbox & Posters'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handleDisconnectEmail} 
                        className="link-button" style={{ color: 'var(--color-away)' }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        onClick={handleConnectEmail} 
                        disabled={connecting} 
                        className="btn btn-secondary btn-sm"
                      >
                        {connecting ? 'Connecting...' : 'Connect Gmail'}
                      </button>
                    </div>
                  )}
                </div>

                <span className="meta-line-muted" style={{ marginTop: 'var(--space-2)', display: 'block' }}>
                  This notice will be served by the AI chatbot to students querying about you.
                </span>
              </div>
            </form>
          </section>
        )}

        {section === 'timetable' && (
          <>
            <section className="dashboard-panel">
              <header className="section-head">
              <span className="section-eyebrow">Timetable</span>
              <h2 className="section-title">Upload Timetable File</h2>
              <p className="section-desc">PDF or image, up to 5MB. Course codes are read automatically.</p>
            </header>

              <label className="file-uploader">
                <input 
                  type="file" 
                  style={{ display: 'none' }} 
                  accept=".pdf, .png, .jpg, .jpeg"
                  onChange={handleFileChange}
                />
                <UploadCloud size={32} />
                <div>
                  <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>Choose or drag timetable file</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Accepts PDF, PNG, JPG, JPEG (Max 5MB)
                  </p>
                </div>
              </label>

              {timetableFile && (
                <div className="uploaded-file-info">
                  <span className="uploaded-file-name">
                    <FileText size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {timetableFile.name}
                    </span>
                  </span>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px' }}
                    onClick={handleUploadTimetable}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Save File'}
                  </button>
                </div>
              )}

              {teacher.timetable_url && (
                <div className="uploaded-file-info" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                  <span className="uploaded-file-name" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle size={16} color="var(--color-available)" />
                    <span>Active Timetable Uploaded</span>
                  </span>
                  <a 
                    href={`${API_URL.replace('/api', '')}${teacher.timetable_url}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px', textDecoration: 'none' }}
                  >
                    View File
                  </a>
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <header className="section-head">
              <span className="section-eyebrow">Timetable</span>
              <h2 className="section-title">Digital Weekly Timetable Grid</h2>
              <p className="section-desc">Optional. Students can ask the bot if you are free at a given period.</p>
            </header>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.75rem', marginBottom: '0.5rem', display: 'block' }}>
                Optional: Enter your period schedules. Students can ask the bot if you are free at specific periods.
              </span>

              <div className="schedule-grid-container">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Mon</th>
                      <th>Tue</th>
                      <th>Wed</th>
                      <th>Thu</th>
                      <th>Fri</th>
                      <th>Sat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 'P1', time: '09:00 - 10:00' },
                      { id: 'P2', time: '10:00 - 11:00' },
                      { id: 'P3', time: '11:00 - 12:00' },
                      { id: 'Lunch', time: '12:00 - 01:00' },
                      { id: 'P4', time: '01:00 - 02:00' },
                      { id: 'P5', time: '02:00 - 03:00' },
                      { id: 'P6', time: '03:00 - 04:00' }
                    ].map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.2' }}>
                          <div>{p.id}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '0.15rem' }}>{p.time}</div>
                        </td>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => {
                          const isHalfDaySat = day === 'Sat' && (p.id === 'P4' || p.id === 'P5' || p.id === 'P6');
                          return (
                            <td key={day}>
                              {p.id === 'Lunch' ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>LUNCH</span>
                              ) : isHalfDaySat ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>HALF DAY</span>
                              ) : (
                                <input 
                                  type="text" 
                                  className="schedule-input"
                                  placeholder="Free / Class"
                                  value={schedule[day]?.[p.id] || ''}
                                  onChange={(e) => handleScheduleCellChange(day, p.id, e.target.value)}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} 
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
              >
                {savingSchedule ? 'Saving Schedule Grid...' : 'Save Schedule Grid'}
              </button>
            </section>
          </>
        )}

        {section === 'profile' && (
          <section className="dashboard-panel">
            <header className="section-head">
              <span className="section-eyebrow">Profile</span>
              <h2 className="section-title">Profile Settings</h2>
              <p className="section-desc">Your name, cabin and department as students see them.</p>
            </header>

            <form onSubmit={handleProfileSubmit} className="auth-form" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Designation</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Briefcase size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                    <select 
                      className="form-control"
                      style={{ paddingLeft: '2.25rem', width: '100%' }}
                      value={profile.designation}
                      onChange={(e) => setProfile(prev => ({ ...prev, designation: e.target.value }))}
                      required
                    >
                      <option value="Professor">Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Dean">Dean</option>
                      <option value="HOD">HOD</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Block / Building</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Compass size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                    <select 
                      className="form-control"
                      style={{ paddingLeft: '2.25rem', width: '100%' }}
                      value={profile.block}
                      onChange={(e) => setProfile(prev => ({ ...prev, block: e.target.value }))}
                      required
                    >
                      <option value="Block 1">Block 1</option>
                      <option value="Block 2">Block 2</option>
                      <option value="Block 3">Block 3</option>
                      <option value="Block 4">Block 4</option>
                      <option value="Block 5">Block 5</option>
                      <option value="Block 6">Block 6</option>
                      <option value="Architecture Block">Architecture Block</option>
                      <option value="Devdan Block">Devdan Block</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Room / Cabin Number</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MapPin size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="e.g. 402, Lab 1"
                      className="form-control"
                      style={{ paddingLeft: '2.25rem', width: '100%' }}
                      value={profile.room}
                      onChange={(e) => setProfile(prev => ({ ...prev, room: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Briefcase size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                    <select 
                      className="form-control"
                      style={{ paddingLeft: '2.25rem', width: '100%' }}
                      value={profile.department}
                      onChange={(e) => setProfile(prev => ({ ...prev, department: e.target.value }))}
                      required
                    >
                      <option value="CSE">CSE</option>
                      <option value="ADSE">ADSE</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Robotics & Mechatronics">Robotics & Mechatronics</option>
                      <option value="Psychology">Psychology</option>
                      <option value="BBA">BBA</option>
                      <option value="Sciences & Humanities">Sciences & Humanities</option>
                      <option value="Civil">Civil</option>
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={updatingProfile}>
                {updatingProfile ? 'Saving profile...' : 'Save Profile Details'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
