import React from 'react';
import { MessageSquare, User, LogOut, Compass, Sun, Moon } from 'lucide-react';

const Navbar = ({ currentView, onViewChange, teacher, onLogout, theme, toggleTheme }) => {
  const getInitials = (name) => {
    if (!name) return 'T';
    return name.replace(/(dr\.|prof\.|mr\.|ms\.|mrs\.)/gi, '').trim().charAt(0).toUpperCase();
  };

  return (
    <header className="app-header">
      <div className="brand" onClick={() => onViewChange('chat')} style={{ cursor: 'pointer' }}>
        <Compass size={24} color="var(--primary)" />
        <span>ChristSmart Cabin Finder</span>
      </div>
      
      <div className="nav-right">
        {/* Logged-In Teacher Identity Context */}
        {teacher && (
          <div className="user-context-card">
            <div className="user-avatar">
              {getInitials(teacher.name)}
            </div>
            <div className="user-details">
              <span className="user-name">{teacher.name}</span>
              <span className="user-role">{teacher.designation}</span>
            </div>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button 
          className="theme-toggle-btn" 
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="nav-buttons">
          {currentView === 'chat' ? (
            teacher ? (
              <button className="btn btn-primary" onClick={() => onViewChange('dashboard')}>
                <User size={16} />
                <span>Dashboard</span>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => onViewChange('auth')}>
                <User size={16} />
                <span>Teacher Portal</span>
              </button>
            )
          ) : (
            <button className="btn btn-secondary" onClick={() => onViewChange('chat')}>
              <MessageSquare size={16} />
              <span>Student Chat</span>
            </button>
          )}

          {teacher && (
            <button className="btn btn-danger" onClick={onLogout} title="Logout">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
