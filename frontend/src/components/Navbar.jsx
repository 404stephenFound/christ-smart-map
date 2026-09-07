import React from 'react';
import { MessageSquare, User, Compass, Sun, Moon } from 'lucide-react';

const Navbar = ({ currentView, onViewChange, teacher, theme, toggleTheme }) => {
  return (
    <header className="app-header">
      <div className="brand" onClick={() => onViewChange('chat')} style={{ cursor: 'pointer' }}>
        <Compass size={24} color="var(--primary)" />
        <span>ChristSmart Cabin Finder</span>
      </div>
      
      <div className="nav-right">
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
        </div>
      </div>
    </header>
  );
};

export default Navbar;
