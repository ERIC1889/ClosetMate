// ClosetMate 디자인 토큰. 가짓수는 일부러 제한했다 — primary, surface, text 계열만.
// 다크/라이트는 동일한 brand color 위에 surface/text 만 반전.

const brand = '#5b6cff';
const brandSoft = '#eef0ff';
const accent = '#ff8b3d';
const danger = '#e23b3b';

export default {
  light: {
    text: '#0d0f1c',
    textMuted: '#5b6075',
    background: '#fbfbff',
    surface: '#ffffff',
    surfaceMuted: '#f3f4fa',
    border: '#e6e7f0',
    tint: brand,
    brand,
    brandSoft,
    accent,
    danger,
    tabIconDefault: '#b9bcce',
    tabIconSelected: brand,
  },
  dark: {
    text: '#f5f6ff',
    textMuted: '#a0a3b8',
    background: '#0c0e17',
    surface: '#161827',
    surfaceMuted: '#1f2233',
    border: '#262a3d',
    tint: '#9ba6ff',
    brand,
    brandSoft: '#252848',
    accent,
    danger,
    tabIconDefault: '#5b6075',
    tabIconSelected: '#9ba6ff',
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 18,
  pill: 999,
} as const;
