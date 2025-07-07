import { themes, Theme } from "./themes";

export const applyTheme = (themeName: string): void => {
  const theme: Theme | undefined = themes.find(t => t.name === themeName);
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.values).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  localStorage.setItem("selectedTheme", themeName);
};
// ohh