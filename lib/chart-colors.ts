// Single source of truth for raw color strings used directly in SVG/Recharts
// props (stroke, fill, stopColor) where Tailwind utility classes can't apply.
// These hsl() literals were previously hand-copied across kpi-cards.tsx,
// utilization-chart.tsx, room-detail-drawer.tsx, and cooling-breakdown-chart.tsx
// (which also kept its own independent 8-color array) — consolidated here so
// the four files can't drift from each other again.
// "Blueprint" palette — drafting-line blue, copper, brass, and sage rather
// than a full saturated rainbow, so multi-series charts read as one
// coherent instrument rather than a confetti of unrelated hues. Key names
// are kept stable (not renamed to their new colors) since call sites
// reference them by name across kpi-cards.tsx, utilization-chart.tsx,
// room-detail-drawer.tsx, and cooling-breakdown-chart.tsx.
export const CHART_COLORS = {
  blue: 'hsl(202 51% 53%)', // sampled from the real AirWise logo's wave-icon gradient (primary)
  green: 'hsl(142 20% 57%)', // sage (success)
  amber: 'hsl(38 53% 54%)', // brass (warning)
  red: 'hsl(7 48% 53%)', // critical
  purple: 'hsl(208 22% 64%)', // periwinkle-slate
  cyan: 'hsl(197 41% 64%)', // pale drafting cyan
  lime: 'hsl(82 22% 56%)', // olive-sage
  orange: 'hsl(25 49% 50%)', // copper
} as const;

// 20%-alpha variants of the four colors used as sparkline/area fills.
export const CHART_COLORS_FILL_20 = {
  blue: 'hsl(202 51% 53% / 0.2)',
  green: 'hsl(142 20% 57% / 0.2)',
  amber: 'hsl(38 53% 54% / 0.2)',
  red: 'hsl(7 48% 53% / 0.2)',
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
