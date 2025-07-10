import React, { useState } from "react";
import { applyTheme, getInitialTheme } from "./themeUtils";
import type { ThemeName } from "./themes";

const order: ThemeName[] = ["light", "dark", "solarized"];

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme());

  const toggle = () => {
    const next = order[(order.indexOf(theme) + 1) % order.length];
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
    onClick={toggle}
    className="border border-border px-3 py-1 rounded text-fg hover:bg-panelAlt"
  >
    {theme === "light" ? "Light"
       : theme === "dark" ?  "Dark"
       :                      "Solarised"}
  </button>
  );
};

export default ThemeToggle;