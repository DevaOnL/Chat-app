import React, { useState, useEffect } from "react";
import { themes, Theme } from "./themes";
import { applyTheme } from "./themeUtils";

const ThemeToggle: React.FC = () => {
  const saved = localStorage.getItem("selectedTheme") || "Gruvbox";
  const [themeName, setThemeName] = useState<string>(saved);

  useEffect(() => {
    applyTheme(themeName);
  }, [themeName]);

  return (
    <div style={{ padding: "0.5rem" }}>
      <label
        htmlFor="theme-select"
        style={{ color: "var(--fg)", marginRight: "0.5rem" }}
      >
        Theme:
      </label>
      <select
        id="theme-select"
        value={themeName}
        onChange={(e) => setThemeName(e.target.value)}
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--fg)",
          border: "1px solid var(--light-gray)",
          padding: "0.3rem 0.5rem",
          borderRadius: "4px",
        }}
      >
        {themes.map((theme: Theme) => (
          <option key={theme.name} value={theme.name}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ThemeToggle;
//ohhh
