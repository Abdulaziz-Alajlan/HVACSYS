'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Renders "X ago" text safely under SSR. formatDistanceToNow depends on the
 * current moment, which differs between server prerender time and client
 * hydration time — rendering it directly causes a hydration mismatch on any
 * statically-generated page. This defers the real value to after mount.
 */
export function RelativeTime({ date, fallback = '—' }: { date: Date | string | undefined; fallback?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{fallback}</>;

  // Defensive: date-fns throws RangeError on an invalid Date rather than
  // returning something renderable. Guards against undefined/malformed
  // input — e.g. a RoomAIRecommendation persisted to localStorage before
  // fetchedAt existed on that type — crashing the whole page instead of
  // just showing a placeholder.
  const parsed = date === undefined ? null : new Date(date);
  if (!parsed || Number.isNaN(parsed.getTime())) return <>{fallback}</>;

  return <>{formatDistanceToNow(parsed, { addSuffix: true })}</>;
}
