import React, { useEffect, useState, useRef } from "react";
import ChatApp, { ChatAppRef } from "./ChatApp";
import AuthForm from "./AuthForm";
import ThemeToggle from "./themestoggle";
import Settings from "./Settings";
import Avatar from "./Avatar";
import MessageSearch from "./MessageSearch";
import { SearchIcon } from "./Icons";
import { applyTheme, getInitialTheme } from "./themeUtils";

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const chatAppRef = useRef<ChatAppRef>(null);

  // Check if user is already authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          // Verify token with backend
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData.user);
            setIsAuthenticated(true);
          } else {
            // Token is invalid, clear localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  // Handle successful authentication
  const handleAuthSuccess = (token: string, userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setShowSettings(false);
  };

  // Handle user profile update
  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  // Handle profile update for real-time sync
  const handleProfileUpdate = (userId: string, nickname: string, avatar?: string) => {
    console.log('📡 App.tsx: handleProfileUpdate called with:', { userId, nickname, avatar: avatar ? '[has avatar]' : 'no avatar' });
    if (chatAppRef.current) {
      console.log('📡 App.tsx: Calling ChatApp.emitProfileUpdate...');
      chatAppRef.current.emitProfileUpdate(userId, nickname, avatar);
    } else {
      console.error('❌ App.tsx: chatAppRef.current is null!');
    }
  };

  const handleMessageSelect = (messageId: string) => {
    // Close search and highlight the selected message
    setShowSearch(false);
    setSelectedMessageId(messageId);
  };

  const handleMessageHighlighted = () => {
    // Clear the selected message after highlighting is done
    setSelectedMessageId(null);
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-panel text-fg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  // Show main chat app if authenticated
  return (
    <div className="h-screen flex flex-col bg-panel text-fg">
      <header className="bg-header text-fg border-b border-border px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Chat App (React)</h1>

        <div className="flex gap-6 items-center">
          {/* User info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {user && (
                <Avatar 
                  user={user}
                  size="sm"
                />
              )}
              <span>{user?.nickname || user?.email}</span>
            </div>
            <button
              onClick={() => setShowSearch(true)}
              className="text-accent hover:text-accentFore flex items-center gap-1 p-2 hover:bg-panelAlt rounded-lg transition-colors"
              title="Search Messages"
            >
              <SearchIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-accent hover:text-accentFore flex items-center gap-1 p-2 hover:bg-panelAlt rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="text-red-500 hover:text-red-600 hover:underline transition-colors"
            >
              Logout
            </button>
          </div>

          
          
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {user && (
          <ChatApp 
            ref={chatAppRef}
            user={user} 
            highlightMessageId={selectedMessageId || undefined}
            onMessageHighlighted={handleMessageHighlighted}
          />
        )} 
      </main>

      {/* Settings Modal */}
      {showSettings && user && (
        <Settings
          user={user}
          onClose={() => setShowSettings(false)}
          onUserUpdate={handleUserUpdate}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

      {/* Search Modal */}
      {showSearch && (
        <MessageSearch
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onMessageSelect={handleMessageSelect}
        />
      )}
    </div>
  );
};

export default App;