import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ChatWindow from './components/ChatWindow';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import { X, FileText } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'auth' | 'dashboard'
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  
  // Modal state for viewing timetable files
  const [modalTimetableUrl, setModalTimetableUrl] = useState(null);
  const [modalTeacherName, setModalTeacherName] = useState('');

  // Toast notification state
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Restore session on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
        
        if (response.ok) {
          const teacherData = await response.json();
          setTeacher(teacherData);
          setCurrentView('dashboard');
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleAuthSuccess = (teacherData) => {
    setTeacher(teacherData);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        setTeacher(null);
        setCurrentView('chat');
        showToast('Logged out successfully', 'success');
      } else {
        showToast('Logout failed on server', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error during logout', 'error');
    }
  };

  const handleViewTimetable = (url, teacherName) => {
    setModalTimetableUrl(url);
    setModalTeacherName(teacherName);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-dots" style={{ transform: 'scale(1.5)' }}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Initializing system...</p>
      </div>
    );
  }

  // Helper to check file extension
  const isImageFile = (url) => {
    if (!url) return false;
    const ext = url.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  };

  return (
    <div className="app-container">
      <Navbar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        teacher={teacher}
        onLogout={handleLogout}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {currentView === 'chat' && (
          <ChatWindow 
            onViewTimetable={handleViewTimetable} 
            API_URL={API_URL}
          />
        )}
        
        {currentView === 'auth' && (
          <Login 
            onAuthSuccess={handleAuthSuccess} 
            showToast={showToast} 
            API_URL={API_URL}
          />
        )}

        {currentView === 'dashboard' && teacher && (
          <TeacherDashboard 
            teacher={teacher} 
            onUpdateTeacher={setTeacher} 
            showToast={showToast} 
            API_URL={API_URL}
          />
        )}
      </main>

      {/* Floating Timetable Overlay Modal */}
      {modalTimetableUrl && (
        <div className="modal-overlay" onClick={() => setModalTimetableUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="var(--primary)" />
                Timetable: {modalTeacherName}
              </span>
              <button className="modal-close-btn" onClick={() => setModalTimetableUrl(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {isImageFile(modalTimetableUrl) ? (
                <img 
                  src={`${API_URL.replace('/api', '')}${modalTimetableUrl}`} 
                  alt={`Timetable of ${modalTeacherName}`} 
                />
              ) : (
                <iframe 
                  src={`${API_URL.replace('/api', '')}${modalTimetableUrl}`} 
                  title={`Timetable of ${modalTeacherName}`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert Popups */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
