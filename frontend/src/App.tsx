import React, { useEffect, useState } from "react";
import ChatApp from "./ChatApp";
import ThemeToggle from "./themestoggle";
import { applyTheme, getInitialTheme } from "./themeUtils";

const App: React.FC = () => {
  const [myCode, setMyCode] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  return (
    <div className="h-screen flex flex-col bg-panel text-fg">
      <header className="bg-header text-fg border-b border-border px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Chat App (React)</h1>

        <div className="flex gap-4 items-center">
          {myCode && (
            <span className="text-sm">
              Your code:&nbsp;
              <span className="font-mono text-accent">{myCode}</span>
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Pass setter so ChatApp can lift code up */}
        <ChatApp onCode={setMyCode} />
      </main>
    </div>
  );
};

export default App;