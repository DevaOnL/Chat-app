import React, { useState } from "react";
import { applyTheme, getInitialTheme } from "./themeUtils";

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<string>(getInitialTheme());

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button onClick={toggle} className="border px-3 py-1 rounded">
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
};

export default ThemeToggle;