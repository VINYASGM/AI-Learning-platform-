import React, { createContext, useContext, useEffect, useState } from 'react';

// ─── Named Theme System ────────────────────────────────────────
// Each theme maps to a CSS [data-theme="..."] selector in index.css.
// The 'system' option auto-detects OS preference and maps to
// neutral-light or neutral-dark accordingly.

export type ThemeName =
  | 'system'
  | 'neutral-light'
  | 'neutral-dark'
  | 'dracula'
  | 'tokyo-night'
  | 'night-owl'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'rose-pine'
  | 'rose-pine-dawn';

export interface ThemeDefinition {
  id: ThemeName;
  label: string;
  description: string;
  isDark: boolean;
  /** Preview swatch colors for the theme picker UI */
  preview: {
    bg: string;
    fg: string;
    accent: string;
    card: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'neutral-light',
    label: 'Neutral Light',
    description: 'Clean, minimal white',
    isDark: false,
    preview: { bg: '#ffffff', fg: '#171717', accent: '#3b82f6', card: '#f5f5f5' },
  },
  {
    id: 'neutral-dark',
    label: 'Neutral Dark',
    description: 'Pure, deep black',
    isDark: true,
    preview: { bg: '#0a0a0a', fg: '#ededed', accent: '#3b82f6', card: '#121212' },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: 'Classic purple-tinted night',
    isDark: true,
    preview: { bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9', card: '#21222c' },
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    description: 'Neon-lit deep blue',
    isDark: true,
    preview: { bg: '#1a1b26', fg: '#a9b1d6', accent: '#7aa2f7', card: '#1f2335' },
  },
  {
    id: 'night-owl',
    label: 'Night Owl',
    description: 'Low-light navy comfort',
    isDark: true,
    preview: { bg: '#011627', fg: '#d6deeb', accent: '#82aaff', card: '#021d34' },
  },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    description: 'Soothing pastel dark',
    isDark: true,
    preview: { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#cba6f7', card: '#181825' },
  },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    description: 'Warm pastel light',
    isDark: false,
    preview: { bg: '#eff1f5', fg: '#4c4f69', accent: '#8839ef', card: '#e6e9ef' },
  },
  {
    id: 'rose-pine',
    label: 'Rosé Pine',
    description: 'Moody floral dark',
    isDark: true,
    preview: { bg: '#191724', fg: '#e0def4', accent: '#c4a7e7', card: '#1f1d2e' },
  },
  {
    id: 'rose-pine-dawn',
    label: 'Rosé Pine Dawn',
    description: 'Gentle ivory warmth',
    isDark: false,
    preview: { bg: '#faf4ed', fg: '#575279', accent: '#907aa9', card: '#fffaf3' },
  },
];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: ThemeName;
  resolvedTheme: ThemeName; // the actual theme applied (never 'system')
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'neutral-dark',
  isDark: true,
  setTheme: () => null,
};

const ThemeContext = createContext<ThemeProviderState>(initialState);

function resolveSystemTheme(): ThemeName {
  if (typeof window === 'undefined') return 'neutral-dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'neutral-dark'
    : 'neutral-light';
}

function isDarkTheme(theme: ThemeName): boolean {
  if (theme === 'system') return resolveSystemTheme() === 'neutral-dark';
  const def = THEMES.find(t => t.id === theme);
  return def ? def.isDark : true;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'lumina-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(
    () => (localStorage.getItem(storageKey) as ThemeName) || defaultTheme
  );

  const resolvedTheme = theme === 'system' ? resolveSystemTheme() : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all possible theme classes and data attributes
    root.classList.remove('light', 'dark');
    root.removeAttribute('data-theme');

    // Apply the resolved theme
    const actual = theme === 'system' ? resolveSystemTheme() : theme;
    
    // Set data-theme for CSS custom properties
    root.setAttribute('data-theme', actual);
    
    // Also set light/dark class for Tailwind's dark: variant
    if (isDarkTheme(actual)) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
  }, [theme]);

  // Listen for OS theme changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = window.document.documentElement;
      const resolved = resolveSystemTheme();
      root.classList.remove('light', 'dark');
      root.setAttribute('data-theme', resolved);
      root.classList.add(isDarkTheme(resolved) ? 'dark' : 'light');
    };
    
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme: ThemeName) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider {...props} value={{ theme, resolvedTheme, isDark: isDarkTheme(resolvedTheme), setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
