/* src/themes.ts */

export const themes = {
  light: {
    bg:            "#ffffff",
    fg:            "#1f2937",
    sidebar:       "#f3f4f6",
    header:        "#ffffff",
    border:        "#d1d5db",
    accent:        "#2563eb",
    accentFore:    "#ffffff",
  },
  dark: {
    bg:            "#1f2937",
    fg:            "#f3f4f6",
    sidebar:       "#374151",
    header:        "#111827",
    border:        "#4b5563",
    accent:        "#3b82f6",
    accentFore:    "#ffffff",
  },
  solarized: {
    bg:            "#fdf6e3",
    fg:            "#657b83",
    sidebar:       "#eee8d5",
    header:        "#fdf6e3",
    border:        "#93a1a1",
    accent:        "#268bd2",
    accentFore:    "#fdf6e3",
  },
} as const;

export type ThemeName = keyof typeof themes;