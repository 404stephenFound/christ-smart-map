import React, { useState } from 'react';
import { Mail, Lock, User, Briefcase, MapPin, Compass } from 'lucide-react';

const Login = ({ onAuthSuccess, showToast, API_URL }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    designation: 'Assistant Professor',
    department: 'CSE',
    block: 'Block 1',
    room: '',
    signupKey: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    let payload;
    if (isRegister) {
      const { block, room, ...rest } = formData;
      payload = {
        ...rest,
        cabinNumber: `${block} - ${room}`
      };
    } else {
      payload = { email: formData.email, password: formData.password };
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        showToast(isRegister ? 'Registration successful!' : 'Welcome back!', 'success');
        onAuthSuccess(data.teacher);
      } else {
        showToast(data.error || 'Authentication failed', 'error');
      }
    } catch (err) {
      console.error('Auth request error:', err);
      showToast('Could not reach backend server', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'inline-flex', padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '1rem', color: 'var(--primary)' }}>
            <Compass size={28} />
          </div>
          <h2>{isRegister ? 'Create Account' : 'Teacher Portal'}</h2>
          <p>{isRegister ? 'Register your cabin status profile' : 'Sign in to update your status'}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <User size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g. Dr. Jane Smith"
                    className="form-control"
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Designation</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Briefcase size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                    <select
                      name="designation"
                      className="form-control"
                      style={{ paddingLeft: '2.5rem', width: '100%' }}
                      value={formData.designation}
                      onChange={handleInputChange}
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
                    <Compass size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                    <select
                      name="block"
                      className="form-control"
                      style={{ paddingLeft: '2.5rem', width: '100%' }}
                      value={formData.block}
                      onChange={handleInputChange}
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
                    <MapPin size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      name="room"
                      placeholder="e.g. 402, Lab 1"
                      className="form-control"
                      style={{ paddingLeft: '2.5rem', width: '100%' }}
                      value={formData.room}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Briefcase size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                    <select
                      name="department"
                      className="form-control"
                      style={{ paddingLeft: '2.5rem', width: '100%' }}
                      value={formData.department}
                      onChange={handleInputChange}
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
              <div className="form-group">
                <label>Faculty Signup Passcode</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    name="signupKey"
                    placeholder="Enter security key to register"
                    className="form-control"
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    value={formData.signupKey}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <input
                type="email"
                name="email"
                placeholder="teacher@college.edu"
                className="form-control"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                className="form-control"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Processing...' : isRegister ? 'Register & Login' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? (
            <>
              Already have an account? <span onClick={() => setIsRegister(false)}>Sign In</span>
            </>
          ) : (
            <>
              New to the system? <span onClick={() => setIsRegister(true)}>Register now</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
