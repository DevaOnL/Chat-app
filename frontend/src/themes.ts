/* src/themes.ts */

export const themes = {
  light: {
    bg:            "#ffffff",
    fg:            "#1f2937",
    panel:         "#f9fafb",
    panelAlt:      "#f3f4f6",
    sidebar:       "#f3f4f6",
    header:        "#ffffff",
    border:        "#d1d5db",
    accent:        "#2563eb",
    accentFore:    "#ffffff",
    // Semantic colors for better contrast
    warning:       "#f59e0b",
    warningFore:   "#ffffff",
    error:         "#dc2626",
    errorFore:     "#ffffff",
    success:       "#059669",
    successFore:   "#ffffff",
    highlight:     "#fef3c7", // yellow-100
    highlightFore: "#92400e", // yellow-800
  },
  dark: {
    bg:            "#0f172a",
    fg:            "#f1f5f9",
    panel:         "#1e293b",
    panelAlt:      "#334155",
    sidebar:       "#1e293b",
    header:        "#020617",
    border:        "#475569",
    accent:        "#3b82f6",
    accentFore:    "#ffffff",
    // Semantic colors for better contrast
    warning:       "#f59e0b",
    warningFore:   "#ffffff",
    error:         "#dc2626",
    errorFore:     "#ffffff",
    success:       "#059669",
    successFore:   "#ffffff",
    highlight:     "#451a03", // yellow-900
    highlightFore: "#fef3c7", // yellow-100
  },
  solarized: {
    bg:            "#fdf6e3",
    fg:            "#586e75",
    panel:         "#eee8d5",
    panelAlt:      "#d3cbb7",
    sidebar:       "#eee8d5",
    header:        "#fdf6e3",
    border:        "#93a1a1",
    accent:        "#268bd2",
    accentFore:    "#fdf6e3",
    // Semantic colors adapted for solarized
    warning:       "#b58900", // solarized yellow
    warningFore:   "#fdf6e3",
    error:         "#dc322f", // solarized red
    errorFore:     "#fdf6e3",
    success:       "#859900", // solarized green
    successFore:   "#fdf6e3",
    highlight:     "#b58900", // solarized yellow
    highlightFore: "#fdf6e3",
  },
} as const;

export type ThemeName = keyof typeof themes;