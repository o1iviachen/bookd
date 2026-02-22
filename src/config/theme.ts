export const lightTheme = {
  colors: {
    background: '#f5f4f1',
    foreground: '#14181c',
    primary: '#00c030',
    primaryLight: '#00c03020',
    accent: '#ebe9e3',
    card: '#ffffff',
    border: 'rgba(0,0,0,0.1)',
    muted: '#e5e3de',
    textSecondary: '#596066',
    star: '#facc15',
    error: '#d4183d',
    success: '#00c030',
    warning: '#f59e0b',
    overlay: 'rgba(0,0,0,0.5)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const },
    h2: { fontSize: 22, fontWeight: '600' as const },
    h3: { fontSize: 18, fontWeight: '600' as const },
    h4: { fontSize: 16, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    bodyBold: { fontSize: 15, fontWeight: '600' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
    small: { fontSize: 11, fontWeight: '400' as const },
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: '#14181c',
    foreground: '#d4d7dd',
    primary: '#00e054',
    primaryLight: '#00e05420',
    accent: '#2c3440',
    card: '#1e2328',
    border: 'rgba(255,255,255,0.08)',
    muted: '#2c3440',
    textSecondary: '#8b95a5',
    star: '#facc15',
    overlay: 'rgba(0,0,0,0.7)',
  },
};

export type Theme = typeof lightTheme;
export type ThemeColors = typeof lightTheme.colors;
