import React, { useEffect } from "react";
import ChatApp from "./ChatApp";
import ThemeToggle from "./themestoggle";
import { getInitialTheme, applyTheme } from "./themeUtils";

const App: React.FC = () => {
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-panel shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Chat App (React)</h1>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 overflow-hidden">
        <ChatApp />
      </main>
    </div>
  );
};

export default App;