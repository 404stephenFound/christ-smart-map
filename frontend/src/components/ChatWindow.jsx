import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, FileText, Calendar, Compass, Search, UserCheck, AlertCircle, Info } from 'lucide-react';

const ChatWindow = ({ onViewTimetable, API_URL }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hello! I am your Smart Cabin Assistant. Ask me questions like:\n1. Where is Dr. Smith's cabin?\n2. Is anyone available in CSE?\n3. Who is in cabin 402?\n4. Show me the timetable of Prof. Johnson",
      chips: [
        'Who is available right now?',
        'Teachers in CSE',
        'Where is cabin 102?',
      ],
      timestamp: new Date()
    }
  ]);
  const [loading, setLoading] = useState(false);
  
  // Directory & Autocomplete States
  const [teachersList, setTeachersList] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const messagesEndRef = useRef(null);
  const suggestionRef = useRef(null);

  // Fetch all teachers for the sidebar directory and autocomplete
  useEffect(() => {
    fetch(`${API_URL}/teachers`)
      .then(res => res.json())
      .then(data => setTeachersList(data))
      .catch(err => console.error('Error fetching teacher list:', err));
  }, [API_URL]);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Autocomplete filtering
  useEffect(() => {
    if (query.trim().length < 2) {
      setAutocompleteSuggestions([]);
      return;
    }

    const filtered = teachersList.filter(t => {
      const matchesQuery = 
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.department.toLowerCase().includes(query.toLowerCase());
      const matchesDept = selectedDept === 'ALL' || t.department === selectedDept;
      return matchesQuery && matchesDept;
    }).slice(0, 4);

    setAutocompleteSuggestions(filtered);
  }, [query, teachersList, selectedDept]);

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendMessage = async (textToSend) => {
    const messageText = textToSend || query;
    if (!messageText.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text: messageText, timestamp: new Date() }]);
    setQuery('');
    setShowSuggestions(false);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: messageText }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: data.reply,
          teachers: data.teachers || [],
          type: data.type,
          timestamp: new Date()
        }]);
      } else {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: data.error || 'Sorry, I ran into a server error processing that query.',
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: 'Sorry, I could not connect to the backend server. Please verify it is running.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColorClass = (status) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE': return 'available';
      case 'IN_CLASS':
      case 'IN_MEETING':
      case 'PHD_VIVA': return 'meeting';
      case 'AWAY': return 'away';
      default: return 'away';
    }
  };

  const formatStatusText = (status) => {
    if (!status) return 'Unknown';
    return status.replace('_', ' ');
  };

  const handleSidebarTeacherClick = (teacher) => {
    handleSendMessage(`Where is ${teacher.name}'s cabin?`);
  };

  // Filtered sidebar directory
  const filteredTeachers = teachersList.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.cabin_number.toLowerCase().includes(searchFilter.toLowerCase());
      
    const matchesDept = selectedDept === 'ALL' || t.department === selectedDept;
    
    return matchesSearch && matchesDept;
  });

  return (
    <div className="main-layout with-sidebar">
      {/* Sidebar Directory */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Faculty Directory</h2>
          <div className="search-input-wrapper">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search by name, dept, cabin..." 
              className="search-input"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <div className="dept-filter-wrapper" style={{ marginTop: '0.75rem' }}>
            <select
              className="form-control"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                fontSize: '0.85rem',
                borderRadius: 'var(--radius-md)', 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border-color)', 
                color: 'var(--text-primary)' 
              }}
            >
              <option value="ALL">All Departments</option>
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
        <div className="teacher-list-scroll">
          {filteredTeachers.length > 0 ? (
            filteredTeachers.map(teacher => (
              <div 
                key={teacher.id} 
                className="teacher-item-card"
                onClick={() => handleSidebarTeacherClick(teacher)}
              >
                <div className="teacher-item-info">
                  <span className="teacher-item-name">{teacher.name}</span>
                  <span className="teacher-item-dept">{teacher.designation} • {teacher.department}</span>
                  <span className="teacher-item-cabin">Cabin {teacher.cabin_number}</span>
                </div>
                <span className={`status-badge ${getStatusColorClass(teacher.status)}`}>
                  {formatStatusText(teacher.status)}
                </span>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
              <AlertCircle size={20} style={{ marginBottom: '0.5rem' }} />
              <p>No teachers found matching search criteria.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chatbot Interface */}
      <section className="chat-section">
        <div className="chat-header">
          <div className="chat-header-info">
            <h2>AI Assistant</h2>
            <p>Locate cabin, status, and timetables in real-time</p>
          </div>
          <Compass size={20} color="var(--primary)" />
        </div>

        <div className="messages-container">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-avatar">
                <span>{msg.sender === 'user' ? 'You' : 'Cabin Bot'}</span>
                <span>•</span>
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="message-bubble">
                {msg.text}

                {/* Dynamic cards if teacher info is retrieved */}
                {msg.teachers && msg.teachers.length > 0 && (
                  <div className="teacher-cards-container">
                    {msg.teachers.map((t) => (
                      <div key={t.id} className="teacher-detail-card">
                        <div className="teacher-detail-row">
                          <Compass size={16} />
                          <span>
                            <strong>Name:</strong> {t.name} ({t.designation})
                          </span>
                        </div>
                        <div className="teacher-detail-row">
                          <Info size={16} />
                          <span>
                            <strong>Dept:</strong> {t.department}
                          </span>
                        </div>
                        <div className="teacher-detail-row">
                          <MapPin size={16} />
                          <span>
                            <strong>Cabin location:</strong> <span style={{ color: 'var(--primary)' }}>{t.cabin_number}</span>
                          </span>
                        </div>
                        <div className="teacher-detail-row">
                          <UserCheck size={16} />
                          <span>
                            <strong>Current Status:</strong>{' '}
                            <span className={`status-badge ${getStatusColorClass(t.status)}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                              {formatStatusText(t.status)}
                            </span>
                          </span>
                        </div>
                        
                        {t.status_notice && (
                          <div className="teacher-detail-row" style={{ fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', borderLeft: '2px solid var(--primary)' }}>
                            <span>👉 "{t.status_notice}"</span>
                          </div>
                        )}

                        <div className="timetable-btn-row">
                          {t.timetable_url ? (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px' }}
                              onClick={() => onViewTimetable(t.timetable_url, t.name)}
                            >
                              <FileText size={14} />
                              <span>View Timetable</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No timetable uploaded</span>
                          )}

                          {t.schedule_data && Object.keys(t.schedule_data).length > 0 && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px' }}
                              onClick={() => handleSendMessage(`Show schedule for ${t.name}`)}
                            >
                              <Calendar size={14} />
                              <span>Show Grid Schedule</span>
                            </button>
                          )}
                        </div>

                        {/* If schedule details requested and available, render schedule table inline */}
                        {msg.type === 'teacher_details' && msg.intent_request === 'timetable' && t.schedule_data && Object.keys(t.schedule_data).length > 0 && (
                          <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Weekly Schedule:</span>
                            <div className="schedule-grid-container">
                              <table className="schedule-table" style={{ fontSize: '0.75rem' }}>
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
                                  ].map(p => (
                                    <tr key={p.id}>
                                      <td style={{ fontWeight: '600', fontSize: '0.75rem', lineHeight: '1.2' }}>
                                        <div>{p.id}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '0.1rem' }}>{p.time}</div>
                                      </td>
                                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                                        const isHalfDaySat = day === 'Sat' && (p.id === 'P4' || p.id === 'P5' || p.id === 'P6');
                                        const cellVal = isHalfDaySat ? 'HALF DAY' : (t.schedule_data[day]?.[p.id] || '-');
                                        return (
                                          <td key={day} style={{ color: cellVal === '-' || cellVal === 'HALF DAY' || cellVal === 'LUNCH' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                            {cellVal}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion Chips */}
                {msg.chips && msg.chips.length > 0 && (
                  <div className="suggestion-chips-container">
                    {msg.chips.map((chipText, cIdx) => (
                      <button 
                        key={cIdx} 
                        className="chip" 
                        onClick={() => handleSendMessage(chipText)}
                      >
                        {chipText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message bot">
              <div className="message-avatar">
                <span>Cabin Bot</span>
                <span>•</span>
                <span>Typing...</span>
              </div>
              <div className="message-bubble" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="chat-input-area">
          <form 
            className="chat-input-form" 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          >
            <input 
              type="text" 
              placeholder="Ask for cabin, availability or name..."
              className="chat-input"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              disabled={loading}
            />
            
            {/* Auto-suggest dropdown */}
            {showSuggestions && autocompleteSuggestions.length > 0 && (
              <div 
                className="autocomplete-suggestions-box" 
                ref={suggestionRef}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  width: 'calc(100% - 60px)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 20,
                  marginBottom: '8px',
                  overflow: 'hidden'
                }}
              >
                {autocompleteSuggestions.map((teacher) => (
                  <div 
                    key={teacher.id}
                    className="autocomplete-item"
                    onClick={() => {
                      setQuery(teacher.name);
                      setShowSuggestions(false);
                    }}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.875rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span><strong>{teacher.name}</strong> ({teacher.designation})</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{teacher.department}</span>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ padding: '0.875rem' }} disabled={loading}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default ChatWindow;
