/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#e9e4d8",
      "foreground": "#1b2b35",
      "border": "#c8c3b8",
      "card": "#f3eee3",
      "cardForeground": "#1b2b35",
      "popover": "#f3eee3",
      "popoverForeground": "#1b2b35",
      "primary": "#d86439",
      "primaryForeground": "#fff9ed",
      "secondary": "#1b2b35",
      "secondaryForeground": "#e8e5da",
      "muted": "#e1ded4",
      "mutedForeground": "#64717a",
      "accent": "#2d8290",
      "accentForeground": "#f3eee3",
      "destructive": "#9e3d26",
      "destructiveForeground": "#fff9ed",
      "input": "#9fb0b6",
      "ring": "#d86439",
      "chart1": "#d86439",
      "chart2": "#2d8290",
      "chart3": "#4f7e64",
      "chart4": "#c18b46",
      "chart5": "#1b2b35",
      "sidebar": "#17242d",
      "sidebarForeground": "#d5dfdc",
      "sidebarBorder": "#3b4c55",
      "sidebarPrimary": "#d86439",
      "sidebarPrimaryForeground": "#fff9ed",
      "sidebarAccent": "#263941",
      "sidebarAccentForeground": "#eff2e9",
      "sidebarRing": "#f1a05c"
    },
    "dark": {
      "background": "#111a22",
      "foreground": "#e8e5da",
      "border": "#41515b",
      "card": "#17242d",
      "cardForeground": "#e8e5da",
      "popover": "#203039",
      "popoverForeground": "#eff2e9",
      "primary": "#f1a05c",
      "primaryForeground": "#111a22",
      "secondary": "#263941",
      "secondaryForeground": "#dce7e7",
      "muted": "#203039",
      "mutedForeground": "#9fb0b6",
      "accent": "#2d8290",
      "accentForeground": "#f3eee3",
      "destructive": "#d86439",
      "destructiveForeground": "#fff9ed",
      "input": "#3b4c55",
      "ring": "#f1a05c",
      "chart1": "#f1a05c",
      "chart2": "#58a7b3",
      "chart3": "#79a98b",
      "chart4": "#d2a35f",
      "chart5": "#d86439",
      "sidebar": "#10202a",
      "sidebarForeground": "#d5dfdc",
      "sidebarBorder": "#3b4c55",
      "sidebarPrimary": "#f1a05c",
      "sidebarPrimaryForeground": "#111a22",
      "sidebarAccent": "#263941",
      "sidebarAccentForeground": "#eff2e9",
      "sidebarRing": "#f1a05c"
    }
  },
  "fontFamily": {
    "sans": [
      "IBM Plex Sans",
      "system-ui",
      "sans-serif"
    ],
    "serif": [
      "IBM Plex Sans Condensed",
      "Arial Narrow",
      "sans-serif"
    ],
    "mono": [
      "IBM Plex Mono",
      "monospace"
    ]
  },
  "radius": "0.25rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
