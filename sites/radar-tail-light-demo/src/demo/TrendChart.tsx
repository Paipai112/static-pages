import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Metric, TrendSeries } from './types';
import './chart.css';

type Mark = {
  key: string;
  series: TrendSeries;
  month: string;
  monthIndex: number;
  seriesIndex: number;
  value: number;
  x: number;
  y: number;
};

type Summary = {
  mark: Mark;
  origin: 'pointer' | 'focus' | 'touch';
  anchor: SVGGElement | null;
  pointer: { x: number; y: number };
};

const HEIGHT = 342;
const MARGIN = { top: 28, right: 28, bottom: 43, left: 70 };
const MIN_WIDTH = 720;
const NUMBER = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

function monthLabel(month: string, long = false) {
  const [year, number] = month.split('-');
  return long ? `${year} 年 ${Number(number)} 月` : `${Number(number)} 月`;
}

function valueLabel(value: number, metric: Metric) {
  return metric === 'units' ? `${NUMBER.format(value)} 件` : `$${NUMBER.format(value)} USD`;
}

function seriesLabel(series: TrendSeries) {
  return series.brand && series.label !== series.brand ? `${series.brand} · ${series.label}` : series.label;
}

function axisLabel(value: number, metric: Metric) {
  if (metric === 'units') return NUMBER.format(value);
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `$${NUMBER.format(value / 1_000_000)}M`;
  if (absolute >= 1_000) return `$${NUMBER.format(value / 1_000)}k`;
  return `$${NUMBER.format(value)}`;
}

function niceStep(span: number) {
  const rough = Math.max(span, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
}

function viewportBounds() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  return {
    left,
    top,
    right: Math.min(root.clientWidth, left + (viewport?.width ?? root.clientWidth)),
    bottom: Math.min(root.clientHeight, top + (viewport?.height ?? root.clientHeight)),
  };
}

function PointSummary({ summary, metric }: { summary: Summary; metric: Metric }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, maxWidth: 300, ready: false });

  useLayoutEffect(() => {
    function reposition() {
      const card = cardRef.current;
      if (!card) return;
      const bounds = viewportBounds();
      const maxWidth = Math.min(300, Math.max(0, bounds.right - bounds.left - 24));
      card.style.maxWidth = `${maxWidth}px`;
      const size = card.getBoundingClientRect();
      const anchor = summary.origin !== 'pointer' ? summary.anchor?.getBoundingClientRect() : null;
      const x = anchor ? anchor.left + anchor.width / 2 : summary.pointer.x;
      const y = anchor ? anchor.top : summary.pointer.y;
      let left = summary.origin === 'pointer' ? x + 16 : x - size.width / 2;
      let top = y - size.height - 16;
      if (top < bounds.top + 12) top = (anchor?.bottom ?? y) + 16;
      left = Math.max(bounds.left + 12, Math.min(left, bounds.right - size.width - 12));
      top = Math.max(bounds.top + 12, Math.min(top, bounds.bottom - size.height - 12));
      setPosition((previous) => previous.left === left && previous.top === top && previous.maxWidth === maxWidth && previous.ready
        ? previous : { left, top, maxWidth, ready: true });
    }
    reposition();
    window.addEventListener('resize', reposition);
    // Capturing observes both page scrolling and nested chart scrolling.
    window.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    const observer = new ResizeObserver(reposition);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
      observer.disconnect();
    };
  }, [summary]);

  const { mark } = summary;
  const source = mark.series.source.length > 130 ? `${mark.series.source.slice(0, 127)}…` : mark.series.source;
  return createPortal(
    <div className="dtc-summary" ref={cardRef} role="tooltip" style={{ left: position.left, top: position.top, maxWidth: position.maxWidth, visibility: position.ready ? 'visible' : 'hidden' }}>
      <div className="dtc-summary-month">{monthLabel(mark.month, true)}</div>
      <div className="dtc-summary-name"><span className="dtc-color-dot" style={{ backgroundColor: mark.series.color }} />{seriesLabel(mark.series)}</div>
      <div className="dtc-summary-value">{valueLabel(mark.value, metric)}</div>
      <div className="dtc-summary-metric">{metric === 'units' ? '月销量' : '月销额'}{mark.series.productCount ? ` · ${mark.series.productCount} 款产品` : ''}</div>
      {source && <div className="dtc-summary-source">{source}</div>}
    </div>, document.body,
  );
}

