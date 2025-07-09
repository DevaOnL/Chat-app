import { themes } from "./themes";

export type Theme = keyof typeof themes;

export const applyTheme = (name: Theme) => {
  const theme = themes[name];
  Object.entries(theme).forEach(([key,val])=>{
    document.documentElement.style.setProperty(`--${key}`, val as string);
  });
  localStorage.setItem("theme", name);
};

export const getInitialTheme = (): Theme => {
  return (localStorage.getItem("theme") as Theme) || "light";
};
