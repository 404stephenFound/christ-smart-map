import React, { useState, useEffect } from 'react';
import { 
  User, CheckCircle, Clock, FileText, UploadCloud, MapPin, 
  Save, AlertCircle, Compass, Grid, BookOpen, Briefcase,
  Mail, Sparkles, RefreshCw
} from 'lucide-react';

const TeacherDashboard = ({ teacher, onUpdateTeacher, showToast, API_URL }) => {
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

  return (
    <div className="dashboard-grid">
      {/* Left Column Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Status update panel */}
        <section className="dashboard-panel">
          <h2 className="panel-title">
            <CheckCircle size={18} color="var(--primary)" />
            <span>Update Availability Status</span>
          </h2>
          
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
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--primary)', color: '#fff', textTransform: 'uppercase' }}>
                        {detectedNotice.sourceType === 'poster' ? 'Poster Detected' : detectedNotice.sourceType === 'pdf' ? 'PDF Circular' : 'Email Notice'}
                      </span>
                      {detectedNotice.role && (
                        <span style={{ fontSize: '0.7rem', fontWeight: '600', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                          {detectedNotice.role}
                        </span>
                      )}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setDetectedNotice(null)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      ✕ Dismiss
                    </button>
                  </div>
                  {detectedNotice.sourceFileName && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      File: <strong>{detectedNotice.sourceFileName}</strong>
                    </div>
                  )}
                  {detectedNotice.venue && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Venue: <strong>{detectedNotice.venue}</strong> {detectedNotice.date ? `| ${detectedNotice.date}` : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
                    >
                      Apply & Update Notice
                    </button>
                  </div>
                </div>
              )}

              {/* Google Email Scan Panel */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={16} color="var(--primary)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                    {teacher.email_scan_enabled ? 'Google Email Linked' : 'Auto-detect from email/posters'}
                  </span>
                </div>
                
                {teacher.email_scan_enabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={handleScanEmail} 
                      disabled={scanning} 
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px dashed var(--primary)', background: 'transparent', color: 'var(--primary)' }}
                    >
                      <Sparkles size={12} style={scanning ? { animation: 'spin 1.5s linear infinite' } : {}} />
                      {scanning ? 'Scanning...' : 'Scan Inbox & Posters'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleDisconnectEmail} 
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', padding: '0.25rem' }}
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
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
                    >
                      {connecting ? 'Connecting...' : 'Connect Gmail'}
                    </button>
                  </div>
                )}
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                This notice will be served by the AI chatbot to students querying about you.
              </span>
            </div>
          </form>
        </section>

        {/* Timetable File Upload Panel */}
        <section className="dashboard-panel">
          <h2 className="panel-title">
            <UploadCloud size={18} color="var(--primary)" />
            <span>Upload Timetable File</span>
          </h2>

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
      </div>

      {/* Right Column Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Profile editor panel */}
        <section className="dashboard-panel">
          <h2 className="panel-title">
            <User size={18} color="var(--primary)" />
            <span>Profile Settings</span>
          </h2>

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

        {/* Digital Grid Schedule builder */}
        <section className="dashboard-panel">
          <h2 className="panel-title">
            <Grid size={18} color="var(--primary)" />
            <span>Digital Weekly Timetable Grid</span>
          </h2>
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

      </div>
    </div>
  );
};

export default TeacherDashboard;