export function TrendChart({ series, metric }: { series: TrendSeries[]; metric: Metric }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointRefs = useRef(new Map<string, SVGGElement>());
  const pointerModality = useRef<'mouse' | 'touch' | null>(null);
  const dismissedPointer = useRef(false);
  const [width, setWidth] = useState(1000);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const labelId = useId();
  const guidanceId = useId();

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { months, marks, paths, ticks, y, x } = useMemo(() => {
    const months = [...new Set(series.flatMap((item) => item.points.map((point) => point.month)))].sort();
    const values = series.flatMap((item) => item.points.map((point) => point[metric])).filter((value): value is number => value !== null && Number.isFinite(value));
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    const step = metric === 'units' ? Math.max(1, niceStep(high - low)) : niceStep(high - low);
    const minimum = Math.floor(low / step) * step;
    const maximum = Math.max(minimum + step, Math.ceil(high / step) * step);
    const ticks = Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => minimum + index * step);
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const x = (index: number) => months.length <= 1 ? MARGIN.left + plotWidth / 2 : MARGIN.left + index / (months.length - 1) * plotWidth;
    const y = (value: number) => MARGIN.top + plotHeight - (value - minimum) / (maximum - minimum) * plotHeight;
    const marks: Mark[] = [];
    const paths = series.map((item, seriesIndex) => {
      const byMonth = new Map(item.points.map((point) => [point.month, point]));
      let connected = false;
      const commands: string[] = [];
      months.forEach((month, monthIndex) => {
        const value = byMonth.get(month)?.[metric];
        if (value === undefined || value === null || !Number.isFinite(value)) {
          connected = false;
          return;
        }
        const mark = { key: `${item.id}:${month}`, series: item, month, monthIndex, seriesIndex, value, x: x(monthIndex), y: y(value) };
        marks.push(mark);
        commands.push(`${connected ? 'L' : 'M'}${mark.x},${mark.y}`);
        connected = true;
      });
      return { series: item, d: commands.join(' ') };
    });
    return { months, marks, paths, ticks, y, x };
  }, [series, metric, width]);

  const dataKey = series.map((item) => `${item.id}/${item.points.map((point) => `${point.month}:${point[metric]}`).join(',')}`).join('|');
  useEffect(() => {
    setSummary(null);
    dismissedPointer.current = false;
  }, [dataKey, metric]);

  useEffect(() => {
    if (!summary) return;
    const onScroll = () => setSummary((current) => {
      if (current?.origin === 'pointer' || current?.origin === 'touch') {
        dismissedPointer.current = true;
        return null;
      }
      return current;
    });
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissedPointer.current = true;
        setSummary(null);
      }
    };
    const onOutsidePointer = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !svgRef.current?.contains(event.target)) setSummary(null);
    };
    window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('scroll', onScroll);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onOutsidePointer, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutsidePointer, true);
    };
  }, [summary !== null]);

  const tabKey = marks.some((mark) => mark.key === activeKey) ? activeKey : marks[0]?.key;
  const currentSummary = useMemo(() => {
    if (!summary) return null;
    const mark = marks.find((candidate) => candidate.key === summary.mark.key);
    return mark ? { ...summary, mark } : null;
  }, [summary, marks]);

  function showPointer(mark: Mark, event: PointerEvent<SVGElement>, entering: boolean) {
    if (event.pointerType === 'touch') return;
    if (entering) dismissedPointer.current = false;
    if (dismissedPointer.current) return;
    setSummary((current) => current?.origin === 'focus' ? current : {
      mark, origin: 'pointer', anchor: pointRefs.current.get(mark.key) ?? null,
      pointer: { x: event.clientX, y: event.clientY },
    });
  }

  function leavePointer() {
    setSummary((current) => current?.origin === 'pointer' ? null : current);
  }

  function closestPoint(item: TrendSeries, clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = (clientX - rect.left) / rect.width * width;
    const localY = (clientY - rect.top) / rect.height * HEIGHT;
    return marks.filter((mark) => mark.series.id === item.id).reduce<Mark | undefined>((nearest, mark) => {
      const distance = (mark.x - localX) ** 2 + (mark.y - localY) ** 2;
      return !nearest || distance < (nearest.x - localX) ** 2 + (nearest.y - localY) ** 2 ? mark : nearest;
    }, undefined);
  }

  function navigatePoint(event: KeyboardEvent<SVGGElement>, mark: Mark) {
    pointerModality.current = null;
    if (event.key === 'Escape') {
      dismissedPointer.current = true;
      setSummary(null);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSummary({ mark, origin: 'focus', anchor: event.currentTarget, pointer: { x: 0, y: 0 } });
      return;
    }
    const horizontal = marks.filter((point) => point.seriesIndex === mark.seriesIndex);
    const currentIndex = horizontal.findIndex((point) => point.key === mark.key);
    let next: Mark | undefined;
    if (event.key === 'ArrowRight') next = horizontal[Math.min(currentIndex + 1, horizontal.length - 1)];
    if (event.key === 'ArrowLeft') next = horizontal[Math.max(currentIndex - 1, 0)];
    if (event.key === 'Home') next = horizontal[0];
    if (event.key === 'End') next = horizontal[horizontal.length - 1];
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      for (let index = mark.seriesIndex + direction; index >= 0 && index < series.length; index += direction) {
        const candidates = marks.filter((point) => point.seriesIndex === index);
        if (candidates.length) {
          next = candidates.reduce((nearest, point) => Math.abs(point.monthIndex - mark.monthIndex) < Math.abs(nearest.monthIndex - mark.monthIndex) ? point : nearest);
          break;
        }
      }
    }
    if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) event.preventDefault();
    if (next) {
      setActiveKey(next.key);
      const element = pointRefs.current.get(next.key);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      if (element) setSummary({ mark: next, origin: 'focus', anchor: element, pointer: { x: 0, y: 0 } });
    }
  }

  const monthStep = Math.max(1, Math.ceil(months.length / Math.floor((width - MARGIN.left - MARGIN.right) / 58)));
  return (
    <div className="dtc-chart" ref={containerRef}>
      {!series.length || !marks.length ? (
        <div className="dtc-empty" role="status">
          <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><path d="M9 7v32h32M15 30l8-9 8 4 10-13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <strong>{!series.length ? '选择产品或厂商，查看变化趋势' : '所选时间内暂无数据'}</strong>
          <span>{!series.length ? '在候选列表中勾选想比较的对象' : '调整时间范围或选择其他对象'}</span>
        </div>
      ) : (
        <>
          <div className="dtc-legend" aria-label="图表系列">{series.map((item) => <span className="dtc-legend-item" key={item.id}><span className="dtc-legend-line" style={{ backgroundColor: item.color }} />{seriesLabel(item)}</span>)}</div>
          <div className="dtc-chart-unit" id={labelId}>{metric === 'units' ? '月销量 / 件' : '月销额 / USD'}</div>
          <p className="dtc-sr-only" id={guidanceId}>按左右方向键切换月份，上下方向键切换对象，Home 或 End 跳转首末数据，Esc 关闭摘要。</p>
          <div className="dtc-scroll" role="region" aria-label="月度趋势图，可横向滚动" tabIndex={0}>
            <svg ref={svgRef} className="dtc-svg" viewBox={`0 0 ${width} ${HEIGHT}`} style={{ width, height: HEIGHT }} role="group" aria-labelledby={labelId} aria-describedby={guidanceId}>
              {ticks.map((tick) => <g key={tick} className="dtc-tick" aria-hidden="true">
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
                <text x={MARGIN.left - 16} y={y(tick)} textAnchor="end" dominantBaseline="middle">{axisLabel(tick, metric)}</text>
              </g>)}
              {months.map((month, index) => (index % monthStep === 0 || index === months.length - 1) && <text className="dtc-month" key={month} x={x(index)} y={HEIGHT - 15} textAnchor="middle" aria-hidden="true">{index === 0 || month.endsWith('-01') ? month.replace('-', '.') : monthLabel(month)}</text>)}
              {currentSummary && <line className="dtc-crosshair" x1={currentSummary.mark.x} x2={currentSummary.mark.x} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} aria-hidden="true" />}
              {paths.map(({ series: item, d }) => <path key={item.id} className="dtc-line" d={d} stroke={item.color} aria-hidden="true" />)}
              {paths.map(({ series: item, d }) => <path key={item.id} d={d} className="dtc-line-target" aria-hidden="true"
                onPointerEnter={(event) => { const mark = closestPoint(item, event.clientX, event.clientY); if (mark) showPointer(mark, event, true); }}
                onPointerMove={(event) => { const mark = closestPoint(item, event.clientX, event.clientY); if (mark) showPointer(mark, event, false); }}
                onPointerLeave={leavePointer}
                onClick={(event) => { const mark = closestPoint(item, event.clientX, event.clientY); if (mark) setSummary({ mark, origin: 'touch', anchor: pointRefs.current.get(mark.key) ?? null, pointer: { x: event.clientX, y: event.clientY } }); }}
              />)}
              {marks.map((mark) => <g key={mark.key} ref={(element) => { if (element) pointRefs.current.set(mark.key, element); else pointRefs.current.delete(mark.key); }}
                transform={`translate(${mark.x} ${mark.y})`} className={`dtc-point${summary?.mark.key === mark.key ? ' dtc-point-active' : ''}`}
                tabIndex={mark.key === tabKey ? 0 : -1} role="button"
                aria-label={`${seriesLabel(mark.series)}，${monthLabel(mark.month, true)}，${metric === 'units' ? '月销量' : '月销额'} ${valueLabel(mark.value, metric)}${mark.series.source ? `，${mark.series.source}` : ''}`}
                onPointerEnter={(event) => showPointer(mark, event, true)} onPointerMove={(event) => showPointer(mark, event, false)} onPointerLeave={leavePointer}
                onPointerDown={(event) => { pointerModality.current = event.pointerType === 'touch' ? 'touch' : 'mouse'; setActiveKey(mark.key); }}
                onFocus={(event) => {
                  setActiveKey(mark.key);
                  dismissedPointer.current = false;
                  const origin = pointerModality.current === 'touch' ? 'touch' : pointerModality.current === 'mouse' ? 'pointer' : 'focus';
                  const rect = event.currentTarget.getBoundingClientRect();
                  setSummary({ mark, origin, anchor: event.currentTarget, pointer: { x: rect.left + rect.width / 2, y: rect.top } });
                }}
                onBlur={(event) => {
                  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                  pointerModality.current = null;
                  setSummary((current) => current?.mark.key === mark.key ? null : current);
                }}
                onClick={(event) => {
                  const origin = pointerModality.current === null ? 'focus' : pointerModality.current === 'touch' ? 'touch' : 'pointer';
                  setSummary({ mark, origin, anchor: event.currentTarget, pointer: { x: event.clientX, y: event.clientY } });
                }}
                onKeyDown={(event) => navigatePoint(event, mark)}>
                <circle className="dtc-point-target" r="12" />
                <circle className="dtc-point-ring" r="9" stroke={mark.series.color} />
                <circle className="dtc-point-visible" r="3.5" stroke={mark.series.color} fill="white" />
              </g>)}
            </svg>
          </div>
        </>
      )}
      {currentSummary && <PointSummary summary={currentSummary} metric={metric} />}
    </div>
  );
}
