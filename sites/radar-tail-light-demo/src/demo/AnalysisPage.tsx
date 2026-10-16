import { useId, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { TrendChart } from './TrendChart';
import { brandSeries, marketSeries, months, productSeries } from './trend-data';
import type { AnalysisState, AnalysisView, CandidateFilters, TrendPoint } from './types';
import './analysis.css';

interface AnalysisPageProps {
  state: AnalysisState;
  onChange: (next: AnalysisState) => void;
  onViewChange: (view: AnalysisView) => void;
}

const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const monthLabel = (month: string) => month.replace('-', '.');
const inPeriod = (points: TrendPoint[], state: AnalysisState) => points.filter((point) => point.month >= state.startMonth && point.month <= state.endMonth);
function total(points: TrendPoint[], key: 'units' | 'revenue'): number | null {
  const values = points.map((point) => point[key]).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
function compactMoney(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${money.format(value)}`;
}
function rangeError(filters: CandidateFilters): string | null {
  for (const [name, min, max] of [['销量', filters.minUnits, filters.maxUnits], ['销额', filters.minRevenue, filters.maxRevenue]]) {
    if ([min, max].some((value) => value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))) return `${name}范围请输入大于或等于 0 的数字`;
    if (min !== '' && max !== '' && Number(min) > Number(max)) return `${name}最小值不能大于最大值`;
  }
  return null;
}
function withinRange(value: number | null, min: string, max: string): boolean {
  if (!min && !max) return true;
  return value !== null && (!min || value >= Number(min)) && (!max || value <= Number(max));
}

export function AnalysisPage({ state, onChange, onViewChange }: AnalysisPageProps) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const selectionId = useId();
  const errorId = useId();
  const activeView = state.view === 'brands' ? 'brands' : 'products';
  const isMarket = state.view === 'market';
  const filters = state.filters[activeView];
  // Older configurations used selection-first ordering. Interpret that value as
  // a stable quantity sort so toggling a checkbox never moves its candidate.
  const candidateSort = filters.sort === 'selected' ? 'units' : filters.sort;
  const selectedIds = activeView === 'products' ? state.productIds : state.brandIds;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pool = activeView === 'products' ? productSeries : brandSeries;
  const error = rangeError(filters);
  const candidates = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase();
    return pool.map((series) => {
      const points = inPeriod(series.points, state);
      return { series, units: total(points, 'units'), revenue: total(points, 'revenue') };
    }).filter(({ series, units, revenue }) => !error
      && (!query || `${series.label} ${series.brand ?? ''}`.toLocaleLowerCase().includes(query))
      && withinRange(units, filters.minUnits, filters.maxUnits)
      && withinRange(revenue, filters.minRevenue, filters.maxRevenue))
      .sort((first, second) => {
        const nameOrder = first.series.label.localeCompare(second.series.label)
          || first.series.id.localeCompare(second.series.id);
        if (candidateSort === 'name') return nameOrder;
        const key = candidateSort === 'revenue' ? 'revenue' : 'units';
        return (second[key] ?? -1) - (first[key] ?? -1) || nameOrder;
      });
  }, [pool, state.startMonth, state.endMonth, filters, error, candidateSort]);
  const selectedCount = pool.filter((series) => selectedSet.has(series.id)).length;
  const selectedVisibleCount = candidates.filter(({ series }) => selectedSet.has(series.id)).length;
  const plottedSeries = useMemo(() => (isMarket ? [marketSeries] : pool.filter((series) => selectedSet.has(series.id)))
    .map((series) => ({ ...series, points: inPeriod(series.points, state) })), [isMarket, pool, selectedSet, state.startMonth, state.endMonth]);
  const marketPoints = inPeriod(marketSeries.points, state);
  const marketUnits = total(marketPoints, 'units');
  const marketRevenue = total(marketPoints, 'revenue');
  const latestPoint = marketPoints[marketPoints.length - 1];
  const previousPoint = latestPoint ? marketSeries.points[months.indexOf(latestPoint.month) - 1] : undefined;
  const growth = latestPoint?.units != null && previousPoint?.units != null && previousPoint.units !== 0
    ? (latestPoint.units / previousPoint.units - 1) * 100 : null;
  const periodText = `${monthLabel(state.startMonth)} — ${monthLabel(state.endMonth)}`;
  const noun = activeView === 'products' ? '产品' : '厂商';
  const metricLabel = state.metric === 'units' ? '销量' : '销额';
  const chartTitle = isMarket ? `本次调研总盘的月${metricLabel}` : `${selectedCount} ${activeView === 'products' ? '款产品' : '个厂商'}的月${metricLabel}`;
  const filtersActive = Object.entries(filters).some(([key, value]) => key !== 'sort' && value !== '');

  const updateFilters = (next: Partial<CandidateFilters>) => onChange({ ...state, filters: { ...state.filters, [activeView]: { ...filters, ...next } } });
  const setSelected = (ids: string[]) => onChange({ ...state, [activeView === 'products' ? 'productIds' : 'brandIds']: ids });
  function bulkSelect(mode: 'all' | 'none' | 'invert') {
    const next = new Set(selectedIds);
    for (const { series } of candidates) {
      if (mode === 'none' || (mode === 'invert' && next.has(series.id))) next.delete(series.id);
      else next.add(series.id);
    }
    setSelected([...next]);
  }
  function toggleSeries(id: string) {
    setSelected(selectedSet.has(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  }

  return <div className="dap-page">
    <section className="dap-summary" aria-label="本次调研总盘期间指标">
      <div className="dap-stat"><span>期间总销量</span><strong>{marketUnits === null ? '—' : number.format(marketUnits)}<small>件</small></strong></div>
      <div className="dap-stat"><span>期间总销额</span><strong>{marketRevenue === null ? '—' : (marketRevenue / 1_000_000).toFixed(2)}<small>百万 USD</small></strong></div>
      <div className="dap-stat"><span>{latestPoint ? `${monthLabel(latestPoint.month)} 月销量` : '期末月销量'}</span><strong>{latestPoint?.units == null ? '—' : number.format(latestPoint.units)}<small>件</small></strong></div>
      <div className="dap-stat"><span>较上一月</span><strong className={growth !== null && growth < 0 ? 'dap-negative' : 'dap-positive'}>{growth === null ? '—' : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}`}<small>%</small></strong></div>
    </section>

    <div className="dap-section-heading">
      <h2><span>TREND</span>市场变化趋势</h2>
      <div className="dap-period" role="group" aria-label="趋势期间">
        <label><span className="dap-sr-only">开始月份</span><select aria-label="开始月份" value={state.startMonth} onChange={(event) => onChange({ ...state, startMonth: event.target.value, endMonth: event.target.value > state.endMonth ? event.target.value : state.endMonth })}>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
        <span aria-hidden="true">—</span>
        <label><span className="dap-sr-only">结束月份</span><select aria-label="结束月份" value={state.endMonth} onChange={(event) => onChange({ ...state, endMonth: event.target.value, startMonth: event.target.value < state.startMonth ? event.target.value : state.startMonth })}>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
      </div>
    </div>

    <section className="dap-panel" aria-label="竞品趋势分析">
      <div className="dap-toolbar">
        <div className="dap-view-switch" role="group" aria-label="分析视图">
          {([['products', '产品'], ['brands', '厂商（品牌）'], ['market', '本次调研总盘']] as const).map(([view, label]) => <button key={view} type="button" aria-pressed={state.view === view} onClick={() => onViewChange(view)}>{label}</button>)}
        </div>
        <div className="dap-metric-switch" role="group" aria-label="纵轴单位">
          <button type="button" aria-pressed={state.metric === 'units'} onClick={() => onChange({ ...state, metric: 'units' })}>销量 · 件</button>
          <button type="button" aria-pressed={state.metric === 'revenue'} onClick={() => onChange({ ...state, metric: 'revenue' })}>销额 · USD</button>
        </div>
      </div>

      {!isMarket && <button className="dap-mobile-selector" type="button" aria-expanded={selectionOpen} aria-controls={selectionId} onClick={() => setSelectionOpen(!selectionOpen)}><span>选择{noun}<b>已选 {selectedCount}</b></span><span>{selectionOpen ? '收起 −' : '筛选与勾选 +'}</span></button>}

      <div className={`dap-workspace${isMarket ? ' dap-market' : ''}`}>
        {!isMarket && <section className={`dap-selection${selectionOpen ? ' dap-selection-open' : ''}`} id={selectionId} aria-label={`选择${noun}`}>
          <div className="dap-filter-row">
            <label className="dap-search-field"><span>搜索{noun}</span><span className="dap-search"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20"><circle cx="8.4" cy="8.4" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.5"/></svg><input type="search" maxLength={160} placeholder={activeView === 'products' ? '搜索型号或品牌' : '搜索厂商名称'} value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })}/></span></label>
          <div className="dap-ranges" aria-describedby={error ? errorId : undefined}>
            <fieldset><legend>期间销量 · 件</legend><div><label><span className="dap-sr-only">最小期间销量</span><input aria-invalid={Boolean(error)} type="number" min="0" step="1" inputMode="numeric" placeholder="不限" value={filters.minUnits} onChange={(event) => updateFilters({ minUnits: event.target.value })}/></label><span>—</span><label><span className="dap-sr-only">最大期间销量</span><input aria-invalid={Boolean(error)} type="number" min="0" step="1" inputMode="numeric" placeholder="不限" value={filters.maxUnits} onChange={(event) => updateFilters({ maxUnits: event.target.value })}/></label></div></fieldset>
            <fieldset><legend>期间销额 · USD</legend><div><label><span className="dap-sr-only">最小期间销额</span><input aria-invalid={Boolean(error)} type="number" min="0" step="0.01" inputMode="decimal" placeholder="不限" value={filters.minRevenue} onChange={(event) => updateFilters({ minRevenue: event.target.value })}/></label><span>—</span><label><span className="dap-sr-only">最大期间销额</span><input aria-invalid={Boolean(error)} type="number" min="0" step="0.01" inputMode="decimal" placeholder="不限" value={filters.maxRevenue} onChange={(event) => updateFilters({ maxRevenue: event.target.value })}/></label></div></fieldset>
          </div>
            <label className="dap-sort"><span>排序</span><select value={candidateSort} onChange={(event) => updateFilters({ sort: event.target.value as CandidateFilters['sort'] })}><option value="units">销量从高到低</option><option value="revenue">销额从高到低</option><option value="name">名称顺序</option></select></label>
          </div>
          {error && <p className="dap-filter-error" id={errorId} role="alert">{error}</p>}
          <div className="dap-selection-actions">
            <div className="dap-list-meta"><h3>选择{noun}</h3><span aria-live="polite">{candidates.length} 项符合条件 · 全部已选 {selectedCount}</span></div>
            <div className="dap-bulk"><button type="button" disabled={!candidates.length} onClick={() => bulkSelect('all')}>全选</button><button type="button" disabled={!candidates.length} onClick={() => bulkSelect('none')}>全取消</button><button type="button" disabled={!candidates.length} onClick={() => bulkSelect('invert')}>反选</button><span>当前 {candidates.length} 项</span></div>
            {filtersActive && candidates.length > 0 && <button className="dap-reset" type="button" onClick={() => updateFilters({ query: '', minUnits: '', maxUnits: '', minRevenue: '', maxRevenue: '' })}>重置筛选</button>}
          </div>

          <div className="dap-candidate-list" tabIndex={0} role="group" aria-label={`${noun}候选列表，可滚动浏览`}>
            {candidates.map(({ series, units, revenue }) => <label className={`dap-candidate${selectedSet.has(series.id) ? ' dap-candidate-selected' : ''}`} key={series.id} style={{ '--dap-series-color': series.color } as CSSProperties}>
              <input type="checkbox" checked={selectedSet.has(series.id)} onChange={() => toggleSeries(series.id)} aria-label={`${series.brand && activeView === 'products' ? `${series.brand} ` : ''}${series.label}`}/>
              <span className="dap-candidate-name"><strong>{series.label}</strong><small>{activeView === 'products' ? series.brand : `${series.productCount} 款收录产品`}</small></span>
              <span className="dap-candidate-values"><span>{units === null ? '—' : `${number.format(units)} 件`}</span><span aria-label={revenue === null ? '销额缺失' : `${money.format(revenue)} 美元`}>{compactMoney(revenue)}</span></span>
            </label>)}
            {!candidates.length && <div className="dap-no-candidates"><strong>没有符合条件的{noun}</strong><span>调整搜索或范围后再选择。</span><button type="button" onClick={() => updateFilters({ query: '', minUnits: '', maxUnits: '', minRevenue: '', maxRevenue: '' })}>重置筛选</button></div>}
          </div>
        </section>}

        <div className="dap-chart-pane">
          <div className="dap-chart-heading"><h3>{chartTitle}</h3><span>{periodText}</span></div>
          <TrendChart series={plottedSeries} metric={state.metric}/>
          <div className="dap-chart-footer">
            <span aria-live="polite">{isMarket ? `${productSeries.length} 款产品 · ${brandSeries.length} 个厂商` : `全部已选 ${selectedCount} · 当前结果内 ${selectedVisibleCount}`}</span>
            {!isMarket && <button type="button" disabled={selectedCount === 0} onClick={() => setSelected([])}>清空图表</button>}
          </div>
          <div className="dap-chart-context"><span>当前期间&nbsp; {periodText}</span><span>Amazon US · 自行车雷达尾灯</span></div>
        </div>
      </div>
    </section>
  </div>;
}
