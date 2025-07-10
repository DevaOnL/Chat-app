/* src/themeUtils.ts */
import { themes, ThemeName } from "./themes";

export const applyTheme = (name: ThemeName) => {
  const root = document.documentElement;
  const palette = themes[name];

  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  localStorage.setItem("theme", name);
};

export const getInitialTheme = (): ThemeName =>
  (localStorage.getItem("theme") as ThemeName) || "light";