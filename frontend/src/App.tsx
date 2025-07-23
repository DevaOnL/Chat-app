import React, { useEffect, useState } from "react";
import ChatApp from "./ChatApp";
import AuthForm from "./AuthForm";
import ThemeToggle from "./themestoggle";
import { applyTheme, getInitialTheme } from "./themeUtils";

interface User {
  id: string;
  email: string;
  nickname: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

        <div className="flex gap-4 items-center">
          {/* User info */}
          <div className="flex items-center gap-2 text-sm">
            <span>Welcome, {user?.nickname || user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-accent hover:underline"
            >
              Logout
            </button>
          </div>

          
          
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {user && <ChatApp user={user} />} 
      </main>
    </div>
  );
};

export default App;