import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PointSummary {
  title: string;
  lines: string[];
  x: number;
  y: number;
  anchor?: Element;
}

/** A viewport-bound, non-interactive summary for a data mark or value. */
export function PointSummaryTooltip({ point, id }: { point: PointSummary | null; id?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [dismissed, setDismissed] = useState<PointSummary | null>(null);
  const visible = point !== null && point !== dismissed;

  useEffect(() => {
    if (!point) return;
    const dismissOnScroll = () => { if (!point.anchor?.isConnected) setDismissed(point); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissed(point); };
    window.addEventListener('scroll', dismissOnScroll, true);
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('scroll', dismissOnScroll, true); window.removeEventListener('keydown', onKeyDown); };
  }, [point]);

  useLayoutEffect(() => {
    if (!visible || !point || !element.current) return;
    const place = () => {
      if (!element.current) return;
      const box = element.current.getBoundingClientRect();
      const anchor = point.anchor?.getBoundingClientRect();
      const x = anchor ? anchor.left + anchor.width / 2 : point.x;
      const y = anchor ? anchor.top + anchor.height / 2 : point.y;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const gap = 12;
      const left = Math.max(8, Math.min(x + gap, viewportWidth - box.width - 8));
      const below = y + gap;
      const preferredTop = below + box.height <= viewportHeight - 8 ? below : y - gap - box.height;
      const top = Math.max(8, Math.min(preferredTop, viewportHeight - box.height - 8));
      setPosition({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    if (point.anchor) window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [point, visible]);

  if (!visible || !point || typeof document === 'undefined') return null;
  return createPortal(
    <div id={id} ref={element} className="report-point-summary" role="tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}>
      <strong>{point.title}</strong>
      {point.lines.map((line, index) => <span key={`${index}-${line}`}>{line}</span>)}
    </div>, document.body,
  );
}
