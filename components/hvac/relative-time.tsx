'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Renders "X ago" text safely under SSR. formatDistanceToNow depends on the
 * current moment, which differs between server prerender time and client
 * hydration time — rendering it directly causes a hydration mismatch on any
 * statically-generated page. This defers the real value to after mount.
 */
export function RelativeTime({ date, fallback = '—' }: { date: Date | string; fallback?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{fallback}</>;
  return <>{formatDistanceToNow(new Date(date), { addSuffix: true })}</>;
}
