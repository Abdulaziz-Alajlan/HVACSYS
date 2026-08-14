// Single source of truth for raw color strings used directly in SVG/Recharts
// props (stroke, fill, stopColor) where Tailwind utility classes can't apply.
// These hsl() literals were previously hand-copied across kpi-cards.tsx,
// utilization-chart.tsx, room-detail-drawer.tsx, and cooling-breakdown-chart.tsx
// (which also kept its own independent 8-color array) — consolidated here so
// the four files can't drift from each other again.
export const CHART_COLORS = {
  blue: 'hsl(220 80% 65%)',
  green: 'hsl(165 80% 55%)',
  amber: 'hsl(45 90% 55%)',
  red: 'hsl(0 80% 55%)',
  purple: 'hsl(280 70% 60%)',
  cyan: 'hsl(200 80% 60%)',
  lime: 'hsl(120 60% 50%)',
  orange: 'hsl(30 90% 55%)',
} as const;

// 20%-alpha variants of the four colors used as sparkline/area fills.
export const CHART_COLORS_FILL_20 = {
  blue: 'hsl(220 80% 65% / 0.2)',
  green: 'hsl(165 80% 55% / 0.2)',
  amber: 'hsl(45 90% 55% / 0.2)',
  red: 'hsl(0 80% 55% / 0.2)',
} as const;

// Ordered palette for multi-series charts (e.g. the cooling breakdown pie)
// that need a consistent, non-clashing color sequence.
export const CHART_PALETTE: string[] = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.purple,
  CHART_COLORS.red,
  CHART_COLORS.cyan,
  CHART_COLORS.lime,
  CHART_COLORS.orange,
];
